# Weatherwise Setup — macOS

> **The weatherwise series**
> 1. Setup — [Windows](setup-windows.md) · **macOS** *(you are here)*
> 2. [The TypeScript build](typescript.md) — the assistant, start to finish
> 3. [The Python build](python.md) — the same program again, to see which ideas were real
> 4. [The app](app.md) — lifting it onto the web with Next.js, the AI SDK, and Vercel

> **This document is a stub.** The macOS setup has not been written into this
> series yet. Until it is, follow your existing macOS front matter, then pick up
> at [the TypeScript build](typescript.md).

**To be equivalent to the Windows setup, this needs to cover:**

- A terminal, and the four commands that do most of the work (`pwd`, `ls`, `cd`, `cd ..`)
- Homebrew as the package manager, in place of winget
- Node 20.6 or later (20.6 is when `--env-file` arrived), Git, `jq`, and the GitHub CLI
- `git config` — name, email, and `init.defaultBranch main`. macOS does **not** need `core.autocrlf`
- A GitHub account, two-factor auth, and `gh auth login`
- Claude Code, and `claude doctor` as the first thing to run when something feels wrong
- Cursor, with whitespace display and format-on-save turned on
- A project directory convention (`~/dev`), and why not iCloud Drive — the same reasoning as the Windows note about OneDrive
- The Anthropic API key, a spend limit set **before** writing code, and `.env` + `.gitignore`
- Putting the repo on GitHub, privately

**And these Windows-specific items have macOS equivalents that differ enough to be worth calling out:**

| Windows | macOS |
|---|---|
| `curl.exe` (PowerShell shadows `curl`) | plain `curl` |
| `$env:VAR = "value"` | `export VAR="value"` |
| backtick line continuation | backslash `\` |
| `&&` unsupported in PowerShell 5.1 | `&&` works |
| `del file` | `rm file` |
| `copy a b` | `cp a b` |
| `core.autocrlf true` | not needed |

The TypeScript build assumes only that this setup is done. Part 7 is the one
section with genuinely platform-specific commands; it calls out both.
