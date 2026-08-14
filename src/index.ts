// Part 2 / Part 3 — Your first Claude call.
//
// Run: npm run dev
//
// Note that `new Anthropic()` takes no arguments. The SDK reads
// ANTHROPIC_API_KEY from the environment itself. That's why the key never
// appears in your code.

import Anthropic from '@anthropic-ai/sdk';
import { textFrom } from './text.js';
import { logCall } from './usage.js';

const client = new Anthropic();

const question = 'What is a heat index?';

const message = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 1024,
  messages: [{ role: 'user', content: question }],
});

logCall('dev', 'claude-sonnet-5', question, message);

console.log(textFrom(message));

// ---------------------------------------------------------------------------
// Part 2 originally had you print the whole object, to see its shape:
//
//   console.log(message);
//
// Uncomment that line and comment out the textFrom() line above if you want
// to see the raw response again. Reading that object is the whole point of
// Part 3 — the `content` array, `stop_reason`, and `usage` all live in there.
// ---------------------------------------------------------------------------
