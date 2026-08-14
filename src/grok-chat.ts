// Conversation: someone still has to remember.
//
// Run: npm run grok:chat
//
// FIRST path (the default): store: false + a local `input` array. Same idea
// as src/chat.ts — you own the transcript, you resend it every turn.
//
// SECOND path: flip MEMORY to 'server'. xAI stores the turn and
// `previous_response_id` continues it. Verified 2026-08-14: a second turn
// recalled a codeword. Someone still remembers. It just isn't you.

import OpenAI from 'openai';
import * as readline from 'node:readline/promises';
import type { Response, ResponseInputItem } from 'openai/resources/responses/responses';
import { textFrom } from './grok-text.js';
import { logGrokCall } from './grok-usage.js';

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 360_000, // reasoning models can think for minutes, not a retries lesson
});

// FIRST: local memory. SECOND: change this to 'server' for previous_response_id.
const MEMORY: 'local' | 'server' = 'local';

const INSTRUCTIONS = 'You are a concise weather assistant.';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('Weather assistant. Type "exit" to quit.\n');

const input: ResponseInputItem[] = [];
let previousResponseId: string | undefined;

while (true) {
  let line: string;
  try {
    line = await rl.question('> ');
  } catch {
    break; // stdin closed — you pressed Ctrl+D, or input was piped in and ran out.
  }

  if (line.trim().toLowerCase() === 'exit') break;

  let response: Response;

  if (MEMORY === 'local') {
    // store: false — xAI forgets this turn. You keep the array and resend it.
    input.push({ role: 'user', content: line });
    response = await client.responses.create({
      model: 'grok-4.6',
      input,
      store: false,
      instructions: INSTRUCTIONS,
    });
    input.push(...(response.output as ResponseInputItem[]));
  } else {
    // previous_response_id — xAI stored the last turn and continues it.
    // You send only the new line. Do not also set store: false here; the
    // server has to keep the turn for the id to mean anything.
    response = await client.responses.create({
      model: 'grok-4.6',
      input: line,
      previous_response_id: previousResponseId,
      instructions: INSTRUCTIONS,
    });
    previousResponseId = response.id;
  }

  if (!response.usage) throw new Error('No usage on response');
  logGrokCall('grok-chat', 'grok-4.6', line, {
    id: response.id,
    usage: response.usage,
    status: response.status,
    reply: textFrom(response),
  });

  console.log(`\n${textFrom(response)}\n`);
}

rl.close();
