# Openstrux Manifesto Benchmarks

This document defines the benchmark suite referenced by `MANIFESTO_OBJECTIVES.md`.

It provides:
1. The canonical evaluation tasks.
2. The prompt policy for LLM evaluation.
3. The token measurement policy.
4. The deterministic build checks.
5. The performance benchmark policy.
6. The scoring thresholds used for PASS, WARN, and FAIL decisions.

## 1. Benchmark scope

The benchmark suite is used to evaluate:
- Specification changes.
- Compiler and CLI changes.
- Translation target changes.
- Audit and certification changes.
- Release regressions over time.

Each benchmark case MUST be versioned and reproducible.
Each benchmark case MUST include source inputs, expected validation behavior, expected generated outputs, and expected audit outcomes where applicable.

## 2. Benchmark categories

The suite is divided into the following categories:

### A. Syntax generation
Tests whether a standard frontier LLM can generate valid Openstrux artifacts from natural-language intent.

### B. Semantic generation
Tests whether generated artifacts are not only syntactically valid, but also structurally correct and semantically aligned with the prompt.

### C. Token efficiency
Measures token usage of Openstrux source versus generated target code.

### D. Deterministic translation
Verifies that the same source plus the same lock state produces byte-identical outputs.

### E. Certification and audit
Verifies interfaces, scope, typed composition, lock completeness, and machine-readable audit outputs.

### F. Performance
Measures build performance and runtime performance of generated targets against fixed baselines.

### G. Human translation
Verifies that supported source constructs translate into deterministic human-facing outputs and explanations.

## 3. Frontier LLM policy

A benchmark run MUST use at least 3 standard frontier LLMs from different provider families.
The benchmark run MUST not rely on fine-tuning, project-specific training, retrieval over hidden private examples, or model-specific grammar training.
Allowed setup is limited to:
- A shared system prompt.
- The published Openstrux syntax reference.
- The task prompt.

Provider-specific transport wrappers are allowed.
Task-specific prompt rewriting is not allowed.
Output repair before first validation is not allowed.

### Minimum model set
Use at least one model from each of these buckets when available at release time:
- General frontier coding model A.
- General frontier coding model B.
- General frontier reasoning/coding model C.

The exact model names may change over time, but the benchmark history MUST record the concrete versions used in each run.

## 4. Canonical benchmark suite

Maintain at least 20 benchmark cases across the categories below.
A release benchmark is invalid if fewer than 20 cases are run.

### 4.1 Core syntax cases
1. Minimal single-rod panel.
2. Two-rod linear pipeline.
3. Three-rod fan-out pipeline.
4. Typed error path with `err` knot.
5. Conditional knot with `@when`.
6. Enum-constrained `cfg` knot.
7. Range-constrained `arg` knot.
8. Reusable `@strux` type with nested fields.

### 4.2 Composition cases
9. Multi-source panel.
10. Multi-sink panel.
11. Pattern rod with internal `@graph`.
12. Pattern nesting.
13. Invalid fan-in without joint.
14. Unconnected active input.
15. Type mismatch in snap.

### 4.3 Certification and audit cases
16. In-scope certified configuration.
17. Out-of-scope certified configuration.
18. Missing content hash.
19. Missing lock snapshot.
20. Audit report generation with lineage output.

### 4.4 Translation cases
21. Beam Python target generation.
22. TypeScript target generation.
23. Multi-target generation from one source.
24. Rebuild parity check.
25. Human-readable explanation generation.

### 4.5 Performance cases
26. Streaming filter workload.
27. Lookup workload.
28. Aggregate workload.
29. Pattern-expanded workload.
30. Audit-heavy workload.

## 5. Benchmark case format

Each benchmark case MUST contain:
- `id`: stable identifier.
- `category`: one of the benchmark categories.
- `intent_prompt`: natural-language task prompt.
- `allowed_context`: syntax reference and constraints allowed to the LLM.
- `expected_source_artifact`: expected source or expected validation properties.
- `expected_validation`: parse, typecheck, and audit expectations.
- `expected_targets`: required generated outputs by target.
- `expected_metrics`: token, build, and runtime expectations where applicable.

Recommended directory layout:

```text
benchmarks/
  cases/
    B001-minimal-panel/
      prompt.md
      context.md
      expected.strux
      expected.json
    B002-two-rod-pipeline/
    ...
  baselines/
    beam-python/
    typescript/
  results/
    YYYY-MM-DD/
```

## 6. Prompt policy

Each LLM benchmark case MUST be run with:
- The same task prompt across all models.
- The same allowed syntax/context block across all models.
- No hidden examples beyond the benchmark definition.
- No manual correction before first parse.

A case is evaluated in three stages:
1. First output validity.
2. Validated artifact quality.
3. Optional repaired output quality.

### Recorded fields
For each model and case, record:
- Raw first output.
- Parse result.
- Typecheck result.
- Audit result.
- Need for repair, yes or no.
- Final result after allowed automated repair.
- Tokens in prompt.
- Tokens in output.
- Execution time.

## 7. Token policy

Token measurement MUST use a fixed tokenizer policy per benchmark run.
The tokenizer name and version MUST be recorded with the results.

### Required token counts
For each case, measure:
- Source tokens in Openstrux form.
- Generated Beam Python tokens.
- Generated TypeScript tokens.
- Prompt tokens.
- Output tokens.

### Derived metrics
Compute:
- Compression ratio = source tokens / generated target tokens.
- Prompt-to-artifact ratio.
- Estimated generation cost.
- Median compression ratio across the suite.

### Thresholds
Default thresholds:
- PASS: median compression ratio <= 0.25.
- WARN: median compression ratio > 0.25 and <= 0.33.
- FAIL: median compression ratio > 0.33.

For the canonical 5-step panel:
- PASS: <= 30 lines and <= 250 tokens.
- WARN: <= 40 lines and <= 325 tokens.
- FAIL: above WARN thresholds.

## 8. Syntax and semantic scoring

### Syntax validity
A case is syntax-valid if the first model output parses successfully as the expected Openstrux artifact type.

### Semantic validity
A case is semantically valid if it:
- Parses successfully.
- Passes typechecking.
- Satisfies prompt-required structures.
- Produces required targets or expected validation failures.

### AI-native thresholds
Default thresholds:
- PASS: one-shot syntax validity >= 90% and one-shot semantic validity >= 85%.
- WARN: syntax validity >= 80% and semantic validity >= 75%.
- FAIL: below WARN thresholds.

### Escape-hatch thresholds
Default thresholds:
- PASS: raw escape-hatch usage <= 10% of cases.
- WARN: > 10% and <= 20%.
- FAIL: > 20%.

### Cross-model portability thresholds
Default thresholds:
- PASS: at least 90% of cases pass on all benchmarked model families.
- WARN: at least 75%.
- FAIL: below 75%.

## 9. Deterministic build benchmark

For every translation case:
- Run the build at least 3 times in clean environments.
- Compare every generated artifact byte-for-byte.
- Record whether outputs are identical.

### Thresholds
- PASS: deterministic build rate = 100%.
- FAIL: deterministic build rate < 100%.

There is no WARN state for deterministic output.

## 10. Certification and audit benchmark

For certification cases, validate:
- Typed interface presence.
- Version and content hash presence.
- Lock completeness.
- Certification scope enforcement.
- Audit output generation.
- Lineage output generation where supported.

### Thresholds
- PASS: 100% of required certification and audit checks succeed.
- FAIL: any required certification or audit check fails.

There is no WARN state for required certification conditions.

## 11. Human translation benchmark

For each supported construct, verify:
- At least one deterministic human-facing output exists.
- No supported semantics are silently dropped.
- Output preserves references back to source structures where applicable.

### Thresholds
- PASS: translation coverage = 100% for supported constructs.
- WARN: coverage >= 95% and < 100%.
- FAIL: coverage < 95%.

## 12. Performance benchmark

Performance benchmarks MUST run on fixed workloads and fixed hardware profiles, or on normalized cloud runners with recorded machine metadata.

### Required workloads
- Streaming filter workload.
- Point lookup workload.
- Window/aggregate workload.
- Pattern-expanded workload.
- Audit generation workload.

### Required measurements
- Build time.
- End-to-end runtime latency.
- Throughput.
- Peak memory.
- Output correctness.

### Baselines
Maintain one hand-written reference implementation per supported target and workload when feasible.
If no hand-written baseline exists, use the last accepted release as baseline.

### Thresholds
Default thresholds:
- PASS: latency regression <= 20%, memory regression <= 15%, build-time regression <= 15%.
- WARN: latency regression <= 30%, memory regression <= 25%, build-time regression <= 25%.
- FAIL: above WARN thresholds.

Any correctness regression is an immediate FAIL.

## 13. Release scorecard

Each benchmark run MUST produce a machine-readable scorecard.
Recommended output file:

```json
{
  "run_id": "string",
  "date": "YYYY-MM-DD",
  "artifact": "spec|implementation|release",
  "version": "string",
  "models": [
    {"provider": "string", "model": "string", "version": "string"}
  ],
  "tokenizer": {"name": "string", "version": "string"},
  "summary": {
    "overall": "PASS|WARN|FAIL",
    "syntax_validity_rate": 0.0,
    "semantic_validity_rate": 0.0,
    "cross_model_portability_rate": 0.0,
    "escape_hatch_usage_rate": 0.0,
    "median_compression_ratio": 0.0,
    "deterministic_build_rate": 0.0,
    "translation_coverage": 0.0,
    "latency_regression_pct": 0.0,
    "memory_regression_pct": 0.0,
    "build_time_regression_pct": 0.0
  },
  "cases": []
}
```

## 14. Review use

This benchmark file is normative for:
- Specification review.
- Implementation review.
- Regression testing.
- Release approval.
- LLM-based automated evaluation.

If a benchmark threshold changes, the change MUST be versioned, justified, and applied prospectively.
Historical benchmark runs MUST remain reproducible under their original threshold set.
