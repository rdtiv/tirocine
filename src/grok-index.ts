// Your first Grok call.
//
// Run: npm run grok
//
// Claude's SDK reads ANTHROPIC_API_KEY by itself. The OpenAI SDK does not
// read XAI_API_KEY — you pass it, and you pass the xAI base URL. That's the
// whole client difference.

import OpenAI from 'openai';
import { textFrom } from './grok-text.js';
import { logGrokCall } from './grok-usage.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

const question = 'What is a heat index?';

const response = await client.responses.create({
  model: 'grok-4.6',
  input: question,
  store: false,
});

if (!response.usage) throw new Error('No usage on response');
logGrokCall('grok', 'grok-4.6', question, {
  id: response.id,
  usage: response.usage,
  status: response.status,
  reply: textFrom(response),
});

console.log(textFrom(response));

// ---------------------------------------------------------------------------
// The first Claude call printed the whole object, to see its shape. Same
// instinct here — uncomment this line and comment out the textFrom() line
// above if you want the raw response. Reading that object is the point:
// `output` is an array ([reasoning, message] on a text turn), `output_text`
// is a convenience that vanishes on function_call, and `usage.input_tokens`
// is the FULL prompt (cached_tokens is a subset — grok-usage.ts subtracts).
//
//   console.log(response);
// ---------------------------------------------------------------------------
