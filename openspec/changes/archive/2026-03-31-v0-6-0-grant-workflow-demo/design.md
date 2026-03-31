## Context

The grant-workflow use case (NLnet MVP) has six phases (P0-P6). For v0.6.0 the demo covers P0-P2 via the toolchain, but the starter repository must be structured for the full comparison model described in `UseCaseRequirements.md` (§1, §8.6, §8.13): same initialized repository, same task set, two execution paths.

The demo has three audiences:
1. **Funders/reviewers (NLnet)** — want clarity + proof that the approach works
2. **Developers** — want to clone, run, and see results
3. **Benchmarkers** — want reproducible side-by-side comparison data

## Goals / Non-Goals

**Goals:**
- Starter repository with pre-built frontend (Next.js) calling predefined service interfaces
- Pre-written unit + integration tests (vitest) as acceptance criteria
- Backend generation change defined but not executed — this is what the two paths implement
- Two prompt sets: baseline (direct Next.js + Prisma) and openstrux (`.strux` -> compile -> TS)
- `benchmark.config.json` — machine-readable description of paths, specs, tasks, test commands
- `scripts/reset.sh` — restore initial state; `output/` reference copies; `results/` run archives
- Automated unit test execution as benchmark score; integration tests opt-in via `--with-db`
- `.strux` source files for P0-P2 demonstrating context cascade + shorthand panels

**Non-Goals:**
- P3-P6 implementation (deferred to v0.7.0)
- Production deployment

## Decisions

**Use-case repo is pure baseline + thin config**

The uc repo contains only what defines the benchmark task and stores its outcomes:
```
openstrux-uc-grant-workflow/
  docs/
  specs/                    # Domain model, workflow states, access policies
  prompts/
    shared/                 # Common system prompt and constraints
    direct/                 # Path-specific: generate TS directly
    openstrux/              # Path-specific: generate .strux + compile
  openspec/
    changes/
      frontend/             # Archived: completed Next.js frontend
      backend-generation/   # Defined: the task both paths execute
      tests/                # Archived: vitest unit + integration tests
      benchmark-runner/     # Defined: runner + save-result (lives in openstrux)
  app/web/                  # Next.js app (frontend pre-built, no results page)
  packages/
    domain/                 # Typed entities and value objects
    policies/               # Eligibility, access, retention, workflow rules
  prisma/
  tests/
    unit/
    integration/
  benchmark.config.json     # Paths, specs, tasks, test commands (read by runner)
  results/                  # Benchmark run outputs (JSON + zips) — source of truth
  output/
    direct/                 # Reference copy of last direct-path run
    openstrux/              # Reference copy of last openstrux-path run
  scripts/
    reset.sh                # Restore initial state
```

**Runner and viewer live in the openstrux hub repo**
```
openstrux/
  benchmarks/
    runner/
      run-benchmark.sh      # Orchestrator: --uc <repo> --path <path> [--with-db]
      generate-api.ts       # Prompt assembly + Anthropic API + file writer
      save-result.sh        # Non-interactive archival (git diff → output/ + zip)
    viewer/
      generate-report.ts    # Static HTML report generator
      report.html           # Generated output (gitignored)
    viewer.config.json      # List of uc repos and their results paths
    model/index.ts          # BenchmarkResult schema (shared by runner + viewer)
    package.json            # Node >= 24, no SDK deps
  scripts/
    view-results.sh         # Generates report.html and opens in browser
```

**Frontend is pre-built, not generated**
The frontend (forms, navigation, workflow screens) is already implemented as an archived change. This ensures both generation paths start from the same UI baseline and only differ in backend implementation.

**Tests are pre-written, not generated**
Unit and integration tests are an archived change. They define the acceptance criteria that both generated backends must pass. This makes the comparison fair.

**Benchmark run workflow**
`run-benchmark.sh --uc ../openstrux-uc-grant-workflow --path direct` orchestrates the full run in the openstrux repo: creates a git worktree in the uc repo, calls `generate-api.ts` (Anthropic API, clean context, reads `benchmark.config.json`), runs unit tests, calls `save-result.sh`, removes the worktree. Results land in the uc repo's `results/<slug>/`.

`save-result.sh` (non-interactive): detects generated files via `git diff --name-only HEAD` in the worktree, copies to `output/<path>/` in the uc repo, zips to `results/<slug>/generated.zip`, writes `benchmark.json`. No manual prompts.

Optional `--with-db` spins up ephemeral Docker Postgres for integration tests; counts recorded in `testSuites.integration`.

**reset.sh restores initial state**
Clears generated output, `.strux` files, and `output/` directories. Does not touch `results/` (archives are kept).

**Static results viewer**
`scripts/view-results.sh` (in openstrux) runs `generate-report.ts`, which reads `viewer.config.json`, aggregates `results/*/benchmark.json` from all configured uc repos, and writes a self-contained `report.html`. No server — open in any browser. Add new uc repos to `viewer.config.json` to include them in the report.

**Token optimization: context cascade + shorthand panels**
The `.strux` source files follow the token-efficient pattern:
- Root `strux.context` for project-wide defaults (controller, DPO, common policies, named infrastructure)
- Domain-level `strux.context` for narrower access scope and domain-specific sources/targets
- One small panel per use case, declaring only the delta from context
- Named references instead of repeated inline config
- Shorthand syntax with implicit chaining

## Risks / Trade-offs

**[Risk] Token compression ratio may exceed 0.25 target**
-> Mitigation: Record actual ratio. The target applies to the full benchmark run, not the demo alone.

**[Risk] Generated TypeScript may not compile cleanly due to raw-expr gaps**
-> Mitigation: P0-P2 `.strux` files avoid complex expressions.

**[Risk] Frontend archived change is large and may drift**
-> Mitigation: Frontend is frozen once archived. Backend generation does not modify frontend files.

## Open Questions

- Should `run.sh` require openstrux-core to be built first? Decision: yes — `cd ../openstrux-core && pnpm build`. No binary distribution for v0.6.0.
