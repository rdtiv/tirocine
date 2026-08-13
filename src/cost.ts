// Part 6 — Tokens and money.
//
// Every response carries `usage`. Log it from day one.

import type Anthropic from '@anthropic-ai/sdk';

// Dollars per million tokens. Verified 2026-08-12 — re-check against
// https://platform.claude.com/docs/en/about-claude/pricing before trusting a total.
const PRICES = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-opus-5': { input: 5, output: 25 },
} as const;

export function logCost(model: keyof typeof PRICES, usage: Anthropic.Usage): void {
  const rate = PRICES[model];
  const dollars =
    (usage.input_tokens / 1_000_000) * rate.input +
    (usage.output_tokens / 1_000_000) * rate.output;

  console.log(
    `[cost] in=${usage.input_tokens} out=${usage.output_tokens} $${dollars.toFixed(6)}`,
  );
}
