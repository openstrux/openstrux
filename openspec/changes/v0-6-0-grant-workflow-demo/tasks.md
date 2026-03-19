## 1. Starter repository structure

- [ ] 1.1 Initialize `openstrux-uc-grant-workflow` repo with structure per `UseCaseRequirements.md` §8.7
- [ ] 1.2 Add `openstrux.repo.json` with `type: "use-case"`, `version: "0.1.0"`, `depends_on: ["openstrux-spec@0.5.x", "openstrux-core@0.6.x"]`
- [ ] 1.3 Add `docs/`, `specs/` with domain model, workflow states, access policies from requirements
- [ ] 1.4 Add `prompts/shared/` with common system prompt and constraints

## 2. Archived change: Frontend

- [ ] 2.1 Create `openspec/changes/frontend/` as an archived change
- [ ] 2.2 Implement Next.js frontend in `app/web/` — forms, navigation, workflow screens per `UseCaseRequirements.md`
- [ ] 2.3 Implement results viewer page at `/results` — reads `results/*/benchmark.json`, displays comparison table (date, path, LLM, tokens, time, test results, notes)
- [ ] 2.4 Mark change as archived

## 3. Archived change: Tests

- [ ] 3.1 Create `openspec/changes/tests/` as an archived change
- [ ] 3.2 Write unit tests in `tests/unit/` for domain entities, policy modules, eligibility rules
- [ ] 3.3 Write integration tests in `tests/integration/` for database + service interactions
- [ ] 3.4 All tests use vitest
- [ ] 3.5 Mark change as archived

## 4. Backend generation change (defined, not archived)

- [ ] 4.1 Create `openspec/changes/backend-generation/` with proposal, design, tasks defining the backend implementation
- [ ] 4.2 Tasks cover: Prisma schema, API routes, service layer, access middleware, eligibility logic
- [ ] 4.3 This is the change that both generation paths execute

## 5. Prompts

- [ ] 5.1 Write `prompts/baseline/p0-domain-model.md` through `prompts/baseline/p2-eligibility.md` — direct TS generation prompts using Next.js + Prisma
- [ ] 5.2 Write `prompts/openstrux/p0-domain-model.md` through `prompts/openstrux/p2-eligibility.md` — `.strux` generation prompts with links to strux documentation in openstrux-spec and openstrux-core
- [ ] 5.3 Both prompt sets use the same functional specification from `specs/`
- [ ] 5.4 Include explicit instruction differences only: target technology (direct TS vs `.strux` + compile)

## 6. Strux source files (context cascade + shorthand)

- [ ] 6.1 Write root `strux.context` — project-wide defaults: controller, DPO, common policies, named infrastructure endpoints (PostgreSQL, Keycloak)
- [ ] 6.2 Write `pipelines/strux.context` — domain-level: narrower access scope, domain-specific sources/targets
- [ ] 6.3 Write `pipelines/intake/p1-intake.strux` — shorthand panel with implicit chaining, named source references, minimal delta from context
- [ ] 6.4 Write `pipelines/eligibility/p2-eligibility.strux` — shorthand panel with guard, transform, named references
- [ ] 6.5 Write `specs/p0-domain-model.strux` — `@type` definitions for all P0 entities
- [ ] 6.6 Run toolchain on all files — confirm zero error diagnostics
- [ ] 6.7 Commit generated output to `output/openstrux/`

## 7. Scripts

- [ ] 7.1 Write `scripts/save-result.sh` — zip generated files, create benchmark JSON, prompt for manual input (LLM, test results, result note, feedback), store in `results/`
- [ ] 7.2 Write `scripts/reset.sh` — restore repo to initial state (frontend + tests, no backend), clear `output/baseline/` and `output/openstrux/`
- [ ] 7.3 Write `scripts/view-results.sh` — start local dev server for results viewer page
- [ ] 7.4 Test all scripts on clean checkout

## 8. Token compression measurement

- [ ] 8.1 Count tokens in all `.strux` source files using tiktoken cl100k_base
- [ ] 8.2 Count tokens in equivalent hand-written TypeScript baseline
- [ ] 8.3 Compute compression ratio
- [ ] 8.4 Write `benchmarks/results/v0.6.0-demo.json` with `struxTokens`, `baselineTokens`, `compressionRatio`, `date`

## 9. Demo entry point (openstrux/demos/grant-workflow/)

- [ ] 9.1 Write `demos/grant-workflow/run.sh` — install check, parse/validate/generate loop with `--explain`, tsc check, summary print
- [ ] 9.2 Write `demos/grant-workflow/README.md` — overview, prerequisites, how to run, side-by-side comparison, token ratio result
- [ ] 9.3 Run `demos/grant-workflow/run.sh` end-to-end — confirm exit 0
