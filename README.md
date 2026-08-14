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
| **2** | [The TypeScript build](docs/typescript.md) | Complete — builds everything in `src/` |
| **3** | [The Python build](docs/python.md) | Complete — builds everything in `pyweather/` |
| **4** | [The app](docs/app.md) — Next.js, the AI SDK, Vercel | Outline only |

Document 4 states its own gaps at the top. Nothing here pretends to be finished
when it isn't.

Start at **1**, then **2**. Everything in `src/` is built by document 2, in
order, one file per lesson.

Document 3 then builds the **same program a second time**, in Python. It
introduces no new *Claude* concepts — that is the point. If you only ever see
one language you cannot tell which of the things you learned are real and which
are just how TypeScript happens to write them.

**It assumes no Python.** Every Part ends in an `Idea | TypeScript | Python`
table, so the invariant is visible on every page rather than argued once at the
end, and it teaches the Python you need to read the program — virtual
environments, packages and imports, type hints, exceptions, context managers —
always anchored to the TypeScript you already know.

Both builds write to the same `usage.csv`, so one `npm run usage` totals them
together. That is the argument made physical rather than asserted.

---

## Quick start

You need **Node.js 20.6 or newer** — 20.6 is when `--env-file` arrived, and
every script that needs a key uses it to read your `.env`. Check with
`node --version`.

```bash
git clone https://github.com/rdtiv/tirocine.git
cd tirocine
npm install
cp .env.example .env        # on Windows: copy .env.example .env
```

Then open `.env` and fill in two keys:

| Variable | Where | Cost |
|---|---|---|
| `ANTHROPIC_API_KEY` | [platform.claude.com](https://platform.claude.com) → API keys | Pay as you go. Everything here costs well under a dollar in total. |
| `WEATHER_API_KEY` | [weatherapi.com](https://www.weatherapi.com) | Free tier, no card. |

`.env` is gitignored and will not be committed. Keep it that way.

Then, in order — each of these tells you something before you spend anything:

```bash
npm run typecheck   # no key needed: proves the code compiles
npm run models      # lists the model IDs your key can actually use
npm run dev         # your first Claude call
npm run usage       # what that call just cost you
```

> **If a script fails with `404 not_found_error`,** a model ID has moved.
> `src/config.ts` holds the one most scripts use; `src/usage.ts` and
> `src/bench.ts` name all three for pricing and comparison; and `index.ts`,
> `chat.ts`, and `truncate.ts` hardcode one deliberately, because they exist to
> show a single call. The Python build mirrors all of those, in
> `pyweather/config.py`, `pyweather/usage.py`, and `pyweather/bench.py`. Run
> `npm run models` and update what you find. Don't trust a document over a live
> API — including this one.

For document 3 you also need **[uv](https://docs.astral.sh/uv/)**, which
installs Python itself along with the dependencies:

```bash
uv sync                # creates .venv and installs everything, Python included
npm run typecheck:py   # no key needed at all: proves the Python compiles
uv run weather         # needs WEATHER_API_KEY, but makes no Claude call
uv run dev             # the same first Claude call, in Python
```

`usage.csv` lives at the **repo root**, next to `package.json`, and both builds
write to that one file. npm gets there for free, because it runs its scripts
from the project root; the Python side does not lean on that — `pyweather/`
resolves both the ledger and `.env` from its own location on disk, so `uv run`
finds them from whichever directory you happened to be standing in.

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
So does `uv run usage`, reading the very same file: the two builds share one
ledger, and the `script` column tells you which language wrote each row. That
is document 3's argument made physical rather than argued — the file format is
real, and the language is just spelling.

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

`npm run verify:docs` rebuilds `src/` and `pyweather/` **from the tutorials'
own code blocks**, typechecks that, and diffs it back. If a code block and the
file it teaches ever disagree, CI fails.

It checks six things. Every Markdown file in the repo is structurally sound —
fences balanced, links resolving. The two languages' command lists stay in
sync — every npm script and every Python entry point in `pyproject.toml` names
the other, apart from the exceptions documented below, and every entry point
resolves to a module that really defines the function it names. Then, once
per document that has companion code: the document's code typechecks
(including the earlier version of any file built in stages), no edit
instruction tells you to make a change already present, every finished listing
matches the real file exactly, and nothing in the source tree is left
unexplained.

Document 2 is held to that standard by `tsc`, document 3 by `pyright`. Adding a
second language meant adding a row to a table in `scripts/check-docs.ts`, not a
second checker — the gates themselves never knew which language they were
looking at.

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
| `npm run typecheck` | — | — | Compiles without running. No API key needed. |
| `npm run typecheck:py` | — | — | The same, for `pyweather/`, via pyright. No API key needed. |
| `npm run verify:docs` | `scripts/check-docs.ts` | — | Checks both tutorials against both source trees. Repo infrastructure, not a lesson. |

**Imported by the above, not run directly:** `src/text.ts` (pulls text out of
content blocks), `src/config.ts` (the model ID, in one place), `src/usage.ts`
(the ledger and the price table), `src/weather.ts` (the weather client),
`body.json` (a request body for the raw `curl` exercise in Part 7).

Document 3 gives every lesson script above a Python counterpart under
`pyweather/`, run the same way with `uv run` instead of `npm run` — `uv run
agent`, `uv run parse`, and so on. The names match on purpose, with one
exception: `assistant:streaming` becomes `assistant-streaming`, because a
colon isn't legal in a Python entry-point name. `typecheck:py` is document
3's own correctness gate, not a per-script counterpart, and `typecheck` and
`verify:docs` aren't mirrored at all — `verify:docs` already checks both trees.

The four helpers have counterparts too — `pyweather/text.py`, `config.py`,
`usage.py`, `weather.py` — plus one with no TypeScript equivalent:
`pyweather/__init__.py`, which loads `.env` once for the whole package where
the npm scripts each pass `--env-file`.

---

## What it costs to run

Per script, and the same either way — running a lesson in Python costs what it
costs in TypeScript, because it is the same call.

| Script | Approximate |
|---|---|
| `typecheck`, `typecheck:py`, `verify:docs`, `usage` | Free, and no key needed at all |
| `weather` | Free — needs `WEATHER_API_KEY`, but makes no Claude call |
| `dev`, `truncate`, `stream`, `parse`, `models` | A fraction of a cent each |
| `agent`, `injection` | A fraction of a cent — a short tool loop, a few calls |
| `bench` | About 2¢ — nine calls across three models, most of it Opus |
| `chat`, `assistant`, `assistant:streaming` | Pennies per session |

`agent`, `injection`, `assistant`, and `assistant:streaming` look up live
weather, so they need **both** keys. Everything else that calls Claude needs
only `ANTHROPIC_API_KEY`.

Every call is logged to `usage.csv`, so you never have to guess.

**Set a spend limit on your Anthropic account anyway.** A loop with a mistake in
it can call the API thousands of times a minute, and you will write one, because
everyone does.

---

## Contributing

`main` requires a pull request. CI runs `typecheck`, `typecheck:py`, and
`verify:docs` on Node 20.x and 22.x — all keyless, so they run on forks without
secrets.

If you change a file in `src/`, change the matching code block in
`docs/typescript.md` too; likewise `pyweather/` and `docs/python.md`.
`verify:docs` will tell you if you forget, and it names the exact line.

Changing one language is usually a reason to look at the other. The two builds
are meant to stay the same program, and `pyweather/usage.py` in particular
*must* keep writing the same columns as `src/usage.ts` — they share a file.

Corrections to the tutorial are as welcome as corrections to the code. A
sentence that misleads a beginner is a bug.

---

## License

MIT — see [LICENSE](LICENSE). Use the code, copy it into your own projects,
teach from it. Attribution is welcome, not required.
