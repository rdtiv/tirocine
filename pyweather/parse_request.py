"""Part 8 — Structured output: stop parsing prose.

Run: uv run parse

get_weather() takes a clean location string, but users type things like
"do I need a jacket in Chicago this evening?". Something has to turn one
into the other.

client.messages.parse(output_format=...) gives you parsed_output that is
already validated AND fully typed. No json.loads(). No retry loop. No
pleading with the prompt to "respond with valid JSON only."

The rule: if you're about to write a regex to pull a decision out of model
output, that decision should have been a schema.

Against src/parse-request.ts: that file passes
`output_config: { format: zodOutputFormat(WeatherRequest) }`, where
zodOutputFormat() converts a zod schema into the wire format the API wants.
Here, output_format=WeatherRequest takes the pydantic model class directly —
no adapter function, because the Python SDK builds the JSON schema from the
pydantic model itself. Both are current and correct; the Python SDK just
needs one fewer step to get there.
"""

from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel, ValidationError

from .config import MODEL
from .usage import log_call


class WeatherRequest(BaseModel):
    location: str
    units: Literal["fahrenheit", "celsius"]
    intent: Literal["current_conditions", "forecast", "clothing_advice", "other"]


def main() -> None:
    client = Anthropic()

    question = "do I need a jacket in Chicago this evening?"

    # client.messages.parse() calls TypeAdapter.validate_json() with no
    # try/except of its own, so a response that doesn't match the schema —
    # truncated by max_tokens, or a refusal that never produced the expected
    # shape — raises pydantic.ValidationError HERE, before log_call() ever
    # sees the response and before we get anywhere near the None check
    # below. This is the actual guard against refusals and truncation.
    try:
        message = client.messages.parse(
            model=MODEL,
            max_tokens=1024,
            system=(
                "Extract the structured weather request. The location must be a "
                "plain city name suitable for a weather API lookup."
            ),
            messages=[{"role": "user", "content": question}],
            output_format=WeatherRequest,
        )
    except ValidationError as err:
        raise RuntimeError(
            "Structured output didn't match the schema — likely a truncated "
            f"or refused response. Original error: {err}"
        ) from err

    log_call("parse", MODEL, question, message)

    # parsed_output is None when the response has no text block at all (e.g.
    # the model stopped without producing one) — NOT refusals or truncation,
    # which raise ValidationError above, well before this line runs.
    if message.parsed_output is None:
        raise RuntimeError(f"No structured output (stop_reason: {message.stop_reason})")

    request: WeatherRequest = message.parsed_output
    print(request.model_dump_json(indent=2))
    # { "location": "Chicago", "units": "fahrenheit", "intent": "clothing_advice" }
