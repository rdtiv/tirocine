"""Part 7 — Try the weather client.

Run: uv run weather

Then change 'New York' to a location that doesn't exist — 'Xyzzyville' — and
watch your error message fire. Good code fails clearly.
"""

import json

from .weather import get_weather


def main() -> None:
    weather = get_weather("New York")

    # A sentence, not a data dump.
    print(f"{weather.location}: {weather.temp_f}°F, {weather.condition}")

    # Print raw objects while you're figuring out what's in them; print
    # formatted strings once you know. indent=2 means "indent each level by
    # two spaces." model_dump() turns the pydantic model back into a plain
    # dict, the way JSON.stringify(weather, ...) works directly on a plain
    # object in TypeScript — Python needs that one extra step because
    # `weather` here is a model instance, not a dict.
    # ensure_ascii=False: json.dumps defaults to escaping every non-ASCII
    # character as a \uXXXX sequence, unlike JSON.stringify in TypeScript,
    # which leaves the character alone. Without this, a location like
    # "Zürich" would print differently here than in src/weather-test.ts.
    print(json.dumps(weather.model_dump(), indent=2, ensure_ascii=False))
