## Why

The current benchmark measures a single step: "can an LLM generate a working backend?" Both the direct and openstrux paths produce roughly equivalent TypeScript, making the openstrux path look slower (the agent must learn a new language) with no visible payoff. The structural advantage of `.strux` files — machine-readable privacy metadata, certified data flows, queryable compliance — is never tested.

Adding a certification step after generation would flip this. The direct path must retroactively audit TypeScript for GDPR compliance (heuristic grep through code), while the openstrux path can structurally query the manifest's `privacyRecords` and the `.strux` AST. This is where "certified by design" becomes measurable. A follow-up change propagation step (adding a new PII field) would further demonstrate that structural changes ripple correctly through the certified pipeline.

## What Changes

- **Add a two-step benchmark flow**: Step 1 generates the backend (existing). Step 2 asks the LLM to produce a GDPR Art. 30 record of processing activities from the generated code.
- **Add a three-step variant with change propagation**: Step 3 adds a new PII field and asks the LLM to update the Art. 30 record, demonstrating structural re-certification vs manual re-audit.
- **Add new benchmark cases** (B011–B015) for the certification-and-audit category covering Art. 30 record generation, privacy field classification, and change propagation.
- **Extend the benchmark runner** to support multi-step benchmark flows with intermediate prompts.
- **Define certification scoring metrics**: completeness (all Art. 30 fields populated), accuracy (correct field classification), structural queryability (can the answer be verified programmatically vs heuristically).

## Capabilities

### New Capabilities

- `benchmark-certification-step`: The multi-step benchmark flow — defines how step 2 (certify) and step 3 (propagate) prompts are assembled, delivered, and scored. Includes the certification prompt template and scoring rubric.
- `benchmark-certification-cases`: New benchmark cases B011–B015 for the certification-and-audit category. Covers Art. 30 record generation, privacy metadata extraction, field classification accuracy, and change propagation correctness.
- `benchmark-certification-scoring`: Scoring model for certification benchmarks — how to measure completeness, accuracy, and structural queryability across both paths.

### Modified Capabilities

- `runner-prompt-mode`: The runner gains support for multi-step prompts — after step 1 completes, inject step 2 prompt into the same worktree context. New `--step` flag for prompt/apply modes.

## Impact

- **openstrux (this repo)**: New benchmark cases in `benchmarks/cases/`, runner updates in `benchmarks/runner/`, new prompt templates for certification step.
- **openstrux-uc-grant-workflow**: Extended benchmark results directory to include step 2 outputs (Art. 30 records, certification reports). New acceptance criteria for certification accuracy.
- **Benchmark prompts**: Step 2 prompt is path-agnostic (same question, different expected method). Step 3 prompt specifies a concrete change (add PII field) and asks for updated certification.
- **No breaking changes**: Step 1 remains identical. Steps 2–3 are additive.
