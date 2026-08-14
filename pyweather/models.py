"""Bonus — not in the tutorial, but useful on day one.

Run: uv run models

Prints every model ID your API key can actually use, newest first. Use this
to verify the IDs hardcoded in pyweather/config.py and pyweather/bench.py
before you trust them.

This is Part 6's lesson made executable: any document that hardcodes a value
from a live service will eventually be wrong, including the tutorial and
including this repo. Check the source, not the tutorial.

Against src/models.ts, note there's no `for await`. `client.models.list()`
returns a page that fetches lazily but synchronously — the same idea
(don't pull every page up front) without needing an async iterator to do it.
"""

from anthropic import Anthropic


def main() -> None:
    client = Anthropic()

    print("Model IDs available to your API key (newest first):\n")

    for model in client.models.list():
        print(f"  {model.id.ljust(34)} {model.display_name}")

    print(
        "\nIf an ID used in pyweather/config.py or pyweather/bench.py is missing from "
        "this list,\nupdate it there — a wrong model ID fails with a 404 not_found_error."
    )
