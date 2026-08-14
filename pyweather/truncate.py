"""Part 5 — Stop reasons: the branch you must not skip.

Run: uv run truncate

The max_tokens case is the quiet one. HTTP 200. Real text. It just stops
mid-sentence — and if you were parsing it, it breaks.

Check stop_reason BEFORE you trust the payload.
"""

from anthropic import Anthropic

from .text import text_from
from .usage import log_call


def main() -> None:
    client = Anthropic()

    question = "Write 400 words about how hurricanes form."

    message = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=30,  # deliberately far too small
        messages=[{"role": "user", "content": question}],
    )

    # The ledger records stop_reason too — this run is the one that writes
    # `max_tokens` into usage.csv instead of `end_turn`.
    log_call("truncate", "claude-sonnet-5", question, message)

    print(text_from(message))
    print("\nstop_reason:", message.stop_reason)

    if message.stop_reason == "max_tokens":
        print("Truncated. This text is incomplete and unsafe to parse.")
