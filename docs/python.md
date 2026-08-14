# Weatherwise — The Same Program in Python

> **The weatherwise series**
> 1. Setup — [Windows](setup-windows.md) · [macOS](setup-mac.md)
> 2. [The TypeScript build](typescript.md) — the assistant, start to finish
> 3. [The Grok transfer](grok.md) — the same assistant against xAI
> 4. **The Python build** — the same program again, to see which ideas were real *(you are here)*
> 5. [The app](app.md) — lifting it onto the web with Next.js, the AI SDK, and Vercel

**Before you start:** finish [the TypeScript build](typescript.md). This document assumes you already have `src/weather.ts`, `src/agent.ts`, and the rest in front of you to compare against — the whole point is the comparison.

> **This document is mid-rework.** The walkthrough below is sound, but two
> things are outstanding and worth knowing before you rely on it:
>
> - **There is no `pyweather/` companion code in this repo yet.** Every other
>   document in the series has code in `src/` you can run and diff against.
>   This one does not, so nothing here is verified the way the TypeScript is.
> - **The usage ledger has no Python equivalent.** The TypeScript build now
>   records every call to `usage.csv` and totals it with `npm run usage`. That
>   is a real part of the program, and this document predates it.
>
> Both are queued. Until then, treat the code here as illustrative rather than
> as something to build on.

---

You've built a working thing in TypeScript. Now build the important parts of it again in Python, and pay attention to how little you have to re-learn.

**This is not a second tutorial.** No new concepts appear here. Every idea — stateless calls, content blocks, stop reasons, schemas, the tool loop — is already in your head. The only thing changing is spelling.

That's the point. If you only ever see one language, you can't tell which of the things you learned are real and which are just how TypeScript happens to write them. Seeing the same program twice separates the two permanently.

Python is also worth knowing on its own: it's the default language of data work and machine learning, and a lot of AI tooling appears there first.

## 1. Set up

`uv` is Python's modern toolchain. It installs Python itself, manages dependencies, and handles virtual environments without you thinking about them.

```powershell
winget install --id astral-sh.uv --exact
```

**Close Terminal and open a new one**, then from your project folder:

```powershell
cd C:\dev\weatherwise
uv init --python 3.13 pyweather
cd pyweather
uv add anthropic httpx pydantic
```

Copy your `.env` up one level so both versions share it — or simpler, just make a second copy:

```powershell
copy ..\.env .env
```

Run any Python file with `uv run`:

```powershell
uv run --env-file .env main.py
```

> **Why `uv run` and not `python`.** Python projects each need their own isolated set of packages, called a virtual environment. Traditionally you activate one by hand, and on Windows that runs headfirst into PowerShell's script execution policy — a classic beginner wall. `uv run` creates and uses the environment automatically. There is nothing to activate and nothing to remember.

## 2. The weather client

Compare this to `src/weather.ts` from [the TypeScript build](typescript.md) side by side in Cursor. Same shape, different spelling.

```python
import os
from dataclasses import dataclass

import httpx


@dataclass
class Weather:
    location: str
    region: str
    temp_f: float
    temp_c: float
    condition: str
    wind_mph: float
    humidity: int
    feels_like_f: float


def get_weather(location: str) -> Weather:
    api_key = os.environ.get("WEATHER_API_KEY")
    if not api_key:
        raise RuntimeError("WEATHER_API_KEY is not set in .env")

    response = httpx.get(
        "https://api.weatherapi.com/v1/current.json",
        params={"key": api_key, "q": location},
    )

    if response.status_code != 200:
        raise RuntimeError(
            f"Weather API returned {response.status_code} for {location!r}"
        )

    data = response.json()
    return Weather(
        location=data["location"]["name"],
        region=data["location"]["region"],
        temp_f=data["current"]["temp_f"],
        temp_c=data["current"]["temp_c"],
        condition=data["current"]["condition"]["text"],
        wind_mph=data["current"]["wind_mph"],
        humidity=data["current"]["humidity"],
        feels_like_f=data["current"]["feelslike_f"],
    )
```

What changed, and what didn't:

| TypeScript | Python | Same idea? |
|---|---|---|
| `interface Weather` | `@dataclass class Weather` | Yes — a named shape |
| `fetch(url)` | `httpx.get(url)` | Yes — an HTTP request |
| `URLSearchParams` | `params={...}` | Yes — safe URL encoding |
| `if (!response.ok)` | `if response.status_code != 200` | Yes — check before trusting |
| `throw new Error(...)` | `raise RuntimeError(...)` | Yes |
| `await` | *(nothing)* | **No — see below** |

**The one real difference: `await` is gone.** The TypeScript version is asynchronous — it hands control back while waiting on the network. This Python version is synchronous — it simply blocks until the response arrives. For a command-line script, blocking is fine and simpler. Python has async too (`async def` and `await`, nearly identical to TypeScript), and you'd reach for it when handling many requests at once.

Notice you did **not** have to relearn what an API is, why the key comes from the environment, or why you check the status before parsing. Those were never TypeScript facts.

## 3. Structured output

```python
from typing import Literal

import anthropic
from pydantic import BaseModel

client = anthropic.Anthropic()


class WeatherRequest(BaseModel):
    location: str
    units: Literal["fahrenheit", "celsius"]
    intent: Literal["current_conditions", "forecast", "clothing_advice", "other"]


message = client.messages.parse(
    model="claude-sonnet-5",
    max_tokens=1024,
    system=(
        "Extract the structured weather request. The location must be a plain "
        "city name suitable for a weather API lookup."
    ),
    messages=[{"role": "user", "content": "do I need a jacket in Chicago this evening?"}],
    output_format=WeatherRequest,
)

if message.parsed_output is None:
    raise RuntimeError(f"No structured output (stop_reason: {message.stop_reason})")

request: WeatherRequest = message.parsed_output
print(request)
```

This one is arguably cleaner than the TypeScript. `zod` in TypeScript and `pydantic` in Python do the same job — describe a data shape and validate against it — but here you hand the class straight to `output_format` with no wrapper helper.

Everything else is identical, including the name `parsed_output` and the null check guarding against refusals and truncation. The same trap exists in both languages, so the same guard is required in both.

## 4. The tool loop

The heart of the whole project:

```python
import json

import anthropic

from weather import get_weather

client = anthropic.Anthropic()

tools: list[anthropic.types.ToolParam] = [
    {
        "name": "get_weather",
        "description": (
            "Get current weather conditions for a city or place. Returns temperature "
            "in both Fahrenheit and Celsius, sky conditions, wind speed, humidity, and "
            "what the temperature feels like. Use this whenever the user asks about "
            "weather, temperature, or what to wear somewhere."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "location": {
                    "type": "string",
                    "description": 'A city name, e.g. "Denver". US ZIP codes also work.',
                }
            },
            "required": ["location"],
        },
    }
]

SYSTEM = "You are a concise weather assistant. Answer directly and briefly."


def run_tool(name: str, tool_input: dict) -> str:
    if name != "get_weather":
        raise RuntimeError(f"Unknown tool: {name}")
    weather = get_weather(tool_input["location"])
    return json.dumps(weather.__dict__)


messages: list[anthropic.types.MessageParam] = [
    {"role": "user", "content": "Do I need a jacket in Chicago right now?"}
]

response = client.messages.create(
    model="claude-sonnet-5",
    max_tokens=1024,
    system=SYSTEM,
    tools=tools,
    messages=messages,
)

while response.stop_reason == "tool_use":
    messages.append({"role": "assistant", "content": response.content})

    results: list[anthropic.types.ToolResultBlockParam] = []

    for block in response.content:
        if block.type != "tool_use":
            continue

        print(f"[tool] {block.name}", block.input)

        try:
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": run_tool(block.name, dict(block.input)),
                }
            )
        except Exception as err:
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
        model="claude-sonnet-5",
        max_tokens=1024,
        system=SYSTEM,
        tools=tools,
        messages=messages,
    )

print("\n".join(b.text for b in response.content if b.type == "text"))
```

Read that against `src/agent.ts` from the TypeScript build. The structure is line-for-line the same:

- Same tool schema, written as a dict instead of an object
- Same `while response.stop_reason == "tool_use"` loop
- Same iteration over content blocks, skipping non-tool blocks
- Same `tool_use_id` echoed back exactly
- Same errors returned as results with `is_error`, never thrown out of the loop

Run it. You get the same answer about the jacket.

```powershell
uv run --env-file .env agent.py
```

## 5. What this proves

Go back and count what was actually different: `await`, dict syntax instead of object syntax, `snake_case` instead of `camelCase`, and `raise` instead of `throw`.

Everything that *mattered* — the request shape, content blocks as a list, stop reasons as control flow, schemas over parsing, the agentic loop, errors as tool results — was unchanged. Those aren't TypeScript concepts or Python concepts. They're how the Claude API works, and they'd look the same in Go, Rust, or Java.

**This is the most valuable thing in this document.** Programmers who only know one language tend to confuse their language's habits with how software works. You now have a concrete example of the line between the two. When you learn your third language, you'll find you already know most of it.

## Which one should you use?

Neither is better. They're good at different things:

- **TypeScript** — anything with a web interface, since it's the only language browsers run. Types catch mistakes before the program runs.
- **Python** — data analysis, machine learning, scripting, automation. Less ceremony, enormous scientific library ecosystem.

Real teams use both. Pick per project, not per person.

> **Good Claude Code task:** `Port src/bench.ts to Python as pyweather/bench.py, keeping the same output format.` You understand both sides now, so you can verify the result properly — which is exactly the kind of delegation the TypeScript build described in its Part 1.

---
