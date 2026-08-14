# xmission fleet and effort

## Built-in agent types (durable Grok Build)

Do **not** depend on Claude-only user agents (e.g. under a home `~/.claude/agents/`
install) for portability — xmission must work on a clean clone with only this repo.

| Type | Use | Mutates files? |
|------|-----|----------------|
| `explore` | Recon, mapping, coverage hunting | No |
| `plan` | Specs, architecture, package breakdown | No |
| `general-purpose` | Implementation, docs, multi-step write | Yes |

Personas/roles (implementer, reviewer, researcher, …) may layer behavior and
default `reasoning_effort` when the runtime resolves them. Prefer explicit
prompts + capability modes in v1.

## Phase → spawn map

| Phase | `subagent_type` | `capability_mode` | `isolation` | Effort intent |
|-------|-----------------|-------------------|-------------|---------------|
| Recon / map | `explore` | `read-only` | `none` | low–medium |
| Spec / design | `plan` (or orchestrator) | `read-only` | `none` | high–xhigh |
| Implement package | `general-purpose` | `all` (or narrowest that works) | `worktree` if concurrent writers; else mission wt `cwd` | medium–high |
| Local review (coverage) | `explore` or GP | `read-only` | `none` | medium–high |
| Local review (judgment) | GP / reviewer | `read-only` | `none` | high–xhigh |
| Docs gate | `general-purpose` | `read-write` (prompt: docs only) | mission wt | medium |

## Effort controls (operator + orchestrator)

| Control | Meaning |
|---------|---------|
| `/effort low\|medium\|high\|xhigh` | Session reasoning effort on the current model (if supported) |
| `/model …` | May accept effort as a second argument on reasoning models |
| Role/persona `reasoning_effort` | Defaults for resolved children |

Record known session effort on the first status line when the operator set it.

## Prompt invariants

1. **Read-only children** — every prompt includes an explicit no-mutation clause.
   Capability mode alone is not enough as a narrative contract.
2. **Implementors** get self-contained specs: paths, change, invariants,
   out-of-scope, verify commands. Not “continue from chat.”
3. **Few, fat packages** on unattended tier; freer parallel `explore` on in-loop.
4. **Local review clean** before remote or operator `@claude`.
5. Feature commits only inside mission worktrees (`git -C <wt>` / `cd <wt> &&` same line).

## Optional v1.1

Project agents under `.grok/agents/` that alias this table (`x-scout`, …) if
named types help the operator. Not required for v1.
