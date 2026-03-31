# Benchmark Runner v2 — Design

Builds on `openspec/changes/benchmark-runner/` (all tasks complete). Adds six improvements identified during the first prompt-mode benchmark run.

## Problems addressed

| # | Problem | Impact |
|---|---|---|
| 1 | Worktree created as detached HEAD | Remote Claude Code session cannot select the branch |
| 2 | Results saved as loose files, never committed | Results are ephemeral; no git-level traceability |
| 3 | Apply mode runs unit tests only | Benchmark score is incomplete vs agent mode |
| 4 | `--keep-db` keeps DB but removes worktree | Cannot run manual integration tests after a run |
| 5 | `clean-db` only cleans a specific run | Accumulated bench resources from failed/abandoned runs must be cleaned manually |
| 6 | LLM (agent mode) cannot run integration tests | No DB during generation → LLM gets no integration feedback |

---

## Change 1 — Named branch + push at worktree creation

Both worktree-creating code paths (`--mode prompt`, `--mode agent`) in `run-benchmark.sh` switch from detached HEAD to a named branch:

```bash
git -C "$UC_ROOT" worktree add -b "bench-${RUN_SLUG}" "$WORKTREE_DIR" HEAD
git -C "$UC_ROOT" push origin "bench-${RUN_SLUG}" 2>/dev/null || echo "Note: branch not pushed"
```

The branch name `bench-<YYYYMMDDHHMMSS>-<path>` is deterministic from the run slug. It is visible in the run header output.

---

## Change 2 — Results committed to bench branch

After `save-result.sh` completes (agent mode Step 6, apply mode equivalent), a new step copies the result directory into the worktree and commits it:

```
results/<run-slug>/
  benchmark.json
  evidence.zip
  generated.zip
  prompts.zip
```

Commit message format (AI-assisted, per project rules):
```
bench(results): <run-slug> — <model> (<path>)
```

The branch is pushed immediately after. This means each bench branch ends with two logical commits: generated code (from LLM) + results (from runner).

---

## Change 3 — Full integration tests in apply mode

Apply mode currently exits after `generate.ts` returns. It is extended to run the same DB setup + integration test pipeline as agent mode:

1. Derive `WORKTREE_DIR` from `worktree.txt` (already written by prompt mode)
2. Derive `DATE_SLUG` / `RUN_SLUG` from result-dir basename
3. Run `prisma generate` (if schema present)
4. Create ephemeral bench DB via `setup_bench_db()`
5. Run `pnpm test:integration` with `DATABASE_URL`
6. Merge integration counts into `benchmark.json`
7. Commit + push results to bench branch

---

## Change 4 — `--keep-test-env` (replaces `--keep-db`)

`--keep-db` is removed. `--keep-test-env` replaces it with broader scope: keeps both the worktree and the bench DB alive after the run completes.

Cleanup trap behaviour when `--keep-test-env`:
- Worktree is NOT removed
- Bench DB and user are NOT dropped
- A summary is printed with exact commands to reconnect:
  ```
  Test env kept:
    worktree : /path/to/worktree
    branch   : bench-<slug>
    db url   : postgresql://bench_<slug>:bench@127.0.0.1:5432/grant_bench_<slug>
    clean up : run-benchmark.sh --mode clean-test-env --result-dir <path>
  ```

---

## Change 5 — `clean-test-env` mode (replaces `clean-db`)

`--mode clean-db` is renamed to `--mode clean-test-env` and extended in two ways:

**Scoped** (`--result-dir <path>`): drops the specific bench DB + user, deletes the remote branch, removes the worktree if it still exists.

**Global** (no `--result-dir`): scans Postgres for all resources matching the bench prefix and removes them. Safe: only touches objects created by the benchmark process.

| Object | Prefix | Safe to delete |
|---|---|---|
| Postgres DB | `grant_bench_` | Yes — bench-only |
| Postgres user | `bench_` | Yes — bench-only |
| Git branch (remote) | `bench-` | Yes — bench-only |

The Postgres instance is shared with other applications; global clean-up must never touch objects outside these prefixes.

---

## Change 6 — Mock PrismaClient for integration tests

During agent-mode generation, the LLM has no database. To allow it to run `pnpm test:integration` and get service-layer feedback, the integration test suite is refactored to use a typed `vitest-mock-extended` mock instead of a real `PrismaClient`.

**Before**: each integration test file connects to a real DB, uses `beforeAll($connect)` / `afterAll($disconnect)`, and seeds/cleans data with `deleteMany`.

**After**: a shared `tests/integration/setup.ts` mocks `@prisma/client` at the module level. Each test configures `mockPrisma.<model>.<method>.mockResolvedValue(...)` for its scenario. `beforeEach(mockReset(mockPrisma))` ensures isolation.

The real-DB integration suite continues to run in the benchmark runner after generation (Step 5 / apply mode equivalent). The `DATABASE_URL` check in the runner does not change.

### CLAUDE.md injection (agent mode)

After this change is merged, a `CLAUDE.md` is written into the worktree before the agent starts:

```
## Testing
Run both test suites to verify your work:
  pnpm test:unit          # no database required
  pnpm test:integration   # uses PrismaClient mock — no database required

Do NOT set up or start a real database.
```

Until this change is merged into the baseline, `CLAUDE.md` instructs the LLM to run unit tests only.

---

## Affected files

| File | Repo | Change |
|---|---|---|
| `benchmarks/runner/run-benchmark.sh` | `openstrux` | Changes 1–5, CLAUDE.md injection |
| `app/web/package.json` | `openstrux-uc-grant-workflow` | Add `vitest-mock-extended` devDep |
| `tests/integration/setup.ts` | `openstrux-uc-grant-workflow` | New — mock setup |
| `vitest.config.ts` | `openstrux-uc-grant-workflow` | Add `setupFiles` for integration env |
| `tests/integration/intake.test.ts` | `openstrux-uc-grant-workflow` | Refactor to use mock |
| `tests/integration/eligibility.test.ts` | `openstrux-uc-grant-workflow` | Refactor to use mock |
| `openspec/changes/backend-generation/tasks.md` | `openstrux-uc-grant-workflow` | Add note: integration tests use mock, no real DB required |
