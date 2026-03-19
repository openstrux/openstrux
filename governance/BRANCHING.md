# Branching & Release Workflow

This document defines the branching model, release process, and worktree policy across all Openstrux repos. It is normative for all contributors and AI agents.

---

## Branching model

The model is GitHub Flow extended with release branches — looser than Git Flow, more structured than pure trunk-based. This reflects the reality of a versioned spec: `main` must always be releasable, but released minor versions need maintenance branches.

### Permanent branches

| Branch | Purpose |
|---|---|
| `main` | Always releasable. Protected. No direct push. Every merge is a squash-merge via PR. |
| `release/v0.x` | Maintenance branch for a released minor version series. Hotfixes are cherry-picked here, then tagged. |

### Short-lived branches (deleted after merge)

| Prefix | Use |
|---|---|
| `feat/<slug>` | New features |
| `fix/<slug>` | Bug fixes (unreleased code) |
| `spec/<slug>` | Spec language changes (`openstrux-spec` only) |
| `chore/<slug>` | Tooling, deps, docs, CI |
| `rfc/<id>-<slug>` | RFC under active development (`openstrux-spec` only) |
| `hotfix/<slug>` | Bug fix against a released version — branches from `release/v0.x`, merged back to both release branch and `main` |

### Commit-to-branch mapping

| Change type | Branch prefix | Target repo |
|---|---|---|
| New spec feature | `spec/` | `openstrux-spec` |
| Parser / core feature | `feat/` | `openstrux-core` |
| Bug fix (unreleased) | `fix/` | any |
| Bug fix (released version) | `hotfix/` | any |
| RFC draft | `rfc/<id>-` | `openstrux-spec` |
| Tooling / CI / docs | `chore/` | any |

---

## Branch protection

Both `main` and `release/v*` require:

- Pull request (no direct push, no force-push)
- Minimum 1 maintainer approval
- All required CI checks passing (L0–L3 + L6 per `governance/TESTING.md`)
- Signed commits (`commit.gpgsign = true`)

`release/v*` additionally requires maintainer (not just reviewer) approval.

### Admin bypass

Repository admins may bypass required status checks and merge without passing CI. This is intentional — early-stage OSS needs an escape hatch for genuine emergencies (broken CI tooling, critical hotfix under time pressure).

**Bypass is not silent.** The admin must leave a PR comment before merging with these three fields:

```
Reason code: <BROKEN-CI | CRITICAL-HOTFIX | RELEASE-UNBLOCK | OTHER>
Risk statement: <one sentence — what risk is accepted by merging without passing checks>
Follow-up: <issue URL or "will open issue #NNN" — must close within 48h>
```

This turns the bypass from a free-form note into a reviewable control record.

Bypasses are visible in the GitHub audit log. Any bypass without a documented reason is a governance violation. See `governance/EXCEPTIONS.md` for the waiver process when bypass is planned in advance.

---

## Tagging & versioning

- Semver: `v<major>.<minor>.<patch>`
- `openstrux-spec` and `openstrux-core` are versioned in lockstep: same minor version = compatible pair.
- Tags are signed: `git tag -s v0.x.y -m "v0.x.y"`
- Pre-release identifiers: `v0.5.0-alpha.1`, `v0.5.0-rc.1`

---

## Release process

1. Declare feature freeze; cut `release/v0.x` from `main`.
2. Run benchmark gate (L4) and regression tests (L5) on the release branch.
3. Fix any blockers on the release branch; cherry-pick fixes back to `main`.
4. Tag `v0.x.0` on the release branch, sign it, push the tag.
5. Publish GitHub Release referencing the benchmark scorecard from `openstrux/benchmarks/results/`.

### Cross-repo release order

1. `openstrux-spec` tags first — spec is the source of truth.
2. `openstrux-core` tags after conformance tests pass against the spec tag.
3. `openstrux` (hub) tags benchmark results and updates `docs/roadmap/` to reflect the release.

---

## Worktrees in AI-assisted development

### Rule

**AI agents must create and work inside a dedicated git worktree. They must never work in the main working tree.**

An agent begins every task by creating its own worktree on a new branch. This is not optional and not delegated to the human — the agent does it automatically as the first step.

### Why

Agents can leave partial state (modified files, staged changes, temp files, failed tool outputs) that corrupt unrelated work. A worktree confines the agent's blast radius to a single branch. If the output is rejected, deleting the worktree leaves no trace. If accepted, the diff is clean and reviewable in isolation.

### Agent workflow

```
# 1. Agent creates worktree automatically at task start
git worktree add ../<repo>-<branch-slug> <branch-prefix>/<slug>

# 2. Agent does all work inside that worktree — no file edits outside it

# 3. Human reviews the diff before any push
git -C ../<repo>-<branch-slug> diff main

# 4a. Approved: push + open PR; human removes worktree locally
git push -u origin <branch-prefix>/<slug>
git worktree remove ../<repo>-<branch-slug>

# 4b. Rejected: discard everything
git worktree remove ../<repo>-<branch-slug>
git branch -D <branch-prefix>/<slug>
```

### Naming convention

Worktree directories are siblings of the repo, never nested inside it:

```
../openstrux-core-feat-foo      # worktree for feat/foo in openstrux-core
../openstrux-spec-spec-bar      # worktree for spec/bar in openstrux-spec
```

Pattern: `../<repo>-<branch-slug>` where `<branch-slug>` is the branch name with `/` replaced by `-`.

### Constraints

- Agents must not `git push` from a worktree without explicit human instruction per push.
- No `--no-verify`, no `--force`, no bypassing signed-commit requirements — the `governance/AIDEVSECOPS.md` no-bypass rule applies inside worktrees.
- Agents must not create more than one worktree per task. If a task is split, each sub-task gets its own human-initiated session.
- Worktrees must be cleaned up (removed) at the end of every session, approved or rejected.
