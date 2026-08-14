// Part 6 — Reading your own usage log.
//
// Run: npm run usage
//
// Reads usage.csv and tells you what you've spent. Makes NO API calls, so it
// is free and you can run it as often as you like.
//
// This is the Console dashboard you don't have. It also proves a point worth
// internalizing: once you write facts down in a boring format, you can answer
// questions nobody planned for. The file is just rows and columns — this
// script is one way to read it, and Excel is another.

import { existsSync, readFileSync } from 'node:fs';

const FILE = 'usage.csv';

if (!existsSync(FILE)) {
  console.log(`No ${FILE} yet. Run any script that calls Claude, then try again.`);
  process.exit(0);
}

interface Row {
  run_id: string;
  script: string;
  model: string;
  input_tokens: number;
  cache_read: number;
  cache_write: number;
  thinking_tokens: number;
  output_tokens: number;
  context_tokens: number;
  cost_usd: number;
}

/** Splits one CSV line, respecting "quoted, fields" and "" escapes. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i++; // skip the second quote of the pair
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell);
  return cells;
}

// .replace(/^﻿/, '') strips the byte-order mark we wrote for Excel's sake.
const lines = readFileSync(FILE, 'utf8').replace(/^﻿/, '').trim().split('\n');
const headers = splitCsvLine(lines[0]!);

const rows: Row[] = lines.slice(1).map((line) => {
  const cells = splitCsvLine(line);
  const get = (name: string) => cells[headers.indexOf(name)] ?? '';
  return {
    run_id: get('run_id'),
    script: get('script'),
    model: get('model'),
    input_tokens: Number(get('input_tokens')),
    cache_read: Number(get('cache_read')),
    cache_write: Number(get('cache_write')),
    thinking_tokens: Number(get('thinking_tokens')),
    output_tokens: Number(get('output_tokens')),
    context_tokens: Number(get('context_tokens')),
    cost_usd: Number(get('cost_usd')),
  };
});

const sum = (pick: (r: Row) => number) => rows.reduce((total, r) => total + pick(r), 0);
const money = (dollars: number) => `$${dollars.toFixed(4)}`;

console.log(`\n=== ${rows.length} calls in ${FILE} ===\n`);
console.log(`Total spend      ${money(sum((r) => r.cost_usd))}`);
console.log(`Input tokens     ${sum((r) => r.input_tokens).toLocaleString()} uncached`);
console.log(`Output tokens    ${sum((r) => r.output_tokens).toLocaleString()}`);

const thinking = sum((r) => r.thinking_tokens);
if (thinking > 0) {
  const output = sum((r) => r.output_tokens);
  const share = ((thinking / output) * 100).toFixed(1);
  console.log(
    `  of which        ${thinking.toLocaleString()} were thinking (${share}%) — ` +
      `reasoning you paid for and never saw`,
  );
}

// --- By model ---------------------------------------------------------------
console.log('\n--- by model ---');
for (const model of [...new Set(rows.map((r) => r.model))]) {
  const mine = rows.filter((r) => r.model === model);
  const cost = mine.reduce((total, r) => total + r.cost_usd, 0);
  console.log(
    `${model.padEnd(28)} ${String(mine.length).padStart(4)} calls  ${money(cost).padStart(10)}`,
  );
}

// --- By session -------------------------------------------------------------
// This is the one that answers "what did that conversation cost me?"
console.log('\n--- by session (one run_id per program start) ---');
for (const runId of [...new Set(rows.map((r) => r.run_id))]) {
  const mine = rows.filter((r) => r.run_id === runId);
  const cost = mine.reduce((total, r) => total + r.cost_usd, 0);
  const scripts = [...new Set(mine.map((r) => r.script))].join(', ');
  console.log(
    `${runId}  ${String(mine.length).padStart(4)} calls  ${money(cost).padStart(10)}  ${scripts}`,
  );
}

// --- Caching ----------------------------------------------------------------
const cacheRead = sum((r) => r.cache_read);
const cacheWrite = sum((r) => r.cache_write);
const anyGrok = rows.some((r) => r.model.startsWith('grok'));

console.log('\n--- caching ---');
if (anyGrok) {
  // Grok (or mixed) rows: Claude's 0.1× / 1,024 / 1.25× copy is the wrong
  // story. Grok caches automatically, writes cost nothing extra, and the
  // dollar savings are already in cost_usd.
  console.log(`Written to cache  ${cacheWrite.toLocaleString()} tokens`);
  console.log(`Read from cache   ${cacheRead.toLocaleString()} tokens`);
  console.log('Grok cache_write is always 0 — there is no separate write premium.');
  console.log('Savings are already in cost_usd; this report does not re-derive them.');
} else if (cacheRead === 0 && cacheWrite === 0) {
  console.log('No cache activity yet. Either caching is off, or every prompt');
  console.log('was under the minimum (1,024 tokens on Sonnet 5). See Part 11.');
} else {
  console.log(`Written to cache  ${cacheWrite.toLocaleString()} tokens (billed at 1.25x)`);
  console.log(`Read from cache   ${cacheRead.toLocaleString()} tokens (billed at 0.1x)`);
  console.log(
    `Those reads cost you ${(cacheRead * 0.1).toLocaleString()} tokens' worth ` +
      `instead of ${cacheRead.toLocaleString()}.`,
  );
}

console.log(
  `\nSame numbers, no code: open ${FILE} in Excel and sum the cost_usd column.\n`,
);
