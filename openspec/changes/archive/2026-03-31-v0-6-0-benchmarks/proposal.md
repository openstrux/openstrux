## Why

The v0.4-draft manifesto review scored WARN on Principle 1 (AI-native) because the benchmark suite did not exist. Without benchmark cases, token compression claims are unverified and the release gate cannot pass.

For v0.6.0, benchmarks serve two purposes:
1. **Simple syntax comparison (B001-B010)**: Compare `.strux` source with equivalent TypeScript across 10 straightforward use-cases to establish baseline token compression measurements
2. **Grant-workflow generation infrastructure**: Define the two-path benchmark (direct TS vs `.strux`-assisted), write the prompts, and implement the automated runner — so that benchmark runs can be executed independently when the use-case repo is ready

> **Alpha-only evidence.** The manifesto requires 20+ benchmark cases across 3+ LLM families for a full Principle 1 gate. v0.6.0 delivers 10 cases against 1 LLM family — sufficient for alpha-grade WARN-data but **not** for a full release gate. The remaining cases (B011-B030) and multi-model runs are deferred to v0.7.0.

## What Changes

- Write benchmark cases B001-B010 in `openstrux/benchmarks/cases/` following `MANIFESTO_BENCHMARKS.md §5`
- B001-B010 are **10 relatively simple use-cases** comparing `.strux` source with hand-written TypeScript equivalents — each case measures source token count, equivalent TypeScript token count, and compression ratio
- Hand-written TypeScript baselines for each case in `benchmarks/baselines/`
- Grant-workflow generation infrastructure: two prompts (one for direct TS, one via `.strux`) and an automated runner in `benchmarks/runner/` — benchmark *execution* and results are out of scope for this change
- v0.6.0 manifesto scorecard in `openstrux-spec/reviews/v0.6.0.md`

## Capabilities

### New Capabilities

- `benchmark-cases-b001-b010`: Ten benchmark case definitions covering simple use-cases with token compression measurement
- `benchmark-generation-infrastructure`: Grant-workflow benchmark infrastructure — two-path prompts (`direct/generate.md`, `openstrux/generate.md`) and automated runner (`benchmarks/runner/run-benchmark.sh`); execution and result recording are separate activities
- `manifesto-scorecard-v060`: Formal PASS/WARN/FAIL review of all 7 manifesto principles

### Modified Capabilities

_(none)_

## Impact

- **openstrux** (hub): New files in `benchmarks/cases/`, `benchmarks/baselines/`, `benchmarks/results/`
- **openstrux-spec**: New review scorecard at `reviews/v0.6.0.md`
- **No code changes** to openstrux-core
