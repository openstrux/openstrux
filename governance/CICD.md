# CI/CD Gates

This document defines the CI/CD pipeline structure, required status checks, and release pipeline across all Openstrux repos. It is normative for all contributors and maintainers.

---

## Platform

GitHub Actions across all three repos. No third-party CI services.

---

## Workflow triggers

| Trigger | When |
|---|---|
| `pull_request` | PR opened, updated, or reopened against `main` or `release/v*` |
| `push` to `main` | After merge |
| `push` to `release/v*` | After merge or hotfix cherry-pick |
| `push` tag `v*` | Release pipeline |
| `schedule` (nightly) | Benchmark + security scans |
| `workflow_dispatch` | Manual trigger for L4 (benchmark) and L5 (regression) |

---

## Required status checks

All PRs to `main` or `release/v*` must pass the following checks before merge is allowed:

| Check | Test level | Repos |
|---|---|---|
| Lint / static (markdownlint, lychee, frontmatter) | L0 | all |
| Unit tests + coverage | L1 | openstrux-core |
| Spec conformance | L2 | openstrux-core |
| Integration | L3 | openstrux-core |
| CodeQL | L6 | openstrux-core, openstrux-spec (if scripted) |
| OSV-Scanner | L6 | openstrux-core |
| REUSE license check | L6 | all |

L4 (benchmark) and L5 (regression) are **not** required PR checks. They are release gates triggered manually or on a nightly schedule. See test level definitions in `governance/TESTING.md`.

### Admin bypass of required checks

Repository admins may bypass required status checks via GitHub's bypass actor configuration. Bypass requires a documented PR comment (reason + follow-up action) before merging. See `governance/BRANCHING.md §Admin bypass` and `governance/EXCEPTIONS.md` for the full policy.

---

## Per-repo workflow files

### `openstrux` (hub)

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | L0: markdownlint, lychee link check, frontmatter validation, fixture coverage stub check, REUSE |
| `.github/workflows/security.yml` | Scheduled OSV-Scanner; Dependabot config |

### `openstrux-spec`

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | L0: markdownlint, lychee, frontmatter, stub hard fail, RFC template check, REUSE |
| `.github/workflows/security.yml` | Scheduled OSV-Scanner; Dependabot |

### `openstrux-core`

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | L0 lint → L1 unit → L2 conformance → L3 integration (sequential, fail-fast) |
| `.github/workflows/security.yml` | CodeQL (on PR + nightly), OSV-Scanner (nightly), REUSE |
| `.github/workflows/benchmark.yml` | L4 benchmark — manual dispatch + nightly; publishes scorecard to `openstrux/benchmarks/results/` via cross-repo PR |
| `.github/workflows/regression.yml` | L5 regression — manual dispatch only |
| `.github/workflows/release.yml` | Full suite → cosign sign → GitHub Release + scorecard link |

---

## Language matrix (openstrux-core)

The `ci.yml` runs L1–L3 across all supported language implementations in parallel:

```yaml
strategy:
  matrix:
    include:
      - language: python
        test-cmd: pytest --cov --cov-branch
      - language: typescript
        test-cmd: vitest run --coverage
      - language: go
        test-cmd: go test ./... -coverprofile=coverage.out
```

All matrix legs must pass. Coverage thresholds (≥ 80% line + branch) are enforced per leg; a leg that falls below threshold fails the check.

---

## Release pipeline (tag `v*`)

Triggered automatically on any tag matching `v*`. Steps run sequentially:

1. Run full test suite (L0–L3 + L6) — abort on any failure.
2. Run benchmark gate (L4) — pipeline fails if any case regresses against the prior release baseline.
3. Build and package release artifacts.
4. Sign artifacts with cosign (keyless OIDC — no long-lived signing keys).
5. Create GitHub Release with:
   - Changelog excerpt
   - Link to benchmark scorecard in `openstrux/benchmarks/results/`
   - cosign verification instructions

Cross-repo release order is enforced manually per `governance/BRANCHING.md`: `openstrux-spec` tags first, `openstrux-core` after conformance passes against the spec tag, `openstrux` last.

---

## Security scan schedule

```
nightly at 02:00 UTC:
  - CodeQL          (openstrux-core)
  - OSV-Scanner     (all repos)
  - Benchmark run   (openstrux-core)
```

Dependabot runs on its own weekly schedule per repo, grouped by ecosystem (pip, npm, Go modules).

---

## Secret management

- No secrets in source code or hardcoded in workflow files.
- All secrets via GitHub Actions Secrets (`${{ secrets.NAME }}`).
- cosign uses keyless signing via GitHub OIDC — no long-lived private keys stored anywhere.
- Workflow permissions follow least-privilege:
  - Default: `contents: read`
  - Release jobs only: `contents: write`, `id-token: write` (for OIDC)
  - All other permissions explicitly set to `none` or omitted.

---

## Caching

| Ecosystem | Cache key |
|---|---|
| Python (pip) | Hash of `requirements*.txt` |
| TypeScript (npm) | Hash of `package-lock.json` |
| Go modules | Hash of `go.sum` |
