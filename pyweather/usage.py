"""Part 6 — Tokens and money, written into the SAME ledger as the TypeScript.

This is the most important file in the Python build, and not because the code
is hard. It is the document's argument made physical.

`src/usage.ts` appends one row per Claude call to `usage.csv`. This file
appends rows to *that same file*. Run `npm run agent`, then `uv run agent`,
then `npm run usage`, and one report totals both. Two languages, one artifact.
Nothing is translated at the boundary, because there is no boundary — the file
format is real and the language is just spelling.

That only works if this file matches src/usage.ts EXACTLY: same columns, same
order, same quoting, same byte-order mark, same line endings. The header guard
below refuses to append if the columns drift, which is the contract enforcing
itself rather than trusting anyone to remember.

The two rules from src/usage.ts carry over unchanged:

  1. RECORD FACTS, PRICE THEM SEPARATELY. Token counts never change; prices do.
     The token columns are the durable record, cost_usd is today's snapshot.

  2. NEVER LOG THE FULL PROMPT OR REPLY. First 40 characters only.
"""

import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, NamedTuple

from anthropic.types import Message, Usage

from .text import text_from


class Rate(NamedTuple):
    input: int
    output: int


PricedModel = Literal[
    "claude-sonnet-5",
    "claude-haiku-4-5-20251001",
    "claude-opus-5",
]

# Dollars per million tokens. Verified 2026-08-13 — re-check against
# https://platform.claude.com/docs/en/about-claude/pricing before trusting a total.
#
# This mirrors PRICES in src/usage.ts. TypeScript pins the keys with
# `as const` plus `keyof typeof PRICES`; Python pins them with Literal. Same
# closed set, same compile-time error if you pass a model that isn't in it —
# checked by pyright here, by tsc there.
PRICES: dict[PricedModel, Rate] = {
    "claude-sonnet-5": Rate(input=2, output=10),
    "claude-haiku-4-5-20251001": Rate(input=1, output=5),
    "claude-opus-5": Rate(input=5, output=25),
}

# Anchored to this file, not to the working directory.
#
# src/usage.ts can write the bare relative path 'usage.csv' because npm always
# runs its scripts from the project root. `uv run` makes no such promise — it
# runs wherever you are. Resolving from __file__ means both languages land on
# the same file no matter which directory you were standing in, which is the
# whole point of this file. A ledger that silently splits in two is worse than
# no ledger.
LEDGER = Path(__file__).resolve().parent.parent / "usage.csv"

# How much of the prompt and reply to keep, so you can tell rows apart.
# 40 rather than 10 or 20: "what's the weather in Denver" is 28 characters,
# and the word that distinguishes one row from the next is at the END.
SNIPPET = 40

# An invisible "this file is UTF-8" marker. Without it, Excel on Windows opens
# usage.csv as legacy text and renders the degree sign in "80°F" as mojibake.
# Written once, as the very first character of the file.
#
# Note we open for writing with plain "utf-8", never "utf-8-sig" — that codec
# would add a BOM of its own and we'd end up with two. We write this one
# ourselves, deliberately, exactly when creating the file.
BOM = "﻿"

# One id per process, so every call in a single `uv run chat` groups together.
# str(uuid4())[:8], not .hex[:8] — src/usage.ts slices the hyphenated form, and
# the first 8 characters of a UUID string are hex either way, so these match.
RUN_ID = str(uuid.uuid4())[:8]

COLUMNS = [
    "timestamp", "run_id", "script", "model", "message_id",
    "input_tokens", "cache_read", "cache_write",
    "thinking_tokens", "output_tokens", "context_tokens",
    "cost_usd", "stop_reason", "prompt", "reply",
]


def field(text: str) -> str:
    """Squash to one line, trim to SNIPPET, then quote it — a stray comma or
    newline in a prompt would otherwise shift every column to its right."""
    flat = " ".join(text.split())[:SNIPPET]
    return '"' + flat.replace('"', '""') + '"'


def cost_of(model: PricedModel, usage: Usage) -> float:
    """What a call actually cost. Four terms, because the prompt is three
    separate quantities billed at three different rates:

      input_tokens  full price   — the part that wasn't cached
      cache_write   1.25x        — writing a new cache entry costs a premium
      cache_read    0.1x         — reading one back is the whole point of caching
      output_tokens output price — ~5x input, and INCLUDES any thinking tokens

    Before Part 11 the two cache numbers are always 0, so this collapses to the
    simple version. It stays correct once you turn caching on.
    """
    rate = PRICES[model]
    cache_write = usage.cache_creation_input_tokens or 0
    cache_read = usage.cache_read_input_tokens or 0

    return (
        usage.input_tokens * rate.input
        + cache_write * rate.input * 1.25
        + cache_read * rate.input * 0.1
        + usage.output_tokens * rate.output
    ) / 1_000_000


def _timestamp() -> str:
    """ISO-8601 with millisecond precision and a Z suffix.

    Not just .isoformat(): that gives microseconds and '+00:00', while
    JavaScript's toISOString() gives milliseconds and 'Z'. The columns have to
    line up, so we spell it out.
    """
    now = datetime.now(timezone.utc)
    return now.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now.microsecond // 1000:03d}Z"


def log_call(
    script: str,
    model: PricedModel,
    prompt: str,
    message: Message,
    print_summary: bool = True,
) -> None:
    """One line in any script, right after the response comes back.

    Always appends a row to usage.csv. Also prints a one-line summary, unless
    you pass print_summary=False — bench.py does that, because it formats its
    own table and would otherwise show every number twice.
    """
    usage = message.usage
    cache_read = usage.cache_read_input_tokens or 0
    cache_write = usage.cache_creation_input_tokens or 0

    # output_tokens is the authoritative billed total and ALREADY includes
    # thinking. Never add these two together.
    details = usage.output_tokens_details
    thinking = details.thinking_tokens if details else 0

    # The whole prompt you resent this turn — "tokens I need to keep".
    context = usage.input_tokens + cache_read + cache_write

    cost = cost_of(model, usage)

    header = ",".join(COLUMNS)

    if not LEDGER.exists():
        # newline="" on every open: Python's text mode would otherwise
        # translate "\n" to "\r\n" on Windows. src/usage-report.ts splits the
        # file on "\n", so CRLF leaves a stray carriage return on every row.
        # This is the single easiest way to break a cross-language file format.
        with LEDGER.open("w", encoding="utf-8", newline="") as f:
            f.write(BOM + header + "\n")
    else:
        # Check the columns before appending. If COLUMNS ever changes, new rows
        # written under an old header line up one column out, `npm run usage`
        # reads the wrong cells, and an empty cell parses as 0 — so it reports
        # $0.00 and looks fine. A cost log that silently says zero is the worst
        # outcome this file could have, so refuse rather than corrupt.
        #
        # This is also what catches a drift between usage.py and usage.ts. The
        # two writers agreeing is not a convention here; it is enforced.
        with LEDGER.open("r", encoding="utf-8-sig", newline="") as f:
            existing = f.readline().rstrip("\r\n")
        if existing != header:
            raise RuntimeError(
                f"{LEDGER.name} has different columns than this version of usage.py writes.\n"
                "Rename or delete it and run again — the old rows stay readable in Excel."
            )

    # Built by hand rather than with csv.writer. The stdlib writer defaults to
    # CRLF and decides for itself which cells need quoting; we need to match
    # another program's bytes exactly, which means quoting `prompt` and `reply`
    # and nothing else. Reading the file back IS a job for the csv module —
    # see usage_report.py.
    row = [
        _timestamp(),
        RUN_ID,
        # The `py:` prefix is what makes the shared ledger legible: one report,
        # and you can still see which language produced each row.
        f"py:{script}",
        model,
        message.id,
        str(usage.input_tokens),
        str(cache_read),
        str(cache_write),
        str(thinking),
        str(usage.output_tokens),
        str(context),
        f"{cost:.6f}",
        message.stop_reason or "",
        field(prompt),
        field(text_from(message)),
    ]

    with LEDGER.open("a", encoding="utf-8", newline="") as f:
        f.write(",".join(row) + "\n")

    if not print_summary:
        return

    cached = f" (+{cache_read} cached, {cache_write} written)" if cache_read or cache_write else ""
    thought = f" [{thinking} thinking]" if thinking else ""

    # Leading newline: when streaming, the answer ends without one, and the
    # usage line would otherwise run straight into the last word.
    print(
        f"\n[usage] in {usage.input_tokens}{cached} · out {usage.output_tokens}{thought}"
        f" · context {context} · ${cost:.6f}"
    )
