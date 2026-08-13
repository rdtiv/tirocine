// Part 10.3 — Streaming the assistant, plus Part 11 — Caching.
//
// Run: npm run assistant:streaming
//
// This is src/assistant.ts with exactly three changes. The tutorial has you
// edit that file in place; this repo keeps both so you can run them back to
// back and feel the difference.
//
// What changed from assistant.ts:
//
//   1. messages.create() became messages.stream(), plus one .on('text', ...)
//      line. `await stream.finalMessage()` gives back the same response object.
//
//   2. The `while (response.stop_reason === 'tool_use')` loop became
//      `while (true)` with an early return — because now you need to stream
//      FIRST, then decide whether to continue.
//
//   3. respond() returns void instead of a string, since the text already
//      printed as it arrived. So the caller is `await respond(messages);`
//      with no console.log wrapped around it.
//
// And from Part 11: `cache_control: { type: 'ephemeral' }` on both stream
// calls. That's Anthropic's automatic caching — everything up to the last
// cacheable block is cached, and the marker moves forward as the conversation
// grows. Cache reads cost 0.1x normal input price.
//
// VERIFY IT, because silence is the failure mode. Check usage:
//   cache_read_input_tokens      — reused from cache (cheap)
//   cache_creation_input_tokens  — written to cache this call
//   input_tokens                 — ONLY the tokens after the last cache marker
//
// If both cache fields are 0, nothing cached — you're almost certainly under
// the minimum, which is 1,024 tokens for Sonnet 5. Below the threshold you get
// no caching, no error, and no warning. Set LOG_USAGE=1 to watch it:
//   LOG_USAGE=1 npm run assistant:streaming        (macOS / Linux)
//   $env:LOG_USAGE=1; npm run assistant:streaming  (PowerShell)

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'node:readline/promises';
import { getWeather } from './weather.js';
import { MODEL } from './config.js';

// Part 12 — the client options are configured once, here, where the client is
// created. The SDK already retries connection failures, 408, 409, 429 and 5xx
// twice by default; this makes it three with a hard 60s ceiling per call.
const client = new Anthropic({
  maxRetries: 3,
  timeout: 60_000,
});

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

function logUsage(usage: Anthropic.Usage): void {
  if (!process.env.LOG_USAGE) return;
  console.log(
    `\n[usage] input=${usage.input_tokens} output=${usage.output_tokens} ` +
      `cache_read=${usage.cache_read_input_tokens ?? 0} ` +
      `cache_write=${usage.cache_creation_input_tokens ?? 0}`,
  );
}

/** Streams tokens as they arrive, then handles any tool calls, then repeats. */
async function respond(messages: Anthropic.MessageParam[]): Promise<void> {
  while (true) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 1024,
      cache_control: { type: 'ephemeral' },
      system: SYSTEM,
      tools,
      messages,
    });

    // Fires once per chunk of text, as it arrives. process.stdout.write rather
    // than console.log, because console.log adds a newline every time.
    stream.on('text', (delta) => process.stdout.write(delta));

    const response = await stream.finalMessage();
    logUsage(response.usage);
    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason !== 'tool_use') {
      console.log('\n');
      return;
    }

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
  }
}

const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Weather assistant (streaming). Ask me anything. Type "exit" to quit.\n');

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
    console.log();
    await respond(messages);
  } catch (err) {
    // Part 12 — distinguish an API failure from a bug in your own code.
    if (err instanceof Anthropic.APIError) {
      console.error(`\nAPI error ${err.status}: ${err.message}\n`);
    } else {
      console.error(`\nSomething went wrong: ${(err as Error).message}\n`);
    }
    messages.pop();
  }
}

rl.close();
