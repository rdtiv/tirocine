"""Part 9 — Tools: handing your function to Claude.

Run: uv run agent

The contract, stated plainly: THE MODEL NEVER EXECUTES ANYTHING. It emits a
structured request; your code runs it; the result goes back into the
conversation. Claude never sees your implementation — only the schema you
described and the value you returned.

The loop:
  1. Send a request with a `tools` list.
  2. Claude replies with stop_reason "tool_use" and one or more tool_use
     blocks.
  3. You run each one.
  4. You send everything back — history, Claude's response, and a user
     message of tool_result blocks.
  5. Repeat while stop_reason == "tool_use".

Things to try, one at a time — change the question below:
  "What's the weather in Tokyo and London?"  -> two tool calls in one turn
  "What's the weather in Xyzzyville?"        -> tool raises, Claude recovers
  "What's the capital of France?"            -> no tool call at all
"""

from typing import cast

from anthropic import Anthropic
from anthropic.types import MessageParam, ToolParam, ToolResultBlockParam

from .config import MODEL
from .text import text_from
from .usage import log_call
from .weather import get_weather

SYSTEM = "You are a concise weather assistant. Answer directly and briefly."

TOOLS: list[ToolParam] = [
    {
        "name": "get_weather",
        # The description is the most important string in this file. It is
        # the only documentation the model gets. "Gets weather" produces bad
        # tool selection.
        "description": (
            "Get current weather conditions for a city or place. Returns "
            "temperature in both Fahrenheit and Celsius, sky conditions, "
            "wind speed, humidity, and what the temperature feels like. Use "
            "this whenever the user asks about weather, temperature, or "
            "what to wear somewhere."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": 'A city name, e.g. "Denver" or "New York". US ZIP codes also work.',
                },
            },
            "required": ["location"],
        },
    },
]


def run_tool(name: str, tool_input: dict[str, object]) -> str:
    if name != "get_weather":
        raise ValueError(f"Unknown tool: {name}")

    # ToolUseBlock.input is typed as dict[str, object] — the SDK can't know
    # your tool's shape. cast() is Python's version of TypeScript's
    # `input as { location: string }`: a promise to the type checker, not a
    # runtime check. If the model sends a malformed input, this fails inside
    # get_weather(), not here.
    location = cast(str, tool_input["location"])
    weather = get_weather(location)
    return weather.model_dump_json()


def main() -> None:
    client = Anthropic()

    question = "Do I need a jacket in Chicago right now?"

    messages: list[MessageParam] = [{"role": "user", "content": question}]

    response = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=SYSTEM,
        tools=TOOLS,
        messages=messages,
    )

    # One question costs TWO calls once a tool is involved — you'll see both
    # rows in usage.csv, and the second one's input is bigger because it
    # carries the first response plus the tool result.
    log_call("agent", MODEL, question, response)

    while response.stop_reason == "tool_use":
        messages.append({"role": "assistant", "content": response.content})

        results: list[ToolResultBlockParam] = []

        # Claude can call several tools in one turn. Loop over every block;
        # never assume one.
        for block in response.content:
            if block.type != "tool_use":
                continue

            print(f"[tool] {block.name}", block.input)

            try:
                results.append(
                    {
                        "type": "tool_result",
                        # tool_use_id must be echoed back exactly. That's how
                        # a result binds to its call.
                        "tool_use_id": block.id,
                        "content": run_tool(block.name, block.input),
                    }
                )
            except Exception as err:
                # Errors go BACK to the model, not up the stack. Raising
                # kills the loop; is_error=True lets the model adapt.
                results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Error: {err}",
                        "is_error": True,
                    }
                )

        messages.append({"role": "user", "content": results})

        response = client.messages.create(
            model=MODEL,
            max_tokens=1024,
            system=SYSTEM,
            tools=TOOLS,
            messages=messages,
        )

        log_call("agent", MODEL, question, response)

    print(text_from(response))
