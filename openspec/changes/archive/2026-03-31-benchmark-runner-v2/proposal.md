## Why

The first prompt-mode benchmark run exposed six gaps in the runner: the worktree was a detached HEAD (blocking remote CC sessions), results were never committed to git, apply mode skipped integration tests, `--keep-db` left no worktree for manual inspection, accumulated bench resources had no global clean-up path, and the LLM had no way to run integration tests during generation because no DB was available.

## What Changes

- Named branch (`bench-<slug>`) created at worktree time and pushed immediately, replacing detached HEAD
- Results directory committed to bench branch after every run (agent and apply modes)
- Apply mode extended to run the full DB-setup + integration-test + result-commit pipeline
- `--keep-db` removed; `--keep-test-env` replaces it with unified scope (worktree + DB kept together)
- `clean-db` renamed to `clean-test-env`; adds global mode (no `--result-dir`) to sweep all bench resources
- `setup_bench_db` and `run_integration_tests` extracted as shared functions
- `CLAUDE.md` injected into worktree before agent starts
- Integration test suite in `openstrux-uc-grant-workflow` refactored to use `vitest-mock-extended` so LLM can run `pnpm test:integration` without a real database

## Capabilities

### New Capabilities

- none

### Modified Capabilities

- none — all changes are to the benchmark runner tooling and UC test infrastructure, not to any spec-tracked capability

## Impact

- `benchmarks/runner/run-benchmark.sh` (openstrux repo): all six changes
- `package.json`, `vitest.config.ts`, `tests/integration-mock/` (openstrux-uc-grant-workflow): mock integration test suite
