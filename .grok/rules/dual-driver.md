# Dual-driver rules (Grok + Claude)

Always on for Grok sessions in this repo. Claude sessions get the same table via
root `CLAUDE.md`. Detail: `.grok/skills/xmission/references/dual-driver.md`.

1. **Operator owns the merge.** Never merge a PR or claim ship authority unless the
   operator explicitly orders it.
2. **`@claude` on PRs is the operator’s clean review process** when a
   mention-triggered workflow exists. Do not post `@claude` unprompted. Do not
   overwrite Claude review comments. Fix findings when directed.
3. **Namespaces**

   | Driver | Worktrees | Branches | Port range |
   |--------|-----------|----------|------------|
   | Grok | `.grok/worktrees/` | `x/<type>/…` | **4000–4999** (`4000 + ref%1000`, then free-port bump) |
   | Claude | `.claude/worktrees/` | house scheme | **3000–3999** (`3000 + ref%1000`) |

4. **One owner per kickoff.** The other driver may babysit or review read-only.
5. **Main checkout is integration ground** for both drivers. Feature commits only
   in a mission worktree. Dirt on main is never yours to clean. Never
   `git clean -x{d,f}` while any worktree exists (`git worktree list` first).
6. Full contract: `.grok/skills/xmission/` (`/xmission`).
