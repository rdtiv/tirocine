// Who runs the tool.
//
// Run: npm run grok:search
//
// Two demonstrations, one file.
//
// (1) web_search only. One create. No while. xAI ran the search on their
//     servers — you never saw a function_call, so there is nothing to execute.
// (2) web_search + get_weather. Loop ONLY on function_call. A web_search_call
//     item is a receipt, not a request. If you while on every tool-shaped
//     item you will spin forever waiting to "run" a search that already ran.
//
// The $5 / 1,000 search fee is NOT in usage.csv. Token rows only. Watch the
// xAI console for that line item.

import OpenAI from 'openai';
import type { FunctionTool, Response, ResponseInputItem, Tool } from 'openai/resources/responses/responses';
import { getWeather } from './weather.js';
import { textFrom } from './grok-text.js';
import { MODEL } from './grok-config.js';
import { logGrokCall } from './grok-usage.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

const getWeatherTool: FunctionTool = {
  type: 'function',
  name: 'get_weather',
  description:
    'Get current weather conditions for a city or place. Returns temperature ' +
    'in both Fahrenheit and Celsius, sky conditions, wind speed, humidity, and ' +
    'what the temperature feels like. Use this whenever the user asks about ' +
    'weather, temperature, or what to wear somewhere.',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'A city name, e.g. "Denver". US ZIP codes also work.',
      },
    },
    required: ['location'],
  },
  strict: false,
};

async function runTool(name: string, args: unknown): Promise<string> {
  if (name !== 'get_weather') throw new Error(`Unknown tool: ${name}`);
  const { location } = args as { location: string };
  return JSON.stringify(await getWeather(location));
}

function log(prompt: string, response: Response): void {
  if (!response.usage) throw new Error('No usage on response');
  logGrokCall('grok-search', MODEL, prompt, {
    id: response.id,
    usage: response.usage,
    status: response.status,
    reply: textFrom(response),
  });
}

// --- (1) search only. One create. No loop. ---------------------------------

const searchQuestion = 'What is a current top headline about the SpaceX Starship program?';

const searchOnly = await client.responses.create({
  model: MODEL,
  input: searchQuestion,
  store: false,
  tools: [{ type: 'web_search' }],
});

log(searchQuestion, searchOnly);

console.log('--- search only ---');
for (const item of searchOnly.output) {
  console.log(item.type);
  if (item.type !== 'web_search_call') continue;
  console.log(item.action);
  if (item.action.type === 'search') {
    console.log('query:', item.action.query ?? item.action.queries);
    for (const source of item.action.sources ?? []) {
      console.log('  ', source.url);
    }
  }
}
console.log(textFrom(searchOnly));

// --- (2) web_search + get_weather. Loop only function_call. ----------------

const mixedQuestion =
  'Look up a recent weather headline for Chicago, then get the live reading.';

const mixedTools: Tool[] = [{ type: 'web_search' }, getWeatherTool];
const input: ResponseInputItem[] = [{ role: 'user', content: mixedQuestion }];

let response: Response = await client.responses.create({
  model: MODEL,
  input,
  store: false,
  tools: mixedTools,
});

log(mixedQuestion, response);

// Loop only for function_call. web_search_call already ran on their servers.
while (response.output.some((item) => item.type === 'function_call')) {
  input.push(...(response.output as ResponseInputItem[]));

  for (const item of response.output) {
    if (item.type !== 'function_call') continue;

    const args = JSON.parse(item.arguments) as unknown;
    console.log(`[tool] ${item.name}`, args);

    let output: string;
    try {
      output = await runTool(item.name, args);
    } catch (err) {
      output = `Error: ${(err as Error).message}`;
    }

    input.push({
      type: 'function_call_output',
      call_id: item.call_id,
      output,
    });
  }

  response = await client.responses.create({
    model: MODEL,
    input,
    store: false,
    tools: mixedTools,
  });

  log(mixedQuestion, response);
}

console.log('--- mixed ---');
for (const item of response.output) {
  console.log(item.type);
}
console.log(textFrom(response));
