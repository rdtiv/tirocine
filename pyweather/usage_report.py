"""Part 6 — Reading your own usage log.

Run: uv run usage

Reads usage.csv and tells you what you've spent. Makes NO API calls, so it
is free and you can run it as often as you like.

This is the Console dashboard you don't have. It also proves a point worth
internalizing: once you write facts down in a boring format, you can answer
questions nobody planned for. The file is just rows and columns — this
script is one way to read it, and Excel is another.

Against src/usage-report.ts, the parsing itself is the lesson. That file
hand-rolls `splitCsvLine`, a small state machine for quoted fields and ""
escapes, because Node has no CSV parser in its standard library. Python does
— `csv.reader` handles quoting and escaping for you. Two languages, same
file format, and one of them needed forty lines nobody asked to write.

We still look columns up BY NAME rather than by position, exactly like the
TypeScript's `headers.indexOf(name)` — the ledger's column order isn't a
contract either language should hardcode.
"""

import csv
from dataclasses import dataclass
from typing import Callable

from .usage import LEDGER


@dataclass
class Row:
    run_id: str
    script: str
    model: str
    input_tokens: int
    cache_read: int
    cache_write: int
    thinking_tokens: int
    output_tokens: int
    context_tokens: int
    cost_usd: float


def _to_int(value: str) -> int:
    # Same behavior as TypeScript's Number(''): an empty or missing cell
    # parses as 0, not an error.
    return int(value) if value else 0


def _to_float(value: str) -> float:
    return float(value) if value else 0.0


def main() -> None:
    if not LEDGER.exists():
        print(f"No {LEDGER.name} yet. Run any script that calls Claude, then try again.")
        return

    # encoding="utf-8-sig" strips the byte-order mark usage.py writes for
    # Excel's sake, the same job as src/usage-report.ts's
    # `.replace(/^﻿/, '')`. newline="" hands the raw file to csv.reader
    # so it — not Python's text-mode newline translation — decides where
    # rows end.
    with LEDGER.open("r", encoding="utf-8-sig", newline="") as f:
        lines = list(csv.reader(f))

    # A file that exists but is empty is a real state: a run killed between
    # creating usage.csv and writing the header. src/usage-report.ts survives
    # it, so this must too — the two reports have to agree on every input,
    # not just the happy one.
    if not lines:
        print(f"No rows in {LEDGER.name} yet. Run any script that calls Claude, then try again.")
        return

    headers = lines[0]

    def get(cells: list[str], name: str) -> str:
        # Missing column, or a row shorter than the header — the last row of a
        # ledger whose append was interrupted. Both read as empty rather than
        # raising, matching `?? ''` in src/usage-report.ts.
        if name not in headers:
            return ""
        i = headers.index(name)
        return cells[i] if i < len(cells) else ""

    rows = [
        Row(
            run_id=get(cells, "run_id"),
            script=get(cells, "script"),
            model=get(cells, "model"),
            input_tokens=_to_int(get(cells, "input_tokens")),
            cache_read=_to_int(get(cells, "cache_read")),
            cache_write=_to_int(get(cells, "cache_write")),
            thinking_tokens=_to_int(get(cells, "thinking_tokens")),
            output_tokens=_to_int(get(cells, "output_tokens")),
            context_tokens=_to_int(get(cells, "context_tokens")),
            cost_usd=_to_float(get(cells, "cost_usd")),
        )
        for cells in lines[1:]
        if cells  # csv.reader yields [] for a trailing blank line
    ]

    def total(pick: Callable[[Row], float]) -> float:
        return sum(pick(r) for r in rows)

    def money(dollars: float) -> str:
        return f"${dollars:.4f}"

    print(f"\n=== {len(rows)} calls in {LEDGER.name} ===\n")
    print(f"Total spend      {money(total(lambda r: r.cost_usd))}")
    print(f"Input tokens     {total(lambda r: r.input_tokens):,.0f} uncached")
    print(f"Output tokens    {total(lambda r: r.output_tokens):,.0f}")

    thinking = total(lambda r: r.thinking_tokens)
    if thinking > 0:
        output = total(lambda r: r.output_tokens)
        share = f"{(thinking / output * 100):.1f}"
        print(
            f"  of which        {thinking:,.0f} were thinking ({share}%) — "
            "reasoning you paid for and never saw"
        )

    # --- By model -----------------------------------------------------------
    print("\n--- by model ---")
    for model in dict.fromkeys(r.model for r in rows):
        mine = [r for r in rows if r.model == model]
        cost = sum(r.cost_usd for r in mine)
        print(f"{model.ljust(28)} {str(len(mine)).rjust(4)} calls  {money(cost).rjust(10)}")

    # --- By session -----------------------------------------------------------
    # This is the one that answers "what did that conversation cost me?"
    print("\n--- by session (one run_id per program start) ---")
    for run_id in dict.fromkeys(r.run_id for r in rows):
        mine = [r for r in rows if r.run_id == run_id]
        cost = sum(r.cost_usd for r in mine)
        scripts = ", ".join(dict.fromkeys(r.script for r in mine))
        print(f"{run_id}  {str(len(mine)).rjust(4)} calls  {money(cost).rjust(10)}  {scripts}")

    # --- Caching --------------------------------------------------------------
    cache_read = total(lambda r: r.cache_read)
    cache_write = total(lambda r: r.cache_write)

    print("\n--- caching ---")
    if cache_read == 0 and cache_write == 0:
        print("No cache activity yet. Either caching is off, or every prompt")
        print("was under the minimum (1,024 tokens on Sonnet 5). See Part 11.")
    else:
        print(f"Written to cache  {cache_write:,.0f} tokens (billed at 1.25x)")
        print(f"Read from cache   {cache_read:,.0f} tokens (billed at 0.1x)")
        print(
            f"Those reads cost you {(cache_read * 0.1):,.0f} tokens' worth "
            f"instead of {cache_read:,.0f}."
        )

    print(f"\nSame numbers, no code: open {LEDGER.name} in Excel and sum the cost_usd column.\n")
