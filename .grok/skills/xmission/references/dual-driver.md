# Dual-driver coexistence

Canonical short form for always-on Grok rules: `.grok/rules/dual-driver.md`.
Bilateral Claude entry: root `CLAUDE.md`.

## Who is who

| Driver | Command | Worktrees | Branches | Dev port range |
|--------|---------|-----------|----------|----------------|
| Claude Code | `/mission` | `.claude/worktrees/` | house scheme (no `x/` prefix) | **3000–3999** = `3000 + (ref % 1000)` |
| Grok Build | `/xmission` | `.grok/worktrees/` | `x/<type>/<slug>` | **4000–4999** = `4000 + (ref % 1000)`, then increment if bound |

Same issue number must not produce the same worktree path. Port bases are **1000 apart**
so the full modulus ranges are **disjoint**.

If the computed port is already in use (second stream, leftover server), increment
until free and **record the actual port** on the kickoff artifact. CLI-only work
records `port: none`.

## Operator identity

The human operator is always the merge authority. Agents prepare, implement,
review locally, and babysit CI. They do not merge unless ordered.

## `@claude` PR review

If a mention-triggered `@claude` workflow exists, it is the operator’s pre-merge
review ritual. This repo may or may not have that workflow; the Grok rule is the
same either way:

- Treat `@claude` results as first-class review feedback when present.
- Prepare PRs so that gate is useful (clear summary, test plan, local gates green).
- Not invoke `@claude` unless the operator asks.
- Not replace that ritual with a silent Grok-only “LGTM.”

Local review (xmission fleet) runs **to clean before** any remote/CI review invite —
including before the operator chooses to `@claude`.

## Concurrent missions

One kickoff artifact records:

```
driver: grok | claude
ref: …
worktrees: …
branches: …
port: …
```

A second driver on the same kickoff is babysit/review only unless the operator
reassigns ownership in writing on that artifact.

## Shared durable state

Kickoff = GitHub issue or PR description. Either tool can *read* it; only the
owner decommissions worktrees and closes the mission.
