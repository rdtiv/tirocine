// Part 6 — Tokens and money: your own usage dashboard.
//
// You have an API key but no Console dashboard, so you cannot see what your
// own program spends. This file fixes that. Every Claude or Grok call appends
// one row to usage.csv, which you can open in Excel and add up.
//
// Two rules this file follows, and both are the point:
//
//   1. RECORD FACTS, PRICE THEM SEPARATELY. Token counts are what actually
//      happened and never change. Prices change (see the note in Part 6 about
//      Sonnet 5). So the token columns are the durable record; cost_usd is a
//      snapshot at today's prices. If prices move, re-derive from the tokens.
//
//   2. NEVER LOG THE FULL PROMPT OR REPLY. Just the first 40 characters, so
//      you can tell one row from another. Telemetry that quietly writes every
//      user message to disk is how you end up with a privacy incident.

import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import type Anthropic from '@anthropic-ai/sdk';
import { textFrom } from './text.js';

// Dollars per million tokens. Verified 2026-08-13 — re-check against
// https://platform.claude.com/docs/en/about-claude/pricing before trusting a total.
const PRICES = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-5': { input: 5, output: 25 },
} as const;

export type PricedModel = keyof typeof PRICES;

// Dollars per million tokens. Verified 2026-08-14 — re-check against
// https://docs.x.ai/developers/pricing before trusting a total.
// Prompts ≥200k tokens double the whole request. We do not implement that
// branch — every row is priced at the short-context rate.
const GROK_PRICES = {
  'grok-4.6': { input: 2, cached: 0.50, output: 6 },
} as const;

export type GrokPricedModel = keyof typeof GROK_PRICES;

/** Written next to package.json, because npm runs scripts from the project root. */
const FILE = 'usage.csv';

/** How much of the prompt and reply to keep, so you can tell rows apart.
 *  40 rather than 10 or 20: "what's the weather in Denver" is 28 characters,
 *  and the word that distinguishes one row from the next is at the END. */
const SNIPPET = 40;

/** An invisible "this file is UTF-8" marker. Without it, Excel on Windows
 *  opens usage.csv as legacy text and renders the degree sign in "80°F" as
 *  mojibake. Written once, as the very first characters of the file. */
const BOM = '\uFEFF';

/** One id per process, so every call in a single `npm run chat` groups together. */
const RUN_ID = randomUUID().slice(0, 8);

const COLUMNS = [
  'timestamp', 'run_id', 'script', 'model', 'message_id',
  'input_tokens', 'cache_read', 'cache_write',
  'thinking_tokens', 'output_tokens', 'context_tokens',
  'cost_usd', 'stop_reason', 'prompt', 'reply',
] as const;

/** Squash to one line, trim to SNIPPET, then quote it — a stray comma or
 *  newline in a prompt would otherwise shift every column to its right. */
function field(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET);
  return `"${flat.replace(/"/g, '""')}"`;
}

/**
 * One vendor-neutral shape so the CSV can stay 15 columns for both APIs.
 *
 * input_tokens is the uncached remainder — Claude's convention, which is
 * the number you actually pay full price for. Grok's Responses API reports
 * the full prompt instead, so fromResponses subtracts.
 */
export type LedgerUsage = {
  input_tokens: number;   // uncached remainder (Claude convention)
  cache_read: number;
  cache_write: number;    // always 0 for Grok
  thinking_tokens: number;
  output_tokens: number;
};

/** The field math logCall used to inline. One function so the two loggers
 *  cannot drift apart on what "input_tokens" means. */
export function fromAnthropic(usage: Anthropic.Usage): LedgerUsage {
  return {
    input_tokens: usage.input_tokens,
    cache_read: usage.cache_read_input_tokens ?? 0,
    cache_write: usage.cache_creation_input_tokens ?? 0,
    thinking_tokens: usage.output_tokens_details?.thinking_tokens ?? 0,
    output_tokens: usage.output_tokens,
  };
}

/**
 * Local stand-in for the OpenAI Responses usage object. Importing `openai`
 * here would force every Claude-only reader of this file to pull those types.
 */
type ResponsesUsage = {
  input_tokens: number;
  output_tokens: number;
  input_tokens_details?: { cached_tokens?: number };
  output_tokens_details?: { reasoning_tokens?: number };
};

/**
 * Verified 2026-08-14 against a live Responses call: input_tokens was
 * the full prompt and cached_tokens was a subset. Subtract.
 *
 * Responses `input_tokens` is the FULL prompt; `cached_tokens` is a subset.
 * Subtract so the CSV's input_tokens stays the uncached remainder.
 */
export function fromResponses(usage: ResponsesUsage): LedgerUsage {
  const cacheRead = usage.input_tokens_details?.cached_tokens ?? 0;
  return {
    input_tokens: usage.input_tokens - cacheRead,
    cache_read: cacheRead,
    cache_write: 0, // always 0 for Grok — no separate write premium
    thinking_tokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
    output_tokens: usage.output_tokens,
  };
}

/**
 * What a call actually cost. Four terms, because the prompt is three separate
 * quantities billed at three different rates:
 *
 *   input_tokens  full price   — the part that wasn't cached
 *   cache_write   1.25x        — writing a new cache entry costs a premium
 *   cache_read    0.1x         — reading one back is the whole point of caching
 *   output_tokens output price — ~5x input, and INCLUDES any thinking tokens
 *
 * Before Part 11 the two cache numbers are always 0, so this collapses to the
 * simple version. It stays correct once you turn caching on.
 */
export function costOf(model: PricedModel, usage: Anthropic.Usage): number {
  const rate = PRICES[model];
  const ledger = fromAnthropic(usage);

  return (
    ledger.input_tokens * rate.input +
    ledger.cache_write * rate.input * 1.25 +
    ledger.cache_read * rate.input * 0.1 +
    ledger.output_tokens * rate.output
  ) / 1_000_000;
}

/** uncached * $2 + cached * $0.50 + output * $6, per million. */
export function costOfGrok(model: GrokPricedModel, usage: LedgerUsage): number {
  const rate = GROK_PRICES[model];
  return (
    usage.input_tokens * rate.input +
    usage.cache_read * rate.cached +
    usage.output_tokens * rate.output
  ) / 1_000_000;
}

/**
 * Shared write so logCall and logGrokCall cannot disagree on the 15 columns.
 *
 * Check the columns before appending. If COLUMNS ever changes, new rows
 * written under an old header line up one column out, `npm run usage`
 * reads the wrong cells, and Number('') is 0 — so it reports $0.00 and
 * looks fine. A cost log that silently says zero is the worst outcome
 * this file could have, so refuse rather than corrupt.
 */
function appendRow(values: Array<string | number>): void {
  const header = COLUMNS.join(',');

  if (!existsSync(FILE)) {
    writeFileSync(FILE, `${BOM}${header}\n`);
  } else {
    const existing = readFileSync(FILE, 'utf8').split('\n')[0]?.replace(BOM, '');
    if (existing !== header) {
      throw new Error(
        `${FILE} has different columns than this version of usage.ts writes.\n` +
          `Rename or delete it and run again — the old rows stay readable in Excel.`,
      );
    }
  }

  appendFileSync(FILE, values.join(',') + '\n');
}

function printUsage(ledger: LedgerUsage, context: number, cost: number): void {
  const cached =
    ledger.cache_read || ledger.cache_write
      ? ` (+${ledger.cache_read} cached, ${ledger.cache_write} written)`
      : '';
  const thought = ledger.thinking_tokens ? ` [${ledger.thinking_tokens} thinking]` : '';

  // Leading newline: when streaming, the answer ends without one, and the
  // usage line would otherwise run straight into the last word.
  console.log(
    `\n[usage] in ${ledger.input_tokens}${cached} · out ${ledger.output_tokens}${thought}` +
      ` · context ${context} · $${cost.toFixed(6)}`,
  );
}

/**
 * One line in any script, right after the response comes back.
 *
 * Always appends a row to usage.csv. Also prints a one-line summary, unless
 * you pass `{ print: false }` — src/bench.ts does that, because it formats
 * its own table and would otherwise show every number twice.
 */
export function logCall(
  script: string,
  model: PricedModel,
  prompt: string,
  message: Anthropic.Message,
  options: { print?: boolean } = {},
): void {
  const ledger = fromAnthropic(message.usage);

  // The whole prompt you resent this turn — "tokens I need to keep".
  const context = ledger.input_tokens + ledger.cache_read + ledger.cache_write;

  const cost = costOf(model, message.usage);

  appendRow([
    new Date().toISOString(),
    RUN_ID,
    script,
    model,
    message.id,
    ledger.input_tokens,
    ledger.cache_read,
    ledger.cache_write,
    ledger.thinking_tokens,
    ledger.output_tokens,
    context,
    cost.toFixed(6),
    message.stop_reason ?? '',
    field(prompt),
    field(textFrom(message)),
  ]);

  if (options.print === false) return;

  printUsage(ledger, context, cost);
}

/**
 * Same 15 columns as logCall, no Anthropic types. reply is a string because
 * the Grok text helper does not exist yet.
 *
 * Responses has `status`, not Claude's `stop_reason`. We write that, or an
 * empty string if the field is missing — never @ts-expect-error for it.
 */
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

  printUsage(ledger, context, cost);
}
