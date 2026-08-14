# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dual-driver namespaces

Grok sessions use `.grok/` and `/xmission`. Claude sessions use this file and
`/mission`. The two must not share worktree paths, branch prefixes, or ports.

| Driver | Command | Worktrees | Branches | Dev port |
|--------|---------|-----------|----------|----------|
| Claude Code | `/mission` | `.claude/worktrees/` | house scheme (no `x/` prefix) | `3000 + (ref % 1000)` → **3000–3999** |
| Grok Build | `/xmission` | `.grok/worktrees/` | `x/<type>/<slug>` | `4000 + (ref % 1000)` → **4000–4999** |

- Do **not** create, edit, or decommission the other driver's worktrees.
- Feature commits never happen on the main checkout.
- Operator owns the merge. Do not post `@claude` on PRs unprompted.

## What this repo is

This repository is **tirocine**. Its first project is **weatherwise**, whose
tutorial series lives in `docs/`. Unprefixed files in `src/` are built by
`docs/typescript.md`. `src/grok-*.ts` is built by `docs/grok.md`. The setup,
Python, and app documents have no code here yet. It is a tutorial, not an
application: every file in `src/` is a single, independently runnable lesson.
There is no shared entry point — each script is a standalone `.ts` file run
directly via `tsx`, not imported into a larger program (except for the small
set of shared helpers noted below).

Unprefixed scripts (`src/index.ts`, `src/assistant.ts`, …) are the Claude
lesson. `src/grok-*.ts` is the Grok transfer. Do not merge the two assistants.

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
npm run weather                 # src/weather-test.ts — Part 7, fetch only, no AI
npm run parse                   # src/parse-request.ts — Part 8, structured output (zod)
npm run agent                   # src/agent.ts — Part 9, hand-written tool loop
npm run assistant                # src/assistant.ts — Part 9, chat loop + tool loop combined
npm run injection                 # src/injection.ts — Part 9, prompt injection via tool result
npm run stream                     # src/stream.ts — Part 10, messages.stream()
npm run assistant:streaming         # src/assistant-streaming.ts — Part 10.3/11/12, streaming + caching + retries
npm run models                       # src/models.ts — lists model IDs available to the API key
npm run grok                      # src/grok-index.ts — first Responses call
npm run grok:chat                  # src/grok-chat.ts — store:false local array, or previous_response_id
npm run grok:parse                 # src/grok-parse.ts — same Zod, zodTextFormat, output_parsed
npm run grok:agent                 # src/grok-agent.ts — hand-written function_call loop
npm run grok:search                # src/grok-search.ts — web_search (theirs) + get_weather (yours)
npm run grok:assistant             # src/grok-assistant.ts — finished Grok program, local weather only
npm run grok:stream                # src/grok-stream.ts — stream: true, output_text.delta
npm run grok:injection             # src/grok-injection.ts — same POISON as injection.ts
npm run grok:models                # src/grok-models.ts — lists model IDs for the xAI key
npm run usage                      # src/usage-report.ts — totals usage.csv (Claude + Grok rows)
npm run verify:docs                # scripts/check-docs.ts — tutorial fences vs src/
```

There is no test suite and no lint script. `npm run typecheck` is the only
correctness gate — run it after editing any `src/*.ts` file. `npm run
verify:docs` is the second gate when you touch a companion document.

All runnable scripts load `.env` via `--env-file=.env` (set from
`.env.example`; requires `ANTHROPIC_API_KEY` and `WEATHER_API_KEY`).
`XAI_API_KEY` is optional and only the `grok*` scripts need it. Scripts
other than `typecheck`, `weather`, `usage`, and (partially) `parse`/`models`
make real, billed API calls — keep that in mind before running them
repeatedly in a loop.

## Architecture

**Shared helpers, imported by the lesson scripts that need them:**

- `src/text.ts` — `textFrom(message)`. `Message.content` is an array of
  typed blocks (text, tool_use, thinking, …), not a string. This filters to
  text blocks and joins them. Used everywhere a Claude response is printed
  instead of indexing `content[0].text` directly.
- `src/config.ts` — `MODEL`, one constant used by every Claude script from
  Part 8 onward. `index.ts`, `chat.ts`, and `truncate.ts` hardcode the model
  ID intentionally (they exist to show a single call) — don't "fix" those to
  import `MODEL`.
- `src/usage.ts` — `logCall(script, model, prompt, message)` plus a
  hardcoded USD/million-token `PRICES` table. Writes `usage.csv`. Prices are
  a point-in-time snapshot (see the comment date in the file) — if pricing
  looks wrong, verify against platform.claude.com/docs rather than assuming
  the table is stale and silently "fixing" it without checking.
- `src/grok-text.ts` / `src/grok-config.ts` / `src/grok-usage.ts` — the Grok
  twins. `logGrokCall` writes the same fifteen CSV columns. Import
  `logGrokCall` from `./grok-usage.js`, never `./usage.js`. Keep
  `grok-usage.ts` free of Anthropic types.
- `src/weather.ts` — `getWeather(location)` and two interfaces:
  `WeatherApiResponse` (WeatherAPI.com's wire shape) kept deliberately
  separate from `Weather` (this program's shape). Preserve that separation in
  any edits — it's the Part 7 lesson, not incidental structure. Both
  assistants import this file.

**The tool-loop pattern** (`agent.ts`, `assistant.ts`,
`assistant-streaming.ts`, `injection.ts` all implement variants of this):

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

**The Grok tool-loop** (`grok-agent.ts`, `grok-assistant.ts`,
`grok-injection.ts`, and the mixed half of `grok-search.ts`) is the same
shape with Responses spelling: loop while `output` contains
`function_call`, `JSON.parse(arguments)`, send
`{ type: 'function_call_output', call_id, output }`, errors back as the
output string (no `is_error`). `grok-search.ts` also uses hosted
`web_search` — loop only for `function_call`, never for `web_search_call`.
`grok-assistant.ts` is local weather only; do not add `web_search` there.

**ESM import quirk:** local imports use a `.js` extension even though source
files are `.ts` (e.g. `import { getWeather } from './weather.js'`). This is
required by `moduleResolution: NodeNext` in `tsconfig.json` — the extension
refers to compiled output, not source. Keep this pattern in any new files.

**Model IDs and pricing are pinned, not evergreen.** `src/config.ts` and
`src/bench.ts` hardcode Claude model IDs; `src/usage.ts` hardcodes Claude
prices; `src/grok-config.ts` and `src/grok-usage.ts` pin Grok. If a
script fails with `404 not_found_error`, or pricing looks off, run `npm run
models` or `npm run grok:models` to check what the live API actually returns
rather than trusting this repo or the tutorial document.
