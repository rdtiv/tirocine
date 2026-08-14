// Tools: handing your function to Grok.
//
// Run: npm run grok:agent
//
// The contract has not changed: THE MODEL NEVER EXECUTES YOUR FUNCTION. It
// emits a structured request; your code runs it; the result goes back. What
// changed is the spelling:
//   - item.type === 'function_call'  (not tool_use)
//   - item.arguments is a JSON string (not an input object)
//   - item.call_id binds the result   (not tool_use_id)
//   - you send { type: 'function_call_output', call_id, output }
//
// store: false, so you accumulate `input` yourself. Same memory lesson as
// grok-chat.ts. Never assume one function_call per turn.
//
// Things to try, one at a time — change the question below:
//   "What's the weather in Tokyo and London?"  -> two function_call items
//   "What's the weather in Xyzzyville?"        -> tool throws, Grok recovers
//   "What's the capital of France?"            -> no function_call at all

import OpenAI from 'openai';
import type { FunctionTool, Response, ResponseInputItem } from 'openai/resources/responses/responses';
import { getWeather } from './weather.js';
import { textFrom } from './grok-text.js';
import { MODEL } from './grok-config.js';
import { logGrokCall } from './grok-usage.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

const INSTRUCTIONS = 'You are a concise weather assistant. Answer directly and briefly.';

const tools: FunctionTool[] = [
  {
    type: 'function',
    name: 'get_weather',
    // The description is the most important string in this file. It is the only
    // documentation the model gets. "Gets weather" produces bad tool selection.
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
          description: 'A city name, e.g. "Denver" or "New York". US ZIP codes also work.',
        },
      },
      required: ['location'],
    },
    strict: false,
  },
];

async function runTool(name: string, args: unknown): Promise<string> {
  if (name !== 'get_weather') throw new Error(`Unknown tool: ${name}`);

  const { location } = args as { location: string };
  const weather = await getWeather(location);
  return JSON.stringify(weather);
}

const question = 'Do I need a jacket in Chicago right now?';

const input: ResponseInputItem[] = [{ role: 'user', content: question }];

let response: Response = await client.responses.create({
  model: MODEL,
  input,
  store: false,
  instructions: INSTRUCTIONS,
  tools,
});

if (!response.usage) throw new Error('No usage on response');
logGrokCall('grok-agent', MODEL, question, {
  id: response.id,
  usage: response.usage,
  status: response.status,
  reply: textFrom(response),
});

while (response.output.some((item) => item.type === 'function_call')) {
  input.push(...(response.output as ResponseInputItem[]));

  // Grok can request several functions in one turn. Loop over every item;
  // never assume one. Do not loop on web_search_call — this file has none.
  for (const item of response.output) {
    if (item.type !== 'function_call') continue;

    // arguments is a JSON string. Claude's tool_use.input is already an object.
    const args = JSON.parse(item.arguments) as unknown;
    console.log(`[tool] ${item.name}`, args);

    let output: string;
    try {
      output = await runTool(item.name, args);
    } catch (err) {
      // Errors go BACK to the model, not up the stack. Responses has no
      // is_error flag — the string is enough. Throwing would kill the loop.
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
    instructions: INSTRUCTIONS,
    tools,
  });

  if (!response.usage) throw new Error('No usage on response');
  logGrokCall('grok-agent', MODEL, question, {
    id: response.id,
    usage: response.usage,
    status: response.status,
    reply: textFrom(response),
  });
}

console.log(textFrom(response));
