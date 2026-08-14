"""Part 2 / Part 3 — Your first Claude call.

Run: uv run dev

Note that `Anthropic()` takes no arguments. The SDK reads ANTHROPIC_API_KEY
from the environment itself. That's why the key never appears in your code.

Compare src/index.ts: that file is top-level statements, because Node lets a
module `await` at the top level. Python has no such thing — every runnable
statement here has to live inside a function, so `main()` exists and
pyproject.toml's `[project.scripts]` points `dev` at it. This file is the
first place that lesson shows up; every module after it repeats the pattern.
"""

from anthropic import Anthropic

from .text import text_from
from .usage import log_call


def main() -> None:
    client = Anthropic()

    question = "What is a heat index?"

    message = client.messages.create(
        model="claude-sonnet-5",
        max_tokens=1024,
        messages=[{"role": "user", "content": question}],
    )

    log_call("dev", "claude-sonnet-5", question, message)

    print(text_from(message))

    # -------------------------------------------------------------------
    # Part 2 originally had you print the whole object, to see its shape:
    #
    #   print(message)
    #
    # Uncomment that line and comment out the text_from() line above if you
    # want to see the raw response again. Reading that object is the whole
    # point of Part 3 — the `content` list, `stop_reason`, and `usage` all
    # live in there.
    # -------------------------------------------------------------------
