# Weatherwise — From Script to Deployed App

> **The weatherwise series**
> 1. Setup — [Windows](setup-windows.md) · [macOS](setup-mac.md)
> 2. [The TypeScript build](typescript.md) — the assistant, start to finish
> 3. [The Grok transfer](grok.md) — the same assistant against xAI
> 4. [The Python build](python.md) — the same program again, to see which ideas were real
> 5. **The app** — lifting it onto the web with Next.js, the AI SDK, and Vercel *(you are here)*

**Before you start:** finish [the TypeScript build](typescript.md). This document takes the assistant you already have and puts it on the web.

> **This document is a stub.** It hasn't been written yet.

## What it will cover

The command-line assistant works, and it has a problem you cannot fix from the
terminal: it only runs on your machine, and the one thing you must never do is
ship your API keys to a browser. This document is about that gap.

The intended arc, roughly:

1. **Why a browser can't call Claude directly.** The keys. This is the whole
   reason a server exists, and it's the first thing to understand — not a
   detail to bolt on later. The TypeScript build's rule that a key is "a
   password that spends money" is what forces the architecture here.
2. **Next.js and the App Router**, enough of it to have a page and a route
   handler, without a tour of the whole framework.
3. **The route handler is your tool loop.** The `respond()` function already
   written in `src/assistant-streaming.ts` moves server-side almost unchanged.
   That continuity is the lesson: it was never terminal code, it was just code
   that happened to be running in a terminal.
4. **The Vercel AI SDK** — what it gives you over calling `@anthropic-ai/sdk`
   directly (streaming to a React client, `useChat`, tool plumbing), and,
   just as importantly, what it costs you in indirection. The Anthropic SDK is
   still down there.
5. **Streaming to a browser.** Part 10 made text arrive a token at a time in a
   terminal; this is the same idea over HTTP, and the reason the AI SDK exists.
6. **Deploying to Vercel**, environment variables in a hosted environment, and
   why `.env` does not come with you.
7. **What changes about cost.** The usage ledger writes to a local CSV, which
   is exactly wrong for a deployed app — every instance has its own disk, and
   it disappears on redeploy. Where telemetry goes instead.
8. **What changes about prompt injection.** Part 9's lesson gets sharper when
   the tool results are reaching strangers' browsers rather than your terminal.

## Open questions to settle before writing

- Whether the app reuses `src/weather.ts` and the tool definition directly, or
  whether the series is clearer if the app is a separate project that imports
  nothing. Reuse shows continuity; separation shows the deployment boundary.
- Whether to use the AI SDK at all, or to keep `@anthropic-ai/sdk` and write
  the streaming response by hand once before introducing the abstraction. The
  second is more work and probably teaches more.
- How much Next.js to teach. The risk is this becoming a Next.js tutorial with
  Claude in it, rather than the fourth act of a Claude tutorial.
