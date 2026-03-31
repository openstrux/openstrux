## 1. Starter repository structure

- [x] 1.1 Initialize `openstrux-uc-grant-workflow` repo with structure per `UseCaseRequirements.md` §8.7
- [x] 1.2 Add `openstrux.repo.json` with `type: "use-case"`, `version: "0.1.0"`, `depends_on: ["openstrux-spec@0.5.x", "openstrux-core@0.6.x"]`
- [x] 1.3 Add `docs/`, `specs/` with domain model, workflow states, access policies from requirements
- [x] 1.4 Add `prompts/shared/` with common system prompt and constraints

## 2. Archived change: Frontend

- [x] 2.1 Create `openspec/changes/frontend/` as an archived change
- [x] 2.2 Implement Next.js frontend in `app/web/` — forms, navigation, workflow screens per `UseCaseRequirements.md`
- [x] 2.3 Implement results viewer page at `/results` — reads `results/*/benchmark.json`, displays comparison table (date, path, LLM, tokens, time, test results, notes)
- [x] 2.4 Mark change as archived

## 3. Archived change: Tests

- [x] 3.1 Create `openspec/changes/tests/` as an archived change
- [x] 3.2 Write unit tests in `tests/unit/` for domain entities, policy modules, eligibility rules
- [x] 3.3 Write integration tests in `tests/integration/` for database + service interactions
- [x] 3.4 All tests use vitest
- [x] 3.5 Mark change as archived

## 4. Backend generation change (defined, not archived)

- [x] 4.1 Create `openspec/changes/backend-generation/` with proposal, design, tasks defining the backend implementation
- [x] 4.2 Tasks cover: Prisma schema, API routes, service layer, access middleware, eligibility logic
- [x] 4.3 This is the change that both generation paths execute

## 5. Prompts

- [x] 5.1 Write `prompts/shared/generate.md` — common generation instructions: specs to read, tasks to execute, verification, gap log
- [x] 5.2 Write `prompts/direct/generate.md` — path-specific delta: output location only
- [x] 5.3 Write `prompts/openstrux/generate.md` — path-specific delta: `strux init`, language reference, `strux build`, gap-fill workflow
- [x] 5.4 Both paths share `prompts/shared/` (system, constraints, generate, task-format); path files contain only the delta

## 6. Strux source files (generated during benchmark run)

Tasks 6.1-6.7 are executed by the LLM following `prompts/openstrux/generate.md` during a benchmark run. They are not pre-written in the repository — that is the point of the comparison.

- [ ] 6.1 LLM writes root `strux.context` — project-wide defaults: controller, DPO, common policies, named infrastructure endpoints
- [ ] 6.2 LLM writes `pipelines/strux.context` — domain-level: narrower access scope, domain-specific sources/targets
- [ ] 6.3 LLM writes `pipelines/intake/p1-intake.strux` — shorthand panel with implicit chaining, named source references
- [ ] 6.4 LLM writes `pipelines/eligibility/p2-eligibility.strux` — shorthand panel with guard, transform, named references
- [ ] 6.5 LLM writes `specs/p0-domain-model.strux` — `@type` definitions for all P0 entities
- [ ] 6.6 LLM runs toolchain — confirm zero error diagnostics
- [ ] 6.7 LLM writes generated output at natural in-tree paths (runner copies to `output/openstrux/`)

## 7. Use-case repo — baseline scripts and config

- [x] 7.1 Write `scripts/reset.sh` — restore repo to initial state, clear generated output and .strux files
- [x] 7.2 Write `benchmark.config.json` — paths, specs, tasks, testUnit, testIntegration
- [x] 7.3 Test reset.sh on clean checkout

## 7b. openstrux hub — benchmark runner and viewer (in `openstrux/benchmarks/`)

- [x] 7b.1 Write `benchmarks/runner/generate-api.ts` — prompt assembly (reads benchmark.config.json) + Anthropic API streaming + fenced-block parser + in-tree file writer (Node >= 24, no SDK)
- [x] 7b.2 Write `benchmarks/runner/run-benchmark.sh` — worktree orchestrator: `--uc`, `--path`, `--model`, `--with-db`
- [x] 7b.3 Write `benchmarks/runner/save-result.sh` — non-interactive: git diff detection, output/ mirror, zip, benchmark.json
- [x] 7b.4 Write `benchmarks/viewer/generate-report.ts` — static HTML generator reading viewer.config.json
- [x] 7b.5 Write `benchmarks/viewer.config.json` — list of uc repos and results paths
- [x] 7b.6 Write `benchmarks/model/index.ts` — BenchmarkResult schema (Zod)
- [x] 7b.7 Write `scripts/view-results.sh` — generate report.html and open in browser
- [ ] 7b.8 Test full run: `run-benchmark.sh --uc ../openstrux-uc-grant-workflow --path direct`

## 8. Token compression measurement (after first benchmark run)

Tasks 8.1-8.4 require a completed benchmark run to have `.strux` and TypeScript output to measure.

- [ ] 8.1 Count tokens in all `.strux` source files using tiktoken cl100k_base
- [ ] 8.2 Count tokens in equivalent hand-written TypeScript baseline
- [ ] 8.3 Compute compression ratio
- [ ] 8.4 Write `benchmarks/results/v0.6.0-demo.json` with `struxTokens`, `baselineTokens`, `compressionRatio`, `date`

## 9. Demo entry point (openstrux/demos/grant-workflow/)

- [x] 9.1 Write `demos/grant-workflow/run.sh` — install check, parse/validate/generate loop with `--explain`, tsc check, summary print
- [x] 9.2 Write `demos/grant-workflow/README.md` — overview, prerequisites, how to run, side-by-side comparison, token ratio result
- [ ] 9.3 Run `demos/grant-workflow/run.sh` end-to-end — confirm exit 0 (requires .strux files from a benchmark run)
