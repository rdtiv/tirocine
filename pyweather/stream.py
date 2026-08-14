"""Part 10.1 — Streaming: making it feel fast.

Run: uv run stream

The model generates at the same rate either way. The difference is entirely
in when you're allowed to see it. Eight seconds of blank screen feels
broken. Eight seconds of text arriving feels like thinking.

Streaming does NOT change cost and does NOT change the content. Same
tokens, same price, same answer — delivered differently.

Against src/stream.ts: that file registers a callback with
`stream.on('text', ...)` and awaits `stream.finalMessage()`. The Python
client shapes the same idea as a context manager and an iterator instead:
`with client.messages.stream(...) as stream:` opens the connection and
closes it when the block exits, and `stream.text_stream` is a plain
iterator you loop over with `for`. No event listener to register — the
loop IS the subscription.
"""

from anthropic import Anthropic

from .config import MODEL
from .usage import log_call


def main() -> None:
    client = Anthropic()

    question = "Explain in detail how a hurricane forms."

    with client.messages.stream(
        model=MODEL,
        max_tokens=1024,
        messages=[{"role": "user", "content": question}],
    ) as stream:
        # Fires once per chunk of text, as it arrives.
        for text in stream.text_stream:
            print(text, end="", flush=True)

    # Same shape messages.create() returns, with stop_reason and usage
    # intact. You get the incremental display AND the complete object. You
    # don't choose.
    final = stream.get_final_message()

    print(f"\n\n[{final.stop_reason}] {final.usage.output_tokens} output tokens")

    # Streaming changes WHEN you see the text, not what it costs. This row
    # in usage.csv looks exactly like a non-streaming one.
    log_call("stream", MODEL, question, final)
