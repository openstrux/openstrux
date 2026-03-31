## Context

`MANIFESTO_BENCHMARKS.md §5` defines the format for benchmark cases. The benchmark suite requires 20+ cases across 5 categories, but for v0.6.0 we write B001-B010 as simple comparison cases and add a generation benchmark for the grant-workflow.

The v0.6.0 scorecard is a partial run: one LLM family, 10 cases, grant-workflow use case only.

## Goals / Non-Goals

**Goals:**
- B001-B010: 10 simple use-cases comparing `.strux` with TypeScript — each defines a small problem (e.g., a CRUD entity, a validation rule, an access policy) and measures token count in both representations
- Grant-workflow generation infrastructure: two-path prompt setup (direct TS and `.strux`-assisted) and automated runner — ready to execute when the use-case repo is ready
- LLM evaluation of B001-B010 syntax generation against Claude Sonnet 4.6
- Baseline TypeScript implementations for each case (hand-written)
- v0.6.0 manifesto scorecard

**Non-Goals:**
- Executing the grant-workflow generation benchmark runs (separate activity; use `run-benchmark.sh` against the UC repo)
- Recording generation comparison results (`v0.6.0-generation-comparison.json`)
- Running benchmarks against multiple LLM families (v0.7.0)
- B011-B030 (composition, certification/audit, translation, performance categories)

## Decisions

**B001-B010 are simple, focused use-cases — not grant-workflow-specific**
Each case is a small, self-contained problem that exercises one or two constructs. This makes the baseline fair and the measurement clear. Cases include: typed record, enum, union, simple panel, access-controlled endpoint, validation rule, config inheritance, named source reference, filter expression, multi-rod pipeline. The TypeScript baseline for each is the minimal equivalent hand-written code.

**Token counting: tiktoken cl100k_base**
Same tokeniser for all measurements. Ensures demo ratio and benchmark ratio are comparable.

**Grant-workflow generation benchmark: infrastructure only**
Prompts are defined in `openstrux-uc-grant-workflow/prompts/` — `direct/generate.md` and `openstrux/generate.md`, both using the same functional specs from `specs/`. The automated runner (`openstrux/benchmarks/runner/run-benchmark.sh --uc ../openstrux-uc-grant-workflow --path <direct|openstrux>`) isolates each run in a git worktree, calls the Anthropic API with a clean context, runs unit tests, and archives results to `openstrux-uc-grant-workflow/results/<slug>/benchmark.json`. This change delivers the infrastructure; executing the runs is a separate activity.

Metrics that runs will capture: `generatedFileCount`, `totalLines`, `inputTokens`, `outputTokens`, `timeSeconds`, `testSuites.unit.*`, `promptVersion`, `llm`. Token and time metrics are captured from the Anthropic streaming SSE response — `input_tokens` from the `message_start` event, `output_tokens` from the `message_delta` event, written to `generation-meta.json` by `generate-api.ts` and read by `save-result.sh`.

**Scorecard format: per MANIFESTO_OBJECTIVES.md**
PASS/WARN/FAIL per principle. WARN-data (incomplete measurement) is acceptable for alpha; WARN-result (below threshold) requires a remediation plan.

**Alpha-grade WARN is acceptable — this is alpha-only evidence**
The manifesto requires 20+ benchmark cases across 3+ LLM families for a full Principle 1 gate. v0.6.0 delivers 10 cases against 1 LLM family — sufficient for alpha-grade WARN-data but not for a full release gate. The v0.6.0 scorecard MUST state "partial benchmark run — alpha-only evidence, full gate at v0.7.0". WARN-data is acceptable when it reflects incomplete measurement rather than a failing result.

## Risks / Trade-offs

**[Risk] 10 cases is below the 20-case minimum for a full release gate**
-> Mitigation: v0.6.0 is alpha. Scorecard notes "partial benchmark run — full gate at v0.7.0".

**[Risk] Grant-workflow generation comparison is sensitive to model non-determinism**
-> Mitigation: Results are archived with `promptVersion` (git hash of prompts/) and `llm` fields, making runs reproducible. Single run per path for v0.6.0 alpha.

**[Risk] Grant-workflow generation comparison is sensitive to prompt wording**
-> Mitigation: Both prompts use identical functional spec. Only the target instruction differs. Prompt text committed and versioned.

## Open Questions

- Should benchmark results be stored as JSON, CSV, or markdown? Decision: JSON for machine readability + markdown scorecard for human review.
