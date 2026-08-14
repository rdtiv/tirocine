"""Part 4 — Conversation: you own the memory.
Part 6 — plus the log_call() ledger added at the end of Part 6.

Run: uv run chat

There is no session. A conversation is a list YOU keep, and you resend all
of it every turn. Tell it your name, then ask what your name is. It knows —
not because it remembered, but because you re-sent the transcript.

Watch the [usage] line: `in` and `context` climb every single turn, by
roughly the previous turn's output plus whatever you just typed. That climb
is this Part's lesson showing up as money. Part 11 (caching) is the fix.

Every turn is also appended to usage.csv — run `uv run usage` afterwards, or
open the file in Excel and add up the cost_usd column yourself.

Against src/chat.ts, the loop itself is the interesting difference. Node
needs a `readline` interface plus `await rl.question(...)` because reading a
line of stdin is asynchronous there. Python's `input()` is a built-in,
synchronous, blocking call — no interface to construct, no import beyond the
standard library doing it implicitly. `EOFError` is Python's Ctrl+D (Ctrl+Z
on Windows), the direct equivalent of the `try`/`catch` around `rl.question`.
"""

from anthropic import Anthropic
from anthropic.types import MessageParam

from .text import text_from
from .usage import log_call


def main() -> None:
    client = Anthropic()
    messages: list[MessageParam] = []

    print('Weather assistant. Type "exit" to quit.\n')

    while True:
        try:
            user_input = input("> ")
        except EOFError:
            break  # stdin closed — you pressed Ctrl+D (Ctrl+Z on Windows), or input was piped in and ran out.

        if user_input.strip().lower() == "exit":
            break

        messages.append({"role": "user", "content": user_input})

        response = client.messages.create(
            model="claude-sonnet-5",
            max_tokens=1024,
            system="You are a concise weather assistant.",
            messages=messages,
        )

        log_call("chat", "claude-sonnet-5", user_input, response)

        # Note: there is no try/except around this call yet. If your API key
        # is wrong, this crashes with a stack trace. That's deliberate —
        # pyweather/assistant.py adds a basic rollback try/except at Part 9,
        # and Part 12's real error handling (APIStatusError, APIConnectionError,
        # max_retries, timeout) lives in pyweather/assistant_streaming.py.

        # Push back the whole content list, not a flattened string.
        messages.append({"role": "assistant", "content": response.content})

        print(f"\n{text_from(response)}\n")
