// Streaming: making it feel fast.
//
// Run: npm run grok:stream
//
// The model generates at the same rate either way. The difference is entirely
// in when you're allowed to see it. Teach this one path:
//   client.responses.create({ stream: true })
// Events to handle: response.output_text.delta (write it) and
// response.completed (usage lives here). Same tokens, same price.

import OpenAI from 'openai';
import { MODEL } from './grok-config.js';
import { logGrokCall } from './grok-usage.js';
import { textFrom } from './grok-text.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

const question = 'Explain in detail how a hurricane forms.';

const stream = await client.responses.create({
  model: MODEL,
  input: question,
  store: false,
  stream: true,
});

let completed: OpenAI.Responses.Response | undefined;

for await (const event of stream) {
  if (event.type === 'response.output_text.delta') {
    process.stdout.write(event.delta);
  }
  if (event.type === 'response.completed') {
    completed = event.response;
  }
}

if (!completed) throw new Error('Stream ended without response.completed');
if (!completed.usage) throw new Error('No usage on response');

console.log(`\n\n[${completed.status}] ${completed.usage.output_tokens} output tokens`);

// Streaming changes WHEN you see the text, not what it costs. This row in
// usage.csv looks exactly like a non-streaming one.
logGrokCall('grok-stream', MODEL, question, {
  id: completed.id,
  usage: completed.usage,
  status: completed.status,
  reply: textFrom(completed),
});
