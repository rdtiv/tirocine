// Part 7 — The same call in TypeScript. No AI in this file at all.
//
// Five ideas in here, and all five transfer to every API you'll ever call:
//
//   1. `fetch` makes the HTTP request — same thing curl.exe did, from code.
//   2. `await` waits for the network.
//   3. `response.ok` is a check you cannot skip. fetch does NOT throw on a
//      401 or 404; it hands you a response with a bad status and moves on.
//   4. The time limit is yours to set. fetch does have a default, but it is
//      undici's 300 seconds — say the limit out loud instead of inheriting it.
//   5. The two interfaces do different jobs. WeatherApiResponse describes what
//      the SERVICE sends. Weather is what YOUR program uses. Keeping them
//      separate means switching providers changes one file.

/** What your program uses. */
export interface Weather {
  location: string;
  region: string;
  temp_f: number;
  temp_c: number;
  condition: string;
  wind_mph: number;
  humidity: number;
  feels_like_f: number;
}

/** What WeatherAPI.com actually sends back — their shape, their naming. */
interface WeatherApiResponse {
  location: { name: string; region: string };
  current: {
    temp_f: number;
    temp_c: number;
    condition: { text: string };
    wind_mph: number;
    humidity: number;
    feelslike_f: number;
  };
}

export async function getWeather(location: string): Promise<Weather> {
  // A caller that cast an untyped tool input (see agent.ts's runTool) can
  // hand this an empty string or `undefined` at runtime even though the type
  // signature promises `string`. Fail before the request — otherwise this
  // becomes a real HTTP lookup for the literal city "undefined".
  if (!location) throw new Error('getWeather() requires a non-empty location');

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) throw new Error('WEATHER_API_KEY is not set in .env');

  // URLSearchParams handles the percent-encoding for you.
  const params = new URLSearchParams({ key: apiKey, q: location });
  const url = `https://api.weatherapi.com/v1/current.json?${params}`;

  // fetch's default timeout is not one you'd want to inherit: undici, the HTTP
  // engine behind it, gives up after 300 seconds. httpx (the Python build)
  // gives up after 5. Both builds say 10s out loud, so the number comes from
  // the program rather than from whichever engine is underneath — and a server
  // that goes quiet doesn't take Part 9's tool loop down with it.
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) {
    // Don't include `url` in this message — it contains your API key.
    throw new Error(`Weather API returned ${response.status} for "${location}"`);
  }

  const data = (await response.json()) as WeatherApiResponse;

  return {
    location: data.location.name,
    region: data.location.region,
    temp_f: data.current.temp_f,
    temp_c: data.current.temp_c,
    condition: data.current.condition.text,
    wind_mph: data.current.wind_mph,
    humidity: data.current.humidity,
    feels_like_f: data.current.feelslike_f,
  };
}
