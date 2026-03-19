## Context

`MANIFESTO_BENCHMARKS.md §5` defines the format for benchmark cases. The benchmark suite requires 20+ cases across 5 categories, but for v0.6.0 we write B001-B010 as simple comparison cases and add a generation benchmark for the grant-workflow.

The v0.6.0 scorecard is a partial run: one LLM family, 10 cases, grant-workflow use case only.

## Goals / Non-Goals

**Goals:**
- B001-B010: 10 simple use-cases comparing `.strux` with TypeScript — each defines a small problem (e.g., a CRUD entity, a validation rule, an access policy) and measures token count in both representations
- Grant-workflow generation comparison: same prompt, two targets — measure input tokens (prompt size), output tokens (generated code size), and wall-clock time
- Baseline TypeScript implementations for each case (hand-written)
- v0.6.0 manifesto scorecard

**Non-Goals:**
- Running benchmarks against multiple LLM families (v0.7.0)
- B011-B030 (composition, certification/audit, translation, performance categories)
- Automated benchmark runner (cases are run manually for v0.6.0)

## Decisions

**B001-B010 are simple, focused use-cases — not grant-workflow-specific**
Each case is a small, self-contained problem that exercises one or two constructs. This makes the baseline fair and the measurement clear. Cases include: typed record, enum, union, simple panel, access-controlled endpoint, validation rule, config inheritance, named source reference, filter expression, multi-rod pipeline. The TypeScript baseline for each is the minimal equivalent hand-written code.

**Token counting: tiktoken cl100k_base**
Same tokeniser for all measurements. Ensures demo ratio and benchmark ratio are comparable.

**Grant-workflow generation benchmark: two-prompt comparison**
After the grant-workflow `.strux` sources are written, create two prompts:
- **Direct-TS prompt**: "Given this spec, generate the TypeScript implementation using Next.js + Prisma"
- **Strux prompt**: "Given this spec, generate the `.strux` panels, then compile to TypeScript"
Both prompts use the same functional specification (from `UseCaseRequirements.md`). Measure: input tokens (prompt size), output tokens (generated code), wall-clock time, and repair iterations needed.

**Scorecard format: per MANIFESTO_OBJECTIVES.md**
PASS/WARN/FAIL per principle. WARN-data (incomplete measurement) is acceptable for alpha; WARN-result (below threshold) requires a remediation plan.

**Alpha-grade WARN is acceptable — this is alpha-only evidence**
The manifesto requires 20+ benchmark cases across 3+ LLM families for a full Principle 1 gate. v0.6.0 delivers 10 cases against 1 LLM family — sufficient for alpha-grade WARN-data but not for a full release gate. The v0.6.0 scorecard MUST state "partial benchmark run — alpha-only evidence, full gate at v0.7.0". WARN-data is acceptable when it reflects incomplete measurement rather than a failing result.

## Risks / Trade-offs

**[Risk] 10 cases is below the 20-case minimum for a full release gate**
-> Mitigation: v0.6.0 is alpha. Scorecard notes "partial benchmark run — full gate at v0.7.0".

**[Risk] Manual LLM runs are not reproducible**
-> Mitigation: Prompts committed verbatim; model version and temperature recorded in result JSON.

**[Risk] Grant-workflow generation comparison is sensitive to prompt wording**
-> Mitigation: Both prompts use identical functional spec. Only the target instruction differs. Prompt text committed and versioned.

## Open Questions

- Should benchmark results be stored as JSON, CSV, or markdown? Decision: JSON for machine readability + markdown scorecard for human review.
