# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This repository is **tirocine**. Its first project is **weatherwise**, whose
tutorial series lives in `docs/`. Two documents have companion code: `src/` is
built entirely by `docs/typescript.md`, and `pyweather/` is built entirely by
`docs/python.md`. The setup and app documents have no code here yet.

It is a tutorial, not an application: every file in `src/` and `pyweather/`,
except the small set of shared helpers noted below, is a single, independently
runnable lesson, numbered by tutorial Part. There is no shared entry point —
each script is standalone, not imported into a larger program; the helpers are
the one thing that is imported rather than run.

**`pyweather/` is the same program as `src/`, written a second time.** The
Python document introduces no new *Claude* concepts — the reader has already
met them all in document 2 — so `pyweather/x.py` should stay recognisably the
same lesson as its `src/` counterpart.

It does, however, teach Python, because it assumes the reader knows none. Its
spine is a per-Part `Idea | TypeScript | Python` table: the left column is the
language-independent truth, the other two are spellings. Short "New to Python"
notes cover only what this program needs (virtual environments, packages and
imports, `main()` and entry points, type hints, pydantic vs `@dataclass`,
`try`/`except`, `with`, f-strings), each anchored to its TypeScript equivalent.
**Keep that shape when editing** — a Python explanation that doesn't tie back
to something in `src/` is usually out of scope for this document. Most share a base name
(`agent.py`↔`agent.ts`); the exceptions are `main.py`↔`index.ts`, and the
hyphenated TypeScript names, which become underscored in Python because
hyphens aren't legal in module names — `weather_test.py`↔`weather-test.ts`,
`parse_request.py`↔`parse-request.ts`, `usage_report.py`↔`usage-report.ts`,
`assistant_streaming.py`↔`assistant-streaming.ts`. When you change one side,
ask whether the other should change too. The one thing that is deliberately *not*
mirrored is `pyweather/usage.py`, which is byte-compatible with `src/usage.ts`
by necessity — see "The shared ledger" below.

Because this is tutorial code, prioritize clarity and matching the existing
comment style over typical "production" abstraction. Comments in this repo
explain *why* a line exists pedagogically — preserve that style when editing
lesson files rather than stripping comments down to a bare minimum.

## Commands

```bash
npm run typecheck             # tsc --noEmit — no API key needed, run this after any edit
npm run dev                   # src/index.ts — Part 2-3, first API call
npm run chat                  # src/chat.ts — Part 4, 6, conversation history + cost
npm run truncate               # src/truncate.ts — Part 5, max_tokens/stop_reason
npm run bench                  # src/bench.ts — Part 6, Haiku vs Sonnet vs Opus
npm run usage                   # src/usage-report.ts — Part 6, totals usage.csv, no API call
npm run weather                 # src/weather-test.ts — Part 7, fetch only, no AI
npm run parse                   # src/parse-request.ts — Part 8, structured output (zod)
npm run agent                   # src/agent.ts — Part 9, hand-written tool loop
npm run assistant                # src/assistant.ts — Part 9, chat loop + tool loop combined
npm run injection                 # src/injection.ts — Part 9, prompt injection via tool result
npm run stream                     # src/stream.ts — Part 10, messages.stream()
npm run assistant:streaming         # src/assistant-streaming.ts — Part 10.3/11/12, streaming + caching + retries
npm run models                       # src/models.ts — lists model IDs available to the API key
```

The Python half runs the same lessons through `uv`, and — unlike the npm
scripts above — from any directory inside the repo: `pyweather/` resolves
both the ledger and `.env` from its own location on disk, not from cwd.

```bash
npm run typecheck:py          # pyright, strict — run this after any pyweather/ edit
uv run dev                    # pyweather/main.py       ↔ npm run dev
uv run chat                   # pyweather/chat.py       ↔ npm run chat
uv run truncate               # pyweather/truncate.py
uv run bench                  # pyweather/bench.py
uv run usage                  # pyweather/usage_report.py — reads the SAME usage.csv
uv run weather                # pyweather/weather_test.py — needs WEATHER_API_KEY, no Claude call
uv run parse                  # pyweather/parse_request.py
uv run agent                  # pyweather/agent.py
uv run assistant              # pyweather/assistant.py
uv run injection              # pyweather/injection.py
uv run stream                 # pyweather/stream.py
uv run assistant-streaming    # pyweather/assistant_streaming.py
uv run models                 # pyweather/models.py
```

Those names are `[project.scripts]` entry points in the root `pyproject.toml`,
which is why every lesson module needs a `main()`. They deliberately match the
npm script names, so `npm run agent` and `uv run agent` are the same lesson in
the two languages. The one exception is `assistant-streaming`, because a colon
is illegal in an entry-point name.

There is no test suite and no lint script. The correctness gates are
`npm run typecheck` (TypeScript), `npm run typecheck:py` (Python), and
`npm run verify:docs` (both documents against both trees). All three are
keyless. Run the relevant ones after any edit.

TypeScript scripts load `.env` via `--env-file=.env`; the Python side calls
`load_dotenv()` once in `pyweather/__init__.py` instead. Both read the same
root `.env` (set from `.env.example`; requires `ANTHROPIC_API_KEY` and
`WEATHER_API_KEY`). Everything except the typecheck gates, `weather`, `usage`
(which makes no API call at all), and, probably, `models` (which needs a key
but only lists them) makes real, billed API calls — keep that in mind before
running them repeatedly in a loop.

## Architecture

**Shared helpers, imported by the lesson scripts that need them:**

- `src/text.ts` — `textFrom(message)`. `Message.content` is an array of
  typed blocks (text, tool_use, thinking, …), not a string. This filters to
  text blocks and joins them. Used everywhere a response is printed instead
  of indexing `content[0].text` directly.
- `src/config.ts` — `MODEL`, one constant used by every script from Part 8
  onward. `index.ts`, `chat.ts`, and `truncate.ts` hardcode the model ID
  intentionally (they exist to show a single call) — don't "fix" those to
  import `MODEL`.
- `src/usage.ts` — `logCall(script, model, prompt, message)`, `costOf(...)`,
  and a hardcoded USD/million-token `PRICES` table. Every Claude call appends
  one row to `usage.csv`. Prices are a point-in-time snapshot (see the comment
  date in the file) — if pricing looks wrong, verify against
  platform.claude.com/docs rather than assuming the table is stale and
  silently "fixing" it without checking. There is no `src/cost.ts`.
- `src/usage-report.ts` — reads `usage.csv` back and totals it (`npm run
  usage`). Looks columns up **by header name**, not by position.
- `src/weather.ts` — `getWeather(location)` and two interfaces:
  `WeatherApiResponse` (WeatherAPI.com's wire shape) kept deliberately
  separate from `Weather` (this program's shape). Preserve that separation in
  any edits — it's the Part 7 lesson, not incidental structure.

The Python side has the same four helpers under the same names:
`pyweather/text.py` (`text_from`), `pyweather/config.py` (`MODEL`),
`pyweather/usage.py` (`log_call`, `cost_of`, `PRICES`), `pyweather/weather.py`
(`get_weather`, plus the same deliberate `WeatherApiResponse` / `Weather`
split — pydantic models there, which unlike TypeScript interfaces actually
validate at runtime). `pyweather/__init__.py` is a fifth with no TypeScript
counterpart: it calls `load_dotenv()` once for the whole package.

**The tool-loop pattern** (`agent.ts`, `assistant.ts`,
`assistant-streaming.ts`, `injection.ts` — and their `pyweather/` counterparts
— all implement variants of this):

1. Call `messages.create` (or `.stream`) with a `tools` array.
2. If `stop_reason === 'tool_use'`, push the assistant's response blocks
   back into `messages`, then iterate every `tool_use` block in
   `response.content` (there can be more than one per turn — never assume
   exactly one) and run the corresponding local function.
3. Tool errors are caught and returned as `{ is_error: true, content: ... }`
   tool_result blocks — never thrown — so the model sees the failure and can
   adapt instead of crashing the loop.
4. Push a `user` message containing all `tool_result` blocks, keyed back to
   their call via `tool_use_id`, and repeat from step 1 until `stop_reason`
   is no longer `tool_use`.

`assistant.ts` nests this tool loop inside Part 4's `readline`-based chat
loop, so a `respond(messages)` function owns one full round including any
tool calls. `assistant-streaming.ts` is the same shape with
`messages.stream()`, `cache_control: { type: 'ephemeral' }` on every call,
and `client` constructed with `maxRetries`/`timeout` (Part 12). Preserve the
`assistant.ts` / `assistant-streaming.ts` split — the tutorial's own
instructions say to edit `assistant.ts` in place for streaming, but this repo
deliberately keeps both versions runnable side by side so the two lessons can
be compared. Don't merge them or delete the non-streaming one.

`injection.ts` is `agent.ts` with the tool result deliberately poisoned with
injected instructions (`POISON`), to demonstrate that tool output is
untrusted data. If asked to "fix" the vulnerability by uncommenting the
`BOUNDARY` system-prompt addition, understand that this is explicitly framed
in the file's own comments as a demonstration that model-level resistance is
not a real security control — don't present it as a fix.

**ESM import quirk:** local imports use a `.js` extension even though source
files are `.ts` (e.g. `import { getWeather } from './weather.js'`). This is
required by `moduleResolution: NodeNext` in `tsconfig.json` — the extension
refers to compiled output, not source. Keep this pattern in any new files.

`pyweather/` uses relative package imports instead (`from .weather import
get_weather`), because it is a real package rather than a folder of scripts.
Keep that pattern too — an absolute `from pyweather.weather import ...` would
also work but reads as if the lessons were importing some third-party library.

**The shared ledger.** `pyweather/usage.py` appends to the **same
`usage.csv`** as `src/usage.ts`, so `npm run usage` and `uv run usage` both
total rows written by both languages. The `script` column distinguishes them —
`log_call` prefixes the Python ones with `py:`. This is the Python document's
thesis made concrete, so treat the CSV as a contract:

- The 15 `COLUMNS` and their order must stay identical in both writers. The
  header guard in each `logCall`/`log_call` throws rather than appending under
  a mismatched header — that check is the enforcement, don't weaken it.
- Only `prompt` and `reply` are quoted; the other 13 columns are raw.
- One UTF-8 BOM, written only when the file is created. LF line endings.
  `usage.py` opens with `newline=""` for exactly this reason — Python would
  otherwise write CRLF on Windows and break `usage-report.ts`'s line splitting.
- `usage.py` resolves the ledger path from `__file__`, not the working
  directory, because `uv run` (unlike npm) does not guarantee the repo root.
  A ledger that silently splits in two defeats the whole lesson.

**Model IDs and pricing are pinned, not evergreen.** `src/config.ts`,
`src/bench.ts`, `pyweather/config.py`, and `pyweather/bench.py` hardcode model
IDs; `src/usage.ts` and `pyweather/usage.py` hardcode prices. If a script fails
with `404 not_found_error`, or pricing looks off, run `npm run models` to check
what the live API actually returns rather than trusting this repo or the
tutorial document.

**`verify:docs` covers both documents.** `scripts/check-docs.ts` runs six
gates: two repo-wide ones first — structure (every Markdown file's fences
balance and its links resolve) and command parity (every `package.json`
script has a matching `uv run` entry point in `pyproject.toml`, and vice
versa) — then, per document, the four code-coupling gates: compile, ordering,
diff, coverage. A `LANGUAGES` table holds everything language-specific (fence
names, marker comment syntax, comment stripping, how to typecheck, which
directory); the six gates themselves are shared, so adding a third language
means adding a row, not a branch. The command parity gate is why adding an
npm script without a matching `[project.scripts]` entry in `pyproject.toml`
fails `verify:docs` — three scripts are deliberately exempt from that check
(`NPM_ONLY` in `check-docs.ts`): `typecheck`, `typecheck:py`, and
`verify:docs` itself, since they're infrastructure, not lessons, and have no
Python counterpart to pair with. Note the Python comment stripper
also drops **docstrings** that sit alone on their own lines, because Python
puts its teaching headers in docstrings where TypeScript puts them in `//`
comments; without that the document would have to reproduce every docstring
verbatim.

**The stripping is also a blind spot, and it is the one to remember.** Because
comments are removed from *both* sides before the diff gate compares them, a
teaching comment can drift out of step with its listing in the document — or
say something flatly untrue — while all six gates stay green. The comments are
the teaching in this repo, so that is not a small hole: when you edit a comment
in `src/` or `pyweather/`, sync the document's copy by hand, because nothing
else will.
