// Part 4 — Conversation: you own the memory.
// Part 6 — plus the logCost() call added at the end of Part 6.
//
// Run: npm run chat
//
// There is no session. A conversation is an array YOU keep, and you resend all
// of it every turn. Tell it your name, then ask what your name is. It knows —
// not because it remembered, but because you re-sent the transcript.
//
// Watch the [cost] line: input tokens climb every single turn. That climb is
// this Part's lesson showing up as money. Part 11 (caching) is the fix.

import Anthropic from '@anthropic-ai/sdk';
import * as readline from 'node:readline/promises';
import { textFrom } from './text.js';
import { logCost } from './cost.js';

const client = new Anthropic();
const messages: Anthropic.MessageParam[] = [];

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Weather assistant. Type "exit" to quit.\n');

while (true) {
  let input: string;
  try {
    input = await rl.question('> ');
  } catch {
    break; // stdin closed — you pressed Ctrl+D, or input was piped in and ran out.
  }

  if (input.trim().toLowerCase() === 'exit') break;

  messages.push({ role: 'user', content: input });

  const response = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: 'You are a concise weather assistant.',
    messages,
  });

  logCost('claude-sonnet-5', response.usage);

  // Note: there is no try/catch around this call yet. If your API key is wrong,
  // this crashes with a stack trace. That's deliberate — Part 12 covers error
  // handling, and src/assistant.ts shows the fixed version.

  // Push back the whole content array, not a flattened string.
  messages.push({ role: 'assistant', content: response.content });

  console.log(`\n${textFrom(response)}\n`);
}

rl.close();
