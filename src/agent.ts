// Part 9 — Tools: handing your function to Claude.
//
// Run: npm run agent
//
// The contract, stated plainly: THE MODEL NEVER EXECUTES ANYTHING. It emits a
// structured request; your code runs it; the result goes back into the
// conversation. Claude never sees your implementation — only the schema you
// described and the value you returned.
//
// The loop:
//   1. Send a request with a `tools` array.
//   2. Claude replies with stop_reason: "tool_use" and one or more tool_use blocks.
//   3. You run each one.
//   4. You send everything back — history, Claude's response, and a user
//      message of tool_result blocks.
//   5. Repeat while stop_reason === "tool_use".
//
// Things to try, one at a time — change the question below:
//   "What's the weather in Tokyo and London?"  -> two tool calls in one turn
//   "What's the weather in Xyzzyville?"        -> tool throws, Claude recovers
//   "What's the capital of France?"            -> no tool call at all

import Anthropic from '@anthropic-ai/sdk';
import { getWeather } from './weather.js';
import { textFrom } from './text.js';
import { MODEL } from './config.js';

const client = new Anthropic();

const SYSTEM = 'You are a concise weather assistant. Answer directly and briefly.';

const tools: Anthropic.Tool[] = [
  {
    name: 'get_weather',
    // The description is the most important string in this file. It is the only
    // documentation the model gets. "Gets weather" produces bad tool selection.
    description:
      'Get current weather conditions for a city or place. Returns temperature ' +
      'in both Fahrenheit and Celsius, sky conditions, wind speed, humidity, and ' +
      'what the temperature feels like. Use this whenever the user asks about ' +
      'weather, temperature, or what to wear somewhere.',
    input_schema: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: 'A city name, e.g. "Denver" or "New York". US ZIP codes also work.',
        },
      },
      required: ['location'],
    },
  },
];

async function runTool(name: string, input: unknown): Promise<string> {
  if (name !== 'get_weather') throw new Error(`Unknown tool: ${name}`);

  const { location } = input as { location: string };
  const weather = await getWeather(location);
  return JSON.stringify(weather);
}

const messages: Anthropic.MessageParam[] = [
  { role: 'user', content: 'Do I need a jacket in Chicago right now?' },
];

let response = await client.messages.create({
  model: MODEL,
  max_tokens: 1024,
  system: SYSTEM,
  tools,
  messages,
});

while (response.stop_reason === 'tool_use') {
  messages.push({ role: 'assistant', content: response.content });

  const results: Anthropic.ToolResultBlockParam[] = [];

  // Claude can call several tools in one turn. Loop over every block;
  // never assume one.
  for (const block of response.content) {
    if (block.type !== 'tool_use') continue;

    console.log(`[tool] ${block.name}`, block.input);

    try {
      results.push({
        type: 'tool_result',
        // tool_use_id must be echoed back exactly. That's how a result binds
        // to its call.
        tool_use_id: block.id,
        content: await runTool(block.name, block.input),
      });
    } catch (err) {
      // Errors go BACK to the model, not up the stack. Throwing kills the
      // loop; is_error: true lets the model adapt.
      results.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: `Error: ${(err as Error).message}`,
        is_error: true,
      });
    }
  }

  messages.push({ role: 'user', content: results });

  response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools,
    messages,
  });
}

console.log(textFrom(response));
