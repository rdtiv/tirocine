// The Grok lesson writes the SAME usage.csv as the Claude one — fifteen
// columns, same header check — but this file must not live in usage.ts.
// docs/typescript.md builds usage.ts. If Grok helpers landed there, the
// Claude tutorial would have to reprint them. This module is owned by
// docs/grok.md instead.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Dollars per million tokens. Verified 2026-08-14 — re-check against
// https://docs.x.ai/developers/pricing before trusting a total.
// Prompts ≥200k tokens double the whole request. We do not implement that
// branch — every row is priced at the short-context rate.
const PRICES = {
  'grok-4.6': { input: 2, cached: 0.5, output: 6 },
} as const;

export type GrokPricedModel = keyof typeof PRICES;

const FILE = 'usage.csv';
const SNIPPET = 40;
const BOM = '\uFEFF';
const RUN_ID = randomUUID().slice(0, 8);

// Same 15 names, same order as src/usage.ts. A mismatch throws rather than
// writing a row that npm run usage would silently misread.
const COLUMNS = [
  'timestamp', 'run_id', 'script', 'model', 'message_id',
  'input_tokens', 'cache_read', 'cache_write',
  'thinking_tokens', 'output_tokens', 'context_tokens',
  'cost_usd', 'stop_reason', 'prompt', 'reply',
] as const;

function field(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET);
  return `"${flat.replace(/"/g, '""')}"`;
}

export type LedgerUsage = {
  input_tokens: number; // uncached remainder (Claude's CSV convention)
  cache_read: number;
  cache_write: number; // always 0 for Grok
  thinking_tokens: number;
  output_tokens: number;
};

type ResponsesUsage = {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};

/**
 * Verified 2026-08-14 against a live Responses call: input_tokens was
 * the full prompt and cached_tokens was a subset. Subtract so the CSV
 * keeps Claude's "uncached remainder" meaning.
 */
export function fromResponses(usage: ResponsesUsage): LedgerUsage {
  const cacheRead = usage.input_tokens_details?.cached_tokens ?? 0;
  return {
    input_tokens: usage.input_tokens - cacheRead,
    cache_read: cacheRead,
    cache_write: 0,
    thinking_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
    output_tokens: usage.output_tokens,
  };
}

/** uncached * $2 + cached * $0.50 + output * $6, per million. */
export function costOfGrok(model: GrokPricedModel, usage: LedgerUsage): number {
  const rate = PRICES[model];
  return (
    usage.input_tokens * rate.input +
    usage.cache_read * rate.cached +
    usage.output_tokens * rate.output
  ) / 1_000_000;
}

function appendRow(values: Array<string | number>): void {
  const header = COLUMNS.join(',');

  if (!existsSync(FILE)) {
    writeFileSync(FILE, `${BOM}${header}\n`);
  } else {
    const existing = readFileSync(FILE, 'utf8').split('\n')[0]?.replace(BOM, '');
    if (existing !== header) {
      throw new Error(
        `${FILE} has different columns than this version of grok-usage.ts writes.\n` +
          `Rename or delete it and run again — the old rows stay readable in Excel.`,
      );
    }
  }

  appendFileSync(FILE, values.join(',') + '\n');
}

export function logGrokCall(
  script: string,
  model: GrokPricedModel,
  prompt: string,
  args: {
    id?: string;
    usage: ResponsesUsage;
    status?: string;
    reply: string;
    print?: boolean;
  },
): void {
  const ledger = fromResponses(args.usage);
  const context = ledger.input_tokens + ledger.cache_read + ledger.cache_write;
  const cost = costOfGrok(model, ledger);

  appendRow([
    new Date().toISOString(),
    RUN_ID,
    script,
    model,
    args.id ?? '',
    ledger.input_tokens,
    ledger.cache_read,
    ledger.cache_write,
    ledger.thinking_tokens,
    ledger.output_tokens,
    context,
    cost.toFixed(6),
    args.status ?? '',
    field(prompt),
    field(args.reply),
  ]);

  if (args.print === false) return;

  const cached =
    ledger.cache_read || ledger.cache_write
      ? ` (+${ledger.cache_read} cached, ${ledger.cache_write} written)`
      : '';
  const thought = ledger.thinking_tokens ? ` [${ledger.thinking_tokens} thinking]` : '';

  console.log(
    `\n[usage] in ${ledger.input_tokens}${cached} · out ${ledger.output_tokens}${thought}` +
      ` · context ${context} · $${cost.toFixed(6)}`,
  );
}
