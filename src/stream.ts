// Part 10.1 — Streaming: making it feel fast.
//
// Run: npm run stream
//
// The model generates at the same rate either way. The difference is entirely
// in when you're allowed to see it. Eight seconds of blank screen feels broken.
// Eight seconds of text arriving feels like thinking.
//
// Streaming does NOT change cost and does NOT change the content. Same tokens,
// same price, same answer — delivered differently.

import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './config.js';

const client = new Anthropic();

const stream = client.messages.stream({
  model: MODEL,
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Explain in detail how a hurricane forms.' }],
});

// Fires once per chunk of text, as it arrives.
stream.on('text', (delta) => process.stdout.write(delta));

// Waits for the stream to finish, then hands back the complete message —
// same shape as messages.create() returns, with stop_reason and usage intact.
// You get the incremental display AND the complete object. You don't choose.
const final = await stream.finalMessage();

console.log(`\n\n[${final.stop_reason}] ${final.usage.output_tokens} output tokens`);
