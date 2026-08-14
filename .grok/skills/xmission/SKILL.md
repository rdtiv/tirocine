---
name: xmission
description: >
  Run a Grok mission (xmission): provision worktree(s), execute under the dual-driver
  contract, decommission cleanly. Use when the user runs /xmission, says "xmission",
  "start an xmission", or "xmission end". Grok-native counterpart to Claude /mission —
  never confuses namespaces with .claude/worktrees or unprompted @claude PR review.
---

# `/xmission` — Grok mission contract

You are running an **xmission**: one kickoff ↔ one branch family ↔ one session.
Arguments: an issue number, a PR number, a description — or the word **`end`**.

References (read when relevant):

- `references/dual-driver.md` — Claude coexistence, `@claude` review, ownership
- `references/contract-diff.md` — intentional diffs vs Claude `/mission`
- `references/fleet.md` — subagent types, effort, prompt invariants

## First status line (always)

```
xmission · driver:grok · tier:<in-loop|unattended> · ref:<ref> · worktrees:[…] · port:<n>
```

Name the **tier** you are on (operator sets intent; you observe and state it):

- **in-loop** — operator clarifying unknowns as work proceeds; freer parallel recon
- **unattended** — complete spec up front; capped delegation; less chat

Do not use Claude product names (Fable/Opus) as if they were Grok controls. Map
operator language to the two tiers above. Record `/effort` if the operator set it.

## If starting (`/xmission <issue# | pr# | description>`)

### 1. Provision

1. Read the kickoff — fetch the issue or PR if given. **Fix `<ref>` now**: issue
   number, PR number, or a short slug for a description kickoff. Everything keys off it.
2. **Description kickoffs need a durable home.** Multi-package work: draft an issue
   and get operator OK before worktrees. Small work: say so in the first status line
   and use the PR description as the artifact — do not proceed silently without a home.
3. Create worktree(s) from the default remote branch:

   ```sh
   git fetch origin
   git worktree add .grok/worktrees/wt-<ref>-<stream> -b x/<type>/<slug> origin/<default>
   ```

   - Path: **`.grok/worktrees/wt-<ref>-<stream>`** (never `.claude/worktrees/`)
   - Branch: **`x/<type>/<slug>`** or `x/<type>/<slug>-<stream>`
   - Base: always `origin/<default>`, never a sibling stream
   - Prefer one stream unless streams are truly independent PRs
4. Record the full worktree list on the kickoff artifact:

   ```
   driver: grok
   ref: <ref>
   worktrees: …
   branches: …
   port: …
   ```

5. Install **real** dependencies in each worktree (`npm ci`, etc.).
   Do **not** symlink `node_modules` from main.
6. **Dev port** — range **4000–4999**, disjoint from Claude’s 3000–3999:

   ```sh
   # numeric ref (issue/PR number):
   port=$((4000 + (ref % 1000)))
   # non-numeric slug (cksum prints "<crc> <bytes>" — take field 1 only):
   port=$((4000 + $(printf %s "$slug" | cksum | cut -d' ' -f1) % 1000))
   # if bound (second stream or leftover server), increment until free; record actual:
   while lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; do port=$((port + 1)); done
   ```

   Record the **actual** port on the kickoff artifact. Claude uses
   `3000 + (ref % 1000)` — never share a base with that range.
   This repo’s lessons are CLI; if there is no web server, record `port: none`.
7. Open an in-session task list — one task per work package. Always for an xmission.

### 2. Task list vs externalized state

- **Task list** = in-session working state; dies with the session; keep current.
- **Externalized state** = issue/PR comments and durable docs; outlives the session.
  A thorough issue with an untouched task list fails step 2’s purpose.

### 3. Execute

Your job is design, specification, judgment, and coordination. See
`references/fleet.md` for spawn types and effort.

Pipeline:

1. Recon (`explore`, read-only, explicit no-mutation in every prompt)
2. Specs (`plan` or you write them): files with anchors, change, invariants,
   out-of-scope, verification commands
3. Implement (`general-purpose` in mission worktree; `isolation: worktree` only when
   concurrent writers need private trees — then merge into the mission branch explicitly)
4. Local review to clean (coverage then judgment) **before** remote/CI
5. PR gate — prepare for the operator; see dual-driver rules below

**Tier guidance**

- **unattended** — cap spawn count; few fat packages; do not re-derive a child’s report
- **in-loop** — freer parallel recon; keep talking to the operator; intervene when off-track

Inline work is fine for trivial edits, specs, judgment, and integration.

All commits in a mission worktree — never the main checkout. Always
`git -C <worktree>` or `cd <worktree> && …` on the **same** command line.

### 4. Externalize

At every phase end, update the kickoff artifact so a fresh session can resume
from artifacts alone.

## If finishing (`/xmission end`)

Decommission is incomplete until all of:

1. Mission PRs **merged by the operator** or explicitly parked on the kickoff with
   what remains and why.
2. **Documentation gate** — docs impact PR or explicit no-docs-impact recorded on
   the kickoff. Merging docs stays a human decision.
3. Reconcile the task list into the kickoff; disposition findings; then clear the list.
4. For **every** mission worktree (enumerate `git worktree list` × kickoff record):

   ```sh
   git fetch origin
   .grok/scripts/landed.sh <branch> origin/<default>
   # exit 0 required before remove — script does not fetch; stale origin is a false UNLANDED
   git -C <wt> status --short   # must be empty
   ```

   Use the script’s **exit code**, never a pipe. Do not trust ancestry or plain
   two-dot tree-diff alone (squash merges and moving main false-positive).

5. Remove every mission worktree; delete the branch family after the stack is in;
   re-list worktrees and confirm none remain.
6. Final summary: what was removed, what was parked.

## Standing rules (both directions)

### Dual-driver and review (non-negotiable)

1. **Operator owns merge.** Never merge unless explicitly ordered. Never impersonate
   the operator’s ship vote.
2. **`@claude` on PRs is the operator’s clean review process** when a
   mention-triggered workflow exists. Do **not** post `@claude` unprompted.
   Do not overwrite Claude review threads. When the operator runs that gate, treat
   findings as first-class; fix when directed. Babysit CI as asked.
3. **Local review clean before remote** — including before the operator invites
   `@claude` or other remote reviewers. Never run local and remote review fix-loops
   concurrently on the same branch.
4. Do not edit Claude mission worktrees (`.claude/worktrees/…`) or Claude’s
   `~/.claude/commands/mission.md`.
5. One owner per kickoff (`driver: grok` on the artifact).

### Main checkout

- Integration ground only: pulls, triage, review coordination.
- Feature commits never happen there.
- Dirt on main may be another session’s work — **report and route around**; never
  `reset` / `clean` / `checkout .` it away.
- **Never `git clean -x` / `-xd` / `-xdf` on main while any worktree exists.**
  Mission worktrees live under ignored paths (`.grok/worktrees/`,
  `.claude/worktrees/`); `-x` deletes ignored dirs and will wipe live mission
  checkouts with no `git status` warning. Enumerate first: `git worktree list`.

### Engineering discipline

- **Migrations before code that needs them.** Merge-to-default is production rollout
  when the default branch auto-deploys. Additive migrations on prod/dev DB before
  merging schema-using code; expand → migrate → contract for destructive changes.
  No schema push as the prod path. This repo is a tutorial CLI today — still do
  not invent a later “rollout step.”
- Long commit messages and PR bodies go in a file: `git commit -F` / `gh pr --body-file`.
- Never rename a branch that has an open PR.
- Stacked PRs with kept branches: retarget base to main before merge; tree-diff the
  landing — do not trust MERGED alone.
- Verify commands by **exit code**, never through a pipe (`cmd > log 2>&1; echo exit:$?`).
- Shell cwd resets between tool calls — always pin worktree in the same line.
- Restart dev servers after branch/worktree switches before trusting behavior probes.
- Parallel missions can collide on shared docs — note territories at kickoff; re-fetch
  before integration merges.

### Worktree lifecycle

- One xmission per worktree set; never reuse a worktree for a different mission.
- Multiple worktrees within one xmission are fine for independent PR streams.
- Ephemeral agent `isolation: worktree` is for concurrent writers; long-lived streams
  use `.grok/worktrees/wt-<ref>-<stream>` and must be decommissioned.

## Mission arguments

Kickoff is whatever the operator passed with `/xmission` or in natural language
(issue #, PR #, description, or `end`). Grok skill invocation does not reliably
expand Claude-style `$ARGUMENTS` placeholders — read the **user message** as the
kickoff source of truth.
