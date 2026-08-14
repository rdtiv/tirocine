# weatherwise

Companion code for the **weatherwise** series, in `docs/`:

1. Setup — [Windows](docs/setup-windows.md) · [macOS](docs/setup-mac.md) *(stub)*
2. [The TypeScript build](docs/typescript.md) — every script in `src/` is built here
3. [The Python build](docs/python.md) — the same program again *(no companion code yet)*
4. [The app](docs/app.md) — Next.js, the AI SDK, and Vercel *(stub)*

A command-line weather assistant built on the Claude API. Every script here is a
single runnable lesson — you can run them in any order, but they're numbered by
tutorial Part so you can follow along.

---

## Setup

You need **Node.js 20.6 or newer** (`node --version` to check — 20.6 is when `--env-file` arrived) and two API keys.

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
npm run usage       # what that call just cost you
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
| `npm run chat` | `src/chat.ts` | 4, 6 | The API is stateless. **You** own the conversation history. Prints tokens and cost per turn, and appends every call to `usage.csv`. |
| `npm run truncate` | `src/truncate.ts` | 5 | `max_tokens: 30` cuts the answer off mid-sentence. `stop_reason` tells you it happened — check it. |
| `npm run bench` | `src/bench.ts` | 6 | Haiku vs Sonnet vs Opus on three tasks of rising difficulty. Time, cost, and quality, side by side. |
| `npm run usage` | `src/usage-report.ts` | 6 | Reads `usage.csv` and totals it — spend by model, by session, and what caching saved. No API key needed. |
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
| `src/usage.ts` | 6 | `logCall()` and the price table. One line per API call, appended to `usage.csv`. Imported by every script that talks to Claude. |
| `src/weather.ts` | 7 | `getWeather()` and the two interfaces. Imported by everything with a tool. |
| `body.json` | 7.7 | Request body for the raw `curl.exe` exercise. |

---

## One thing this repo adds

`npm run models` lists every model ID your API key can actually use. It isn't
part of the tutorial — it's here because a wrong model ID fails with a
`404 not_found_error`, and checking beats guessing.

Everything else in `src/` is built somewhere in the walkthrough.

---

## Verifying prompt caching

Caching (Part 11) fails **silently**. If your prompt is under the minimum you
get no caching, no error, and no warning — just a `cache_control` line that
looks like it's working.

You don't need a special flag to check: `logCall` reports the three input
numbers after every call.

```
[usage] in 2 (+0 cached, 1289 written) · out 64 · context 1291 · $0.003867
[usage] in 2 (+1289 cached, 0 written) · out 53 · context 1440 · $0.000822
```

The first call writes the cache at 1.25x and costs *more*. The second reads it
back at 0.1x and costs a quarter as much. Note that `in` collapses to 2 while
`context` stays at 1,440 — once caching is on, `input_tokens` is no longer your
input, it's only the uncached remainder. `context_tokens` is the honest number.

Both cache fields stuck at `0` means nothing cached. The minimum cacheable
prefix is **1,024 tokens for Sonnet 5** (512 for Opus 5 and Fable 5, 4,096 for
Haiku 4.5). That's why the assistant ships with a long system prompt — a
one-sentence prompt cannot be cached on any model.

`npm run usage` summarises it after the fact.

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
| `bench` | About 2¢ — 9 calls across 3 models, most of it Opus |
| `chat`, `assistant`, `assistant:streaming` | Pennies per session; every call is logged to `usage.csv` |
| `weather`, `typecheck`, `usage` | Free — no Claude call |

Set a spend limit on your Anthropic account anyway. Everyone should.
