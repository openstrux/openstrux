## Benchmark Runner v2 Tasks

### RV1 — Named branch + push

- [x] RV1.1 In `run-benchmark.sh` prompt mode (Step 1): replace `git worktree add "$WORKTREE_DIR" HEAD` with `git worktree add -b "bench-${RUN_SLUG}" "$WORKTREE_DIR" HEAD` + `git push origin "bench-${RUN_SLUG}"` (best-effort)
- [x] RV1.2 Same replacement in agent mode (Step 1)
- [x] RV1.3 Add `echo " branch        : bench-${RUN_SLUG}"` to the run header block

### RV2 — Results committed to bench branch

- [x] RV2.1 Add Step 8 to agent mode (after Step 7 / integration merge): copy `$RESULT_DIR` into `$WORKTREE_DIR/results/$(basename $RESULT_DIR)/`, `git add results/`, `git commit -m "bench(results): ..."`, `git push origin bench-${RUN_SLUG}`
- [x] RV2.2 Add equivalent result-commit block to apply mode (after integration tests)
- [x] RV2.3 Use project author/email in commit (`-c user.name=... -c user.email=...`)

### RV3 — Full integration tests in apply mode

- [x] RV3.1 In apply mode block: derive `RUN_SLUG` from `basename "$RESULT_DIR"`, `DATE_SLUG` by stripping path suffix, `WORKTREE_DIR` from `cat worktree.txt`
- [x] RV3.2 After `generate.ts` exits 0: run `prisma generate` (if schema present), then `setup_bench_db()`, then `run_integration_tests()`
- [x] RV3.3 Merge integration counts into `benchmark.json` (same inline node script as agent mode Step 7)
- [x] RV3.4 Add result-commit block (RV2.2) after merge

### RV4 — `--keep-test-env` / cleanup trap

- [x] RV4.1 Remove `KEEP_DB` variable and `--keep-db` flag
- [x] RV4.2 Add `KEEP_TEST_ENV=false` and `--keep-test-env) KEEP_TEST_ENV=true; shift ;;`
- [x] RV4.3 Update cleanup trap: when `KEEP_TEST_ENV=false`, remove worktree + drop DB/user as before; when `KEEP_TEST_ENV=true`, skip both and print worktree path, branch, DATABASE_URL, and clean-up command
- [x] RV4.4 Update header display: replace `keep-db : $KEEP_DB` with `keep-test-env : $KEEP_TEST_ENV`

### RV5 — `clean-test-env` mode

- [x] RV5.1 Rename `clean-db` to `clean-test-env` in mode validator and usage comment
- [x] RV5.2 Scoped clean (with `--result-dir`): drop `grant_bench_${SLUG}` DB, `bench_${SLUG}` user, delete remote branch `bench-<basename>`, remove worktree from `worktree.txt` if present
- [x] RV5.3 Global clean (no `--result-dir`): query Postgres for all `grant_bench_%` DBs and `bench_%` users and drop each; delete all remote branches matching `bench-` prefix via `git push origin --delete`
- [x] RV5.4 Ensure `--uc` is optional for global clean (skip git branch delete if absent); required for worktree remove in scoped clean

### RV6 — Shared helper functions

- [x] RV6.1 Extract `setup_bench_db <db> <user> <pass>` function: pg_isready check + start, psql create user/db, prisma generate, migrate deploy or db push (fallback)
- [x] RV6.2 Extract `run_integration_tests <worktree> <result_dir> <db_url>` function: run `pnpm test:integration --reporter=json`, tee log, return exit code
- [x] RV6.3 Replace inline DB+test blocks in agent mode Step 5 with calls to these functions

### RV7 — CLAUDE.md injection (agent mode)

- [x] RV7.1 After Step 2 (pnpm install), before Step 3 (generate.ts): write `$WORKTREE_DIR/CLAUDE.md` with benchmark context and test instructions
- [x] RV7.2 Initial content: unit tests only (`pnpm test:unit`) — update to include integration tests once RV8 is merged into baseline
- [x] RV7.3 `CLAUDE.md` is not committed to the source repo; it is written fresh each run

### RV8 — Mock PrismaClient for integration tests (uc repo)

- [x] RV8.1 Add `vitest-mock-extended` to `app/web/package.json` devDependencies; run `pnpm install` and commit updated lockfile
- [x] RV8.2 Write `tests/integration-mock/setup.ts` (co-located with mock tests, not `tests/integration/`):
  - `vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockDeep<PrismaClient>()) }))`
  - Export `mockPrisma` as the singleton mock instance
  - `beforeEach(() => mockReset(mockPrisma))` for test isolation
- [x] RV8.3 Update `vitest.config.ts`: add `setupFiles: ['./tests/integration-mock/setup.ts']` to `integration-mock` test pool config (not the `integration` pool)
- [x] RV8.4 Write `tests/integration-mock/intake.test.ts`: mock-based version (no DB); `tests/integration/intake.test.ts` reverted to real-DB for runner
- [x] RV8.5 Write `tests/integration-mock/eligibility.test.ts`: same pattern; add `test:integration:mock` script to `package.json`
- [x] RV8.6 Verify: `pnpm test:integration:mock` runs with no `DATABASE_URL` (fails on stubs, not on DB connection)
- [x] RV8.7 Add mock-compatibility note to `openspec/changes/backend/specs/` (change is named `backend`, not `backend-generation`; no tasks.md exists): note captured in `specs/proposal-intake/spec.md` and referenced in generation specs (`pnpm test:integration:mock` passes, no DB required)
- [x] RV8.8 Update CLAUDE.md template (RV7.2) to include `pnpm test:integration` once this task is complete

### RV9 — Verification

- [x] RV9.1 `--mode prompt`: verify `bench-<slug>` branch appears on GitHub immediately after run, selectable in remote Claude Code session
- [x] RV9.2 `--mode apply`: verify integration tests run (with mock, no DB), results committed and pushed to bench branch
- [x] RV9.3 `--mode agent`: verify CLAUDE.md present in worktree, branch created + pushed, results committed after run
- [x] RV9.4 `--keep-test-env`: verify worktree + DB still alive after run, DATABASE_URL printed, `pnpm test:integration` runs manually
- [x] RV9.5 `--mode clean-test-env --result-dir <path>`: only that run's DB/user/branch/worktree removed; other Postgres objects untouched
- [x] RV9.6 `--mode clean-test-env` (no result-dir): all `grant_bench_*` DBs, `bench_*` users, `bench-*` branches removed; other Postgres objects untouched
- [x] RV9.7 After RV8 merged: `pnpm test:integration` passes with no DATABASE_URL in the worktree context
