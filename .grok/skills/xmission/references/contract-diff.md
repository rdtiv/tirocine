# Intentional diffs: Claude `/mission` vs Grok `/xmission`

Shared law (do not dilute):

- One kickoff ↔ one branch family ↔ one session
- Main checkout = integration only; feature work in worktrees
- In-session task list vs durable externalized state
- Local review clean before remote/CI
- Migrations before code that needs them (merge-to-default is deploy)
- Decommission with per-file land check, not ancestry or raw two-dot diff
- Operator owns merge; dirt on main is never cleaned away by an agent

| Aspect | Claude `/mission` | Grok `/xmission` |
|--------|-------------------|------------------|
| Command name | `/mission` | `/xmission` |
| Worktree root | `.claude/worktrees/` | `.grok/worktrees/` |
| Branch naming | existing house scheme | `x/<type>/…` (driver-visible) |
| Port range | 3000–3999 | 4000–4999 (disjoint) |
| Land script | often `~/.claude/scripts/landed.sh` (user install) | `.grok/scripts/landed.sh` (**repo-tracked**; no home dependency) |
| Fleet | Pinned Claude agents + PreToolUse | Documented Grok built-ins + skill table (`references/fleet.md`) |
| Effort | Per-agent model×effort pins | Session `/effort` + role/persona defaults + phase table |
| Superpower emphasis | Unattended fleets, install hooks | Second-opinion review, integration peer, workflows later, cross-driver resume |

Grok may still *list* Claude’s `/mission` via skill compatibility. That is not
the Grok contract. For Grok-owned work, invoke **`/xmission`**.

Home-path mentions in docs (`~/.claude/…`) are **do-not-depend / do-not-touch**
references, not runtime dependencies. Portability means no home path is required
for xmission to run on a clean clone.
