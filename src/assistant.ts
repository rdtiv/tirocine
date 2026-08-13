// Part 9, "Make it a conversation" — the finished project.
//
// Run: npm run assistant
//
// Part 4 gave you the input loop and conversation history. Part 9 gave you the
// tool loop. This is one nested inside the other.
//
// Try this exact sequence:
//   > what's the weather in Denver
//   > how about Austin
//   > which one should I visit this weekend
//
// That third question has no city in it, and calls no tool. Claude answers from
// the two lookups already sitting in the conversation history. Everything from
// Part 4 about owning the memory and everything from Part 9 about tools is
// working at once.
//
// NOTE: Part 10.3 asks you to convert respond() to streaming, and Part 11 adds
// caching. Rather than overwrite this file, that finished version lives in
// src/assistant-streaming.ts so you can run both and feel the difference:
//   npm run assistant            (this file — waits, then prints all at once)
//   npm run assistant:streaming  (Part 10.3 + Part 11 — types as it goes)

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'node:readline/promises';
import { getWeather } from './weather.js';
import { textFrom } from './text.js';
import { MODEL } from './config.js';

const client = new Anthropic();

const SYSTEM = 'You are a concise weather assistant. Answer directly and briefly.';

const tools: Anthropic.Tool[] = [
  {
    name: 'get_weather',
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
          description: 'A city name, e.g. "Denver". US ZIP codes also work.',
        },
      },
      required: ['location'],
    },
  },
];

async function runTool(name: string, input: unknown): Promise<string> {
  if (name !== 'get_weather') throw new Error(`Unknown tool: ${name}`);
  const { location } = input as { location: string };
  return JSON.stringify(await getWeather(location));
}

/** Runs the tool loop until Claude produces a final answer. */
async function respond(messages: Anthropic.MessageParam[]): Promise<string> {
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

    for (const block of response.content) {
      if (block.type !== 'tool_use') continue;

      console.log(`  ...looking up ${JSON.stringify(block.input)}`);

      try {
        results.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: await runTool(block.name, block.input),
        });
      } catch (err) {
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

  messages.push({ role: 'assistant', content: response.content });
  return textFrom(response);
}

const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Weather assistant. Ask me anything. Type "exit" to quit.\n');

while (true) {
  let input: string;
  try {
    input = await rl.question('> ');
  } catch {
    break; // stdin closed — you pressed Ctrl+D, or input was piped in and ran out.
  }

  const trimmed = input.trim();

  if (trimmed.toLowerCase() === 'exit') break;
  if (trimmed === '') continue;

  messages.push({ role: 'user', content: trimmed });

  try {
    console.log(`\n${await respond(messages)}\n`);
  } catch (err) {
    // Errors don't kill the program. Drop the failed question from history —
    // a conversation containing a user message with no assistant reply is
    // invalid, and the NEXT request would fail too.
    console.error(`\nSomething went wrong: ${(err as Error).message}\n`);
    messages.pop();
  }
}

rl.close();
