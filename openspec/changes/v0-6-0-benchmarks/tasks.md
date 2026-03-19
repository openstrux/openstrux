## 1. Benchmark cases B001-B010 (simple use-cases)

- [ ] 1.1 Write `benchmarks/cases/B001.md` — a `@type` record with 6 fields vs equivalent TypeScript interface + Prisma model
- [ ] 1.2 Write `benchmarks/cases/B002.md` — a `@type` enum with 5 variants vs TypeScript enum + Prisma enum
- [ ] 1.3 Write `benchmarks/cases/B003.md` — a `@type` union with 3 variants vs TypeScript discriminated union
- [ ] 1.4 Write `benchmarks/cases/B004.md` — a simple `@panel` with receive/validate/store/respond vs Next.js route handler
- [ ] 1.5 Write `benchmarks/cases/B005.md` — an `@access` block with RBAC vs TypeScript middleware
- [ ] 1.6 Write `benchmarks/cases/B006.md` — a filter expression shorthand vs TypeScript Prisma where clause
- [ ] 1.7 Write `benchmarks/cases/B007.md` — config inheritance from `strux.context` vs duplicated TypeScript config
- [ ] 1.8 Write `benchmarks/cases/B008.md` — named `@source` reference vs inline connection config
- [ ] 1.9 Write `benchmarks/cases/B009.md` — multi-rod pipeline (5 rods) vs equivalent TypeScript handler
- [ ] 1.10 Write `benchmarks/cases/B010.md` — compliance rods (pseudonymize + encrypt) vs TypeScript privacy helpers
- [ ] 1.11 Write TypeScript baselines for each case in `benchmarks/baselines/B001/`-`benchmarks/baselines/B010/`
- [ ] 1.12 Count tokens for each `.strux` case and TypeScript baseline using tiktoken cl100k_base
- [ ] 1.13 Write results to `benchmarks/results/v0.6.0-b001-b010.json`

## 2. Grant-workflow generation comparison

- [ ] 2.1 Write direct-TS prompt: "Given this spec, generate TypeScript implementation using Next.js + Prisma" — uses `UseCaseRequirements.md` as functional spec
- [ ] 2.2 Write strux prompt: "Given this spec, generate `.strux` panels" — same functional spec, links to strux documentation in openstrux-spec
- [ ] 2.3 Run both prompts against the same LLM (Claude Sonnet 4.6)
- [ ] 2.4 Measure per run: input tokens, output tokens, wall-clock time, repair iterations needed
- [ ] 2.5 Record results in `benchmarks/results/v0.6.0-generation-comparison.json` with `model`, `temperature`, `inputTokens`, `outputTokens`, `timeSeconds`, `repairIterations`, `prompt`

## 3. LLM evaluation run (B001-B010)

- [ ] 3.1 Run each B001-B010 prompt against Claude Sonnet 4.6 with the system prompt from `specs/core/syntax-reference.md`
- [ ] 3.2 Score each response: syntax validity (parse with zero errors), expected constructs present, token count
- [ ] 3.3 Record results in `benchmarks/results/v0.6.0-benchmark.json` with model ID, temperature, and per-case scores

## 4. Manifesto scorecard v0.6.0

- [ ] 4.1 Draft `openstrux-spec/reviews/v0.6.0.md` covering all 7 principles
- [ ] 4.2 Fill in measured data: token compression ratios (B001-B010), generation comparison (input/output tokens, time), syntax validity rate
- [ ] 4.3 Rate Principles 1-7 PASS/WARN/FAIL — distinguish WARN-data from WARN-result; Principle 1 MUST be WARN-data with note: "alpha-only evidence — 10/20+ cases, 1/3+ LLM families"
- [ ] 4.4 Update `docs/roadmap/v0.6.0.md` release gate checklist
