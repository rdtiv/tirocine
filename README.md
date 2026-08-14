# tirocine

[![CI](https://github.com/rdtiv/tirocine/actions/workflows/ci.yml/badge.svg)](https://github.com/rdtiv/tirocine/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A Roman army recruit was a **tiro** — enlisted, but not yet blooded. The word
carried no insult; it simply meant *new*, and stood in contrast to the
**veteranus**, who had been through a campaign.

Latin built abstract nouns out of roles with the suffix **-cinium**. From *latro*,
a bandit, came *latrocinium*, banditry. From *patronus*, a patron, came
*patrocinium*, patronage. And from *tiro* came **tirocinium**: the condition of
being a recruit, and so a soldier's first campaign. It widened to mean any
apprenticeship, any first attempt at a hard thing — William Cowper used it as the
title of a poem about schooling in 1785. It survives in English as **tyro**, a
beginner, though it has mostly fallen out of use. **tirocine** is just a shorter
form to type.

The name is the whole idea. **This is a first campaign** — not a portfolio, not a
framework. Somewhere to be new at something and have that be the point.

---

## What this is

**Learning to build on large language models, one project at a time.**

Written for someone who has not shipped code before. It assumes you can use a
computer and nothing else — no prior JavaScript, no prior API work, no prior idea
of what a token is.

The first project is **weatherwise**: a command-line assistant that answers
plain-English weather questions. It starts as ten lines and ends as a program
that waits for you, looks up live weather when it needs to, streams its answers
back as it thinks, caches its prompts to cut the bill, and keeps a running ledger
of what it spent.

---

## The tutorial

| | Document | Status |
|---|---|---|
| **1** | Setup — [Windows](docs/setup-windows.md) · [macOS](docs/setup-mac.md) | Complete |
| **2** | [The TypeScript build](docs/typescript.md) | Complete — builds the unprefixed files in `src/` |
| **3** | [The Grok transfer](docs/grok.md) | Complete — rebuilds the assistant against xAI |
| **4** | [The Python build](docs/python.md) | Draft — no companion code yet |
| **5** | [The app](docs/app.md) — Next.js, the AI SDK, Vercel | Outline only |

Documents 4 and 5 state their own gaps at the top. Nothing here pretends to be
finished when it isn't.

Start at **1**, then **2**. Unprefixed files in `src/` are built by document 2.
`src/grok-*.ts` is built by document 3.

---

## Quick start

You need **Node.js 22 or newer**. One install, one `node`, every script.
Check with `node --version` — the first number must be 22 or higher. If you
see `v20` or older, upgrade, then continue. (20.6 is when `--env-file`
arrived. The Grok lesson's `openai` package needs 22, so that is the floor
for the whole project.)

```bash
git clone https://github.com/rdtiv/tirocine.git
cd tirocine
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Then open `.env` and fill in the keys. The first two are required. Grok is optional:

| Variable | Where | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) → API keys | Pay as you go. Everything here costs well under a dollar in total. |
| `WEATHER_API_KEY` | [weatherapi.com](https://www.weatherapi.com) | Free tier, no card. |
| `XAI_API_KEY` | [console.x.ai](https://console.x.ai) | Optional. Only the Grok transfer scripts need this. |

`.env` is gitignored and will not be committed. Keep it that way.

Then, in order — each of these tells you something before you spend anything:

```bash
npm run typecheck   # no key needed: proves the code compiles
npm run models      # lists the model IDs your key can actually use
npm run dev         # your first Claude call
npm run usage       # what that call just cost you
```

> **If a script fails with `404 not_found_error`,** a model ID has moved.
> `src/config.ts` holds the Claude ID most scripts use; `src/usage.ts` and
> `src/bench.ts` name all three for pricing and comparison; and `index.ts`,
> `chat.ts`, and `truncate.ts` hardcode one deliberately, because they exist to
> show a single call. Grok scripts read `src/grok-config.ts` (or hardcode
> `grok-4.6` the same way). Run `npm run models` or `npm run grok:models` and
> update what you find. Don't trust a document over a live API — including this
> one.

---

## Two things that make this different

### You can see what you spend

An API key gets you no dashboard. So every call in every script appends a row to
`usage.csv` — fifteen columns you can open in Excel and add up:

- **when and what** — `timestamp`, `run_id`, `script`, `model`, `message_id`
- **what went in** — `input_tokens`, `cache_read`, `cache_write`
- **what came back** — `output_tokens`, `thinking_tokens`, `stop_reason`
- **what it cost** — `context_tokens`, `cost_usd`
- **which turn it was** — `prompt` and `reply`, first 40 characters only

`npm run usage` totals it — by model, by session, and by what caching saved.
Three details most tutorials skip:

- **The cost formula has four terms, not two.** Uncached input, cache writes at
  1.25×, cache reads at 0.1×, output. The obvious two-term version is correct
  right up until you enable caching, then it silently under-reports.
- **`context_tokens` is the number nobody shows you** — the whole prompt you
  resend each turn. Once caching is on, `input_tokens` is only the *uncached
  remainder*, so budgeting off it understates spend badly.
- **Token counts are recorded; prices are applied when you read.** Prices move.
  The tokens are the durable record.

### The tutorial cannot drift from the code

`npm run verify:docs` rebuilds `src/` **from the tutorial's own code blocks**,
compiles that, and diffs it back. If a code block and the file it teaches ever
disagree, CI fails.

It checks five things. Every Markdown file in the repo is structurally sound —
fences balanced, links resolving. Then, once per companion document (TypeScript
and Grok): the document's code compiles (including the earlier version of any
file built in stages), no edit instruction tells you to make a change already
present, every finished listing matches `src/` exactly, and nothing that
document owns in `src/` is left unexplained.

This exists because it caught real bugs — a step that said "add the import" and
never showed it, three instructions to add code that was already there, and a
listing pointing at the wrong endpoint.

---

## The scripts

| Command | File | Part | What it teaches |
|---|---|---|---|
| `npm run dev` | `src/index.ts` | 2–3 | Your first API call, and why `content` is an array of blocks rather than a string. |
| `npm run chat` | `src/chat.ts` | 4, 6 | The API is stateless. **You** own the conversation history — and pay to resend it every turn. |
| `npm run truncate` | `src/truncate.ts` | 5 | `max_tokens: 30` cuts the answer off mid-sentence. `stop_reason` is how you find out. |
| `npm run bench` | `src/bench.ts` | 6 | Haiku vs Sonnet vs Opus on three tasks of rising difficulty. Time, cost, and quality side by side. |
| `npm run usage` | `src/usage-report.ts` | 6 | Reads `usage.csv` and totals it. No API key needed. |
| `npm run weather` | `src/weather-test.ts` | 7 | `fetch`, `await`, and `response.ok`. No AI in this one at all. |
| `npm run parse` | `src/parse-request.ts` | 8 | Structured output. Stop parsing prose out of model replies. |
| `npm run agent` | `src/agent.ts` | 9 | Tools. The model requests; **your code executes**. The loop, hand-written. |
| `npm run assistant` | `src/assistant.ts` | 9 | The finished project — a chat loop with a tool loop inside it. |
| `npm run injection` | `src/injection.ts` | 9 | Prompt injection. A tool result carries instructions. Find out whether your program obeys a stranger. |
| `npm run stream` | `src/stream.ts` | 10 | `messages.stream()`. Same tokens, same cost — it just stops feeling broken. |
| `npm run assistant:streaming` | `src/assistant-streaming.ts` | 10–12 | The assistant with streaming, prompt caching, and error handling. |
| `npm run models` | `src/models.ts` | — | Every model ID your key can use. Not in the tutorial; here because guessing wastes an afternoon. |
| `npm run grok` | `src/grok-index.ts` | Grok | First Responses call. Hardcoded `grok-4.6`, same instinct as `npm run dev`. |
| `npm run grok:chat` | `src/grok-chat.ts` | Grok | Memory fork: `store: false` + a local array, or `previous_response_id`. |
| `npm run grok:parse` | `src/grok-parse.ts` | Grok | Same Zod schema as `parse`. `zodTextFormat`, field `output_parsed`. |
| `npm run grok:agent` | `src/grok-agent.ts` | Grok | Hand-written tool loop. `function_call`, `JSON.parse(arguments)`. |
| `npm run grok:search` | `src/grok-search.ts` | Grok | Who runs the tool. `web_search` is theirs; loop only `function_call`. |
| `npm run grok:assistant` | `src/grok-assistant.ts` | Grok | Finished Grok program. Local weather only — no `web_search`. |
| `npm run grok:stream` | `src/grok-stream.ts` | Grok | `stream: true`. Write `response.output_text.delta`. |
| `npm run grok:injection` | `src/grok-injection.ts` | Grok | Same `POISON` as `injection.ts`. `BOUNDARY` is not a fix. |
| `npm run grok:models` | `src/grok-models.ts` | — | Every model ID your xAI key can use. Documented extra, not in the transfer. |
| `npm run typecheck` | — | — | Compiles without running. No API key needed. |
| `npm run verify:docs` | `scripts/check-docs.ts` | — | Checks the tutorial against `src/`. Repo infrastructure, not a lesson. |

**Imported by the above, not run directly:** `src/text.ts` (pulls text out of
content blocks), `src/config.ts` (the Claude model ID, in one place),
`src/usage.ts` (the Claude ledger and price table), `src/weather.ts` (the
weather client), `src/grok-text.ts` / `src/grok-config.ts` / `src/grok-usage.ts`
(the Grok twins — same `usage.csv`, separate module), `body.json` (a request
body for the raw `curl` exercise in Part 7).

---

## What it costs to run

| Script | Approximate |
|---|---|
| `weather`, `typecheck`, `usage` | Free — no Claude call |
| `dev`, `truncate`, `stream`, `parse`, `models` | A fraction of a cent each |
| `bench` | About 2¢ — nine calls across three models, most of it Opus |
| `chat`, `assistant`, `assistant:streaming` | Pennies per session |

Every call is logged to `usage.csv`, so you never have to guess.

**Set a spend limit on your Anthropic account anyway.** A loop with a mistake in
it can call the API thousands of times a minute, and you will write one, because
everyone does.

---

## Contributing

`main` requires a pull request. CI runs `typecheck` and `verify:docs` on Node
22.x and 24.x — both keyless, so they run on forks without secrets.

If you change an unprefixed file in `src/`, change the matching code block in
`docs/typescript.md`. If you change a `src/grok-*.ts` file, change
`docs/grok.md`. `verify:docs` will tell you if you forget, and it names the
exact line.

Corrections to the tutorial are as welcome as corrections to the code. A
sentence that misleads a beginner is a bug.

---

## License

MIT — see [LICENSE](LICENSE). Use the code, copy it into your own projects,
teach from it. Attribution is welcome, not required.
