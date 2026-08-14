"""Part 6, Lab — Haiku vs Sonnet vs Opus.

Run: uv run bench

Runs the same three tasks against all three models and reports how long each
took, what it cost, and what it answered. The tasks get progressively harder
on purpose. The whole run costs a few cents — most of it Opus on the hard
task, which reasons before it answers.

What to look for:
  - On the easy task all three get it right. Compare time and price.
  - On the hard task, watch for a split. The correct answer is 18 minutes.
  - Watch output token counts on the hard task — bigger models spend more
    tokens reasoning before answering. That's what you're paying for.
"""

import time
from typing import NamedTuple

from anthropic import Anthropic

from .text import text_from
from .usage import PricedModel, cost_of, log_call

# No prices here — they live in ONE place, pyweather/usage.py. A second copy
# of a price table is a second thing to forget to update.
MODELS: list[tuple[PricedModel, str]] = [
    ("claude-haiku-4-5-20251001", "Haiku 4.5"),
    ("claude-sonnet-5", "Sonnet 5"),
    ("claude-opus-5", "Opus 5"),
]

TASKS = [
    {
        "name": "Easy — classify",
        "description": "One-word classification. Every model should nail this.",
        "prompt": (
            'Classify the weather condition "light drizzle, 51F" as one of: '
            "clear, wet, cold, severe. Reply with one word only."
        ),
    },
    {
        "name": "Medium — extract",
        "description": "Pull structured facts out of a sentence with no math or logic involved.",
        "prompt": (
            "From this note, list every city mentioned, comma separated, nothing else: "
            '"Flying Dallas to Denver Tuesday, then driving up to Boulder. '
            'Weather in Denver looks rough but Fort Collins is clear."'
        ),
    },
    {
        "name": "Hard — reason",
        "description": "Multi-step word problem. Correct answer is 18 minutes — watch for a split.",
        "prompt": (
            "A tank holds 210 liters and starts with 30 liters. It fills at 12 L/min "
            "and simultaneously drains at 4.5 L/min. After exactly 8 minutes the drain "
            "is closed. At what time from the start does the tank overflow? "
            "Give the answer in minutes."
        ),
    },
]


class Result(NamedTuple):
    model: str
    task: str
    seconds: float
    output_tokens: int
    cents: float
    answer: str


ANSWER_INDENT = "           "  # lines up under the model-name column below
WRAP_WIDTH = 100


def print_answer(text: str) -> None:
    """Prints text word-wrapped at WRAP_WIDTH, with every line indented —
    unlike relying on the terminal to soft-wrap, this keeps long answers
    aligned."""
    words = text.split(" ")
    line = ""

    for word in words:
        candidate = f"{line} {word}" if line else word
        if len(candidate) > WRAP_WIDTH - len(ANSWER_INDENT) and line:
            print(ANSWER_INDENT + line)
            line = word
        else:
            line = candidate
    if line:
        print(ANSWER_INDENT + line)


def main() -> None:
    client = Anthropic()
    results: list[Result] = []

    for task in TASKS:
        print(f"\n=== {task['name']} ===")
        print(f"{task['description']}\n")
        print(f"Prompt: {task['prompt']}\n")

        for model_id, model_name in MODELS:
            started = time.monotonic()

            message = client.messages.create(
                model=model_id,
                max_tokens=2048,
                messages=[{"role": "user", "content": task["prompt"]}],
            )

            seconds = time.monotonic() - started
            cents = cost_of(model_id, message.usage) * 100

            # print_summary=False — this script formats its own table just below.
            log_call("bench", model_id, task["prompt"], message, print_summary=False)

            answer = " ".join(text_from(message).split())

            results.append(
                Result(
                    model=model_name,
                    task=task["name"],
                    seconds=seconds,
                    output_tokens=message.usage.output_tokens,
                    cents=cents,
                    answer=answer,
                )
            )

            print(
                f"{model_name.ljust(10)} {f'{seconds:.1f}'.rjust(5)}s  "
                f"{str(message.usage.output_tokens).rjust(5)} out tok  "
                f"{f'{cents:.4f}'.rjust(8)}¢"
            )
            print_answer(answer)
            print()

    print("\n=== Totals across all three tasks ===")
    for _model_id, model_name in MODELS:
        mine = [r for r in results if r.model == model_name]
        total_seconds = sum(r.seconds for r in mine)
        total_cents = sum(r.cents for r in mine)

        print(
            f"{model_name.ljust(10)} {f'{total_seconds:.1f}'.rjust(5)}s  "
            f"{f'{total_cents:.4f}'.rjust(8)}¢  "
            f"({(total_cents / 100 * 1000):.2f} dollars per 1000 runs)"
        )

    print("\nThe correct answer to the hard task is 18 minutes.")
