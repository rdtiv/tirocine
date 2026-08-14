# `.grok/` — Grok Build project surface

Portable Grok configuration for this repository. **Checked into git** so any
clean clone shares the same contracts after `git pull`.

Claude Code continues to use `.claude/` and `~/.claude/`. The two drivers are
deliberately namespaced; see `skills/xmission/references/dual-driver.md`.

## What is tracked

| Path | Purpose |
|------|---------|
| `skills/xmission/` | **`/xmission`** — Grok mission contract (provision → execute → decommission) |
| `rules/dual-driver.md` | Always-on coexistence with Claude Code |
| `scripts/landed.sh` | Per-file land check used by `/xmission end` (no `~/.claude` dependency) |
| `README.md` | This file |

User-global Grok memory (when enabled): `~/.grok/memory/MEMORY.md` (not in this repo).

## What is not tracked

| Path | Why |
|------|-----|
| `.grok/worktrees/`, `.claude/worktrees/` | Long-lived mission checkouts; local to each machine |
| root `.env*` / `node_modules/` | Secrets and installs (already ignored repo-wide) |

Root `.gitignore` encodes the worktree roots. **Never `git clean -x` on main**
while any worktree exists — ignored mission dirs are still live checkouts
(`git worktree list` first).

## Dual machine

- **Pull the repo** — skills and rules appear under `.grok/` automatically.
- **Worktrees are not synced.** On the other machine: `git fetch`, then either
  re-attach with `git worktree add .grok/worktrees/wt-<ref>-<stream> <branch>`
  for a pushed branch, or provision fresh with `/xmission`.
- **Branches are shared** via `origin`. Push the mission branch before switching
  machines if you intend to continue there.
- No home paths are **depended on** for xmission to run (docs may mention
  `~/.claude/…` as do-not-touch references only).

## Invoke

In a Grok Build session rooted at this repo:

```
/xmission <issue# | pr# | description>
/xmission end
```

Natural language (“run an xmission for …”) should load the same skill.

Claude’s `/mission` remains Claude’s (user/global command). Do not treat it as
Grok law unless the operator says so.
