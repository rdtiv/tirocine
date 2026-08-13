// Part 5 — Stop reasons: the branch you must not skip.
//
// Run: npm run truncate
//
// The max_tokens case is the quiet one. HTTP 200. Real text. It just stops
// mid-sentence — and if you were parsing it, it breaks.
//
// Check stop_reason BEFORE you trust the payload.

import Anthropic from '@anthropic-ai/sdk';
import { textFrom } from './text.js';

const client = new Anthropic();

const message = await client.messages.create({
  model: 'claude-sonnet-5',
  max_tokens: 30, // deliberately far too small
  messages: [{ role: 'user', content: 'Write 400 words about how hurricanes form.' }],
});

console.log(textFrom(message));
console.log('\nstop_reason:', message.stop_reason);

if (message.stop_reason === 'max_tokens') {
  console.warn('Truncated. This text is incomplete and unsafe to parse.');
}
