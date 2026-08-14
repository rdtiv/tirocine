// Part 6, Lab — Haiku vs Sonnet vs Opus.
//
// Run: npm run bench
//
// Runs the same three tasks against all three models and reports how long each
// took, what it cost, and what it answered. The tasks get progressively harder
// on purpose. The whole run costs a few cents — most of it Opus on the hard
// task, which reasons before it answers.
//
// What to look for:
//   - On the easy task all three get it right. Compare time and price.
//   - On the hard task, watch for a split. The correct answer is 18 minutes.
//   - Watch output token counts on the hard task — bigger models spend more
//     tokens reasoning before answering. That's what you're paying for.

import Anthropic from '@anthropic-ai/sdk';
import { textFrom } from './text.js';
import { costOf, logCall } from './usage.js';

const client = new Anthropic();

// No prices here — they live in ONE place, src/usage.ts. A second copy of a
// price table is a second thing to forget to update.
const MODELS = [
  { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
  { id: 'claude-sonnet-5', name: 'Sonnet 5' },
  { id: 'claude-opus-5', name: 'Opus 5' },
] as const;

const TASKS = [
  {
    name: 'Easy — classify',
    description: 'One-word classification. Every model should nail this.',
    prompt:
      'Classify the weather condition "light drizzle, 51F" as one of: ' +
      'clear, wet, cold, severe. Reply with one word only.',
  },
  {
    name: 'Medium — extract',
    description: 'Pull structured facts out of a sentence with no math or logic involved.',
    prompt:
      'From this note, list every city mentioned, comma separated, nothing else: ' +
      '"Flying Dallas to Denver Tuesday, then driving up to Boulder. ' +
      'Weather in Denver looks rough but Fort Collins is clear."',
  },
  {
    name: 'Hard — reason',
    description: 'Multi-step word problem. Correct answer is 18 minutes — watch for a split.',
    prompt:
      'A tank holds 210 liters and starts with 30 liters. It fills at 12 L/min ' +
      'and simultaneously drains at 4.5 L/min. After exactly 8 minutes the drain ' +
      'is closed. At what time from the start does the tank overflow? ' +
      'Give the answer in minutes.',
  },
];

interface Result {
  model: string;
  task: string;
  seconds: number;
  outputTokens: number;
  cents: number;
  answer: string;
}

const ANSWER_INDENT = '           '; // lines up under the model-name column below
const WRAP_WIDTH = 100;

/** Prints text word-wrapped at WRAP_WIDTH, with every line indented — unlike
 *  relying on the terminal to soft-wrap, this keeps long answers aligned. */
function printAnswer(text: string): void {
  const words = text.split(' ');
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > WRAP_WIDTH - ANSWER_INDENT.length && line) {
      console.log(ANSWER_INDENT + line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) console.log(ANSWER_INDENT + line);
}

const results: Result[] = [];

for (const task of TASKS) {
  console.log(`\n=== ${task.name} ===`);
  console.log(`${task.description}\n`);
  console.log(`Prompt: ${task.prompt}\n`);

  for (const model of MODELS) {
    const started = Date.now();

    const message = await client.messages.create({
      model: model.id,
      max_tokens: 2048,
      messages: [{ role: 'user', content: task.prompt }],
    });

    const seconds = (Date.now() - started) / 1000;
    const cents = costOf(model.id, message.usage) * 100;

    // print: false — this script formats its own table just below.
    logCall('bench', model.id, task.prompt, message, { print: false });

    const answer = textFrom(message).replace(/\s+/g, ' ').trim();

    results.push({
      model: model.name,
      task: task.name,
      seconds,
      outputTokens: message.usage.output_tokens,
      cents,
      answer,
    });

    console.log(
      `${model.name.padEnd(10)} ${seconds.toFixed(1).padStart(5)}s  ` +
        `${String(message.usage.output_tokens).padStart(5)} out tok  ` +
        `${cents.toFixed(4).padStart(8)}¢`,
    );
    printAnswer(answer);
    console.log();
  }
}

console.log('\n=== Totals across all three tasks ===');
for (const model of MODELS) {
  const mine = results.filter((r) => r.model === model.name);
  const totalSeconds = mine.reduce((sum, r) => sum + r.seconds, 0);
  const totalCents = mine.reduce((sum, r) => sum + r.cents, 0);

  console.log(
    `${model.name.padEnd(10)} ${totalSeconds.toFixed(1).padStart(5)}s  ` +
      `${totalCents.toFixed(4).padStart(8)}¢  ` +
      `(${((totalCents / 100) * 1000).toFixed(2)} dollars per 1000 runs)`,
  );
}

console.log('\nThe correct answer to the hard task is 18 minutes.');
