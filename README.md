# weatherwise

Companion code for **Your First Project: A Claude-Powered Weather Assistant in TypeScript** (Windows edition).

A command-line weather assistant built on the Claude API. Every script here is a
single runnable lesson — you can run them in any order, but they're numbered by
tutorial Part so you can follow along.

---

## Setup

You need **Node.js 20 or newer** (`node --version` to check) and two API keys.

```powershell
git clone https://github.com/rdtiv/llm-basics.git
cd llm-basics
npm install
copy .env.example .env
```

On macOS or Linux, the last line is `cp .env.example .env`.

Then open `.env` and fill in both values:

| Variable | Where to get it | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) → API keys | Pay as you go. Everything in this repo costs well under a dollar total. |
| `WEATHER_API_KEY` | [weatherapi.com](https://www.weatherapi.com) → sign up | Free tier, no card required. |

`.env` is in `.gitignore`. It will not be committed. Keep it that way.

Verify your setup before anything else:

```bash
npm run typecheck   # no API key needed — proves the code compiles
npm run models      # needs ANTHROPIC_API_KEY — lists model IDs your key can use
npm run dev         # your first Claude call
```

### If a model ID doesn't work

`src/config.ts` and `src/bench.ts` hardcode model IDs. Model IDs change. If you
get a `404 not_found_error`, run `npm run models` and update them to whatever
your account actually offers. Don't trust a document over a live API.

---

## The scripts, in tutorial order

| Command | File | Part | What it teaches |
|---|---|---|---|
| `npm run dev` | `src/index.ts` | 2–3 | Your first API call. `messages.create`, and why `textFrom()` exists — content is an array of blocks, not a string. |
| `npm run chat` | `src/chat.ts` | 4, 6 | The API is stateless. **You** own the conversation history. Also prints running cost per turn. |
| `npm run truncate` | `src/truncate.ts` | 5 | `max_tokens: 30` cuts the answer off mid-sentence. `stop_reason` tells you it happened — check it. |
| `npm run bench` | `src/bench.ts` | 6 | Haiku vs Sonnet vs Opus on three tasks of rising difficulty. Time, cost, and quality, side by side. |
| `npm run weather` | `src/weather-test.ts` | 7 | `fetch`, `await`, and `response.ok`. No AI in this one at all. |
| `npm run parse` | `src/parse-request.ts` | 8 | Structured output. `messages.parse()` + `zodOutputFormat()` returns validated, typed data. Stop parsing prose. |
| `npm run agent` | `src/agent.ts` | 9 | Tools. The model requests; **your code executes**. The full tool loop, hand-written. |
| `npm run assistant` | `src/assistant.ts` | 9 | The finished project — Part 4's chat loop with Part 9's tool loop inside it. |
| `npm run injection` | `src/injection.ts` | 9 | Prompt injection. A tool result carries instructions. Find out if your program obeys a stranger. |
| `npm run stream` | `src/stream.ts` | 10 | `messages.stream()` and `.on('text')`. Same tokens, same cost — it just stops feeling broken. |
| `npm run assistant:streaming` | `src/assistant-streaming.ts` | 10.3, 11, 12 | The assistant, streaming, with prompt caching and error handling. |
| `npm run models` | `src/models.ts` | — | Lists every model ID your key can use. Bonus, not in the tutorial. |
| `npm run typecheck` | — | — | Compiles everything without running it. No API key needed. |

### Supporting files (not directly runnable)

| File | Part | Purpose |
|---|---|---|
| `src/text.ts` | 3 | `textFrom()` — pulls text out of a response's content blocks. A type predicate, so TypeScript narrows the type for you. |
| `src/config.ts` | 6 | `MODEL` — one place to change which model everything uses. |
| `src/cost.ts` | 6 | `logCost()` and the price table. Imported by `chat.ts`. |
| `src/weather.ts` | 7 | `getWeather()` and the two interfaces. Imported by everything with a tool. |
| `body.json` | 7.7 | Request body for the raw `curl.exe` exercise. |

---

## Two things the tutorial does differently

**1. Two assistants, not one.** Part 10.3 tells you to convert `respond()` in
`src/assistant.ts` to streaming, editing the file in place. This repo keeps the
blocking version and adds `src/assistant-streaming.ts` instead, so you can run
both back to back and feel the difference:

```bash
npm run assistant             # waits, then prints the whole answer at once
npm run assistant:streaming   # types as it goes
```

Same model, same cost, same words. Only the delivery changes. That gap is the
entire lesson of Part 10.

**2. Extra scripts.** The tutorial's own README stub lists six commands. This
repo adds `truncate`, `weather`, `parse`, `stream`, `assistant:streaming`,
`models`, and `typecheck` so that every concept in the tutorial has something
you can actually run.

---

## Verifying prompt caching

Caching (Part 11) fails **silently**. If your prompt is under the minimum, you
get no caching, no error, and no warning. Set `LOG_USAGE=1` to watch the numbers:

```powershell
$env:LOG_USAGE=1; npm run assistant:streaming
```

```bash
LOG_USAGE=1 npm run assistant:streaming   # macOS / Linux
```

Then read three fields:

- `cache_read_input_tokens` — reused from cache, billed at 0.1x
- `cache_creation_input_tokens` — written to cache on this call
- `input_tokens` — only the tokens *after* the last cache marker

Both cache fields at `0` means nothing cached. The minimum cacheable prefix is
**1,024 tokens for Sonnet 5** (512 for Opus 5 and Fable 5, 4,096 for Haiku 4.5),
so a short conversation won't cache until it grows. Ask a few questions and watch
`cache_read_input_tokens` come alive.

---

## ESM gotcha

Imports use a `.js` extension even though the files are `.ts`:

```ts
import { getWeather } from './weather.js';   // yes, .js — the file is weather.ts
```

That's correct and required. The extension refers to the compiled output, not the
source. If you write `'./weather'` you'll get a module resolution error.

---

## Costs

| Script | Approximate cost |
|---|---|
| `dev`, `truncate`, `stream`, `parse`, `models` | A fraction of a cent each |
| `bench` | Under a cent — 9 calls across 3 models |
| `chat`, `assistant`, `assistant:streaming` | Pennies per session; `chat` prints a running total |
| `weather`, `typecheck` | Free — no Claude call |

Set a spend limit on your Anthropic account anyway. Everyone should.
