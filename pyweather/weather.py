"""Part 7 — The same call in Python. No AI in this file at all.

Four ideas in here, and all four transfer to every API you'll ever call:

  1. `httpx.get` makes the HTTP request — same thing curl.exe did, from code.
  2. There is no `await`. This is the one real difference from TypeScript.
  3. The status check is one you cannot skip. httpx does NOT raise on a 401 or
     404; it hands you a response with a bad status and moves on. (Same as
     fetch. Same as almost every HTTP client.)
  4. The two shapes do different jobs. WeatherApiResponse describes what the
     SERVICE sends. Weather is what YOUR program uses. Keeping them separate
     means switching providers changes one file.

On the fourth point, compare src/weather.ts: it uses two `interface`
declarations, which vanish at compile time. Here they are pydantic models,
which exist at runtime and actually validate the JSON. That is a real
difference in kind, not just syntax — TypeScript's `as WeatherApiResponse` is
a promise you make to the compiler, while `.model_validate()` is a check.
"""

import os

import httpx
from pydantic import BaseModel


class Weather(BaseModel):
    """What your program uses."""

    location: str
    region: str
    temp_f: float
    temp_c: float
    condition: str
    wind_mph: float
    humidity: int
    feels_like_f: float


class _ApiLocation(BaseModel):
    name: str
    region: str


class _ApiCondition(BaseModel):
    text: str


class _ApiCurrent(BaseModel):
    temp_f: float
    temp_c: float
    condition: _ApiCondition
    wind_mph: float
    humidity: int
    feelslike_f: float


class WeatherApiResponse(BaseModel):
    """What WeatherAPI.com actually sends back — their shape, their naming."""

    location: _ApiLocation
    current: _ApiCurrent


def get_weather(location: str) -> Weather:
    # The model chooses this argument, so treat it as untrusted input like any
    # other. An empty string would otherwise become a real HTTP lookup for
    # nothing. Part 9's tool loop turns this into an is_error tool result, so
    # Claude sees a usable complaint instead of a confusing 400.
    if not location:
        raise ValueError("get_weather() requires a non-empty location")

    api_key = os.environ.get("WEATHER_API_KEY")
    if not api_key:
        raise RuntimeError("WEATHER_API_KEY is not set in .env")

    # params={...} handles the percent-encoding for you, the way
    # URLSearchParams does in the TypeScript version.
    #
    # httpx ships two defaults that fetch() in src/weather.ts does not: a
    # 5-second timeout, and no automatic following of redirects. Both are
    # arguably SAFER defaults than fetch's "wait forever, follow anything" —
    # but this tutorial's whole point is that the two languages run the same
    # program, so this is one of the few places that claim needed help.
    # follow_redirects=True matches fetch's behavior; the explicit (longer)
    # timeout replaces httpx's silent 5-second one so a slow response fails
    # the same way for both readers instead of surprising only this one.
    try:
        response = httpx.get(
            "https://api.weatherapi.com/v1/current.json",
            params={"key": api_key, "q": location},
            timeout=10.0,
            follow_redirects=True,
        )
    except httpx.TimeoutException as err:
        # httpx.TimeoutException carries `.request.url`, which contains
        # WEATHER_API_KEY as a query parameter — the same reason the status
        # check below never puts the URL in its message. Re-raise without it.
        raise RuntimeError(f'Weather API timed out for "{location}"') from err

    # is_success is true for any 2xx, which is exactly what `response.ok`
    # means in src/weather.ts. `status_code != 200` would look equivalent and
    # is not: it rejects a 204 the TypeScript build accepts.
    if not response.is_success:
        # Don't include the URL in this message — it contains your API key.
        raise RuntimeError(f'Weather API returned {response.status_code} for "{location}"')

    data = WeatherApiResponse.model_validate(response.json())

    # Note feelslike_f -> feels_like_f. Their naming on the left, ours on the
    # right. This line is the entire reason the two shapes are separate.
    return Weather(
        location=data.location.name,
        region=data.location.region,
        temp_f=data.current.temp_f,
        temp_c=data.current.temp_c,
        condition=data.current.condition.text,
        wind_mph=data.current.wind_mph,
        humidity=data.current.humidity,
        feels_like_f=data.current.feelslike_f,
    )
