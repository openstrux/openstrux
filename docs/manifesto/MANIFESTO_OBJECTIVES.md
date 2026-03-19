# Openstrux Manifesto Objectives

This document turns the Openstrux manifesto into measurable review objectives.

It is intended for two uses:
1. Reviewing any version of the specification or implementation.
2. Serving as the normative base for automated tests and LLM-based review.

## Review rules

Each principle uses three levels:
- **MUST**: release-blocking requirement.
- **SHOULD**: important requirement; failure creates a warning.
- **METRIC**: tracked over time and used for regression review.

Evaluation outcome per principle:
- **PASS**: all MUST conditions pass, and at least 80% of SHOULD conditions pass.
- **WARN**: all MUST conditions pass, but fewer than 80% of SHOULD conditions pass.
- **FAIL**: any MUST condition fails.

Overall release outcome:
- **PASS**: every principle is PASS.
- **WARN**: no principle fails, but at least one principle is WARN.
- **FAIL**: at least one principle fails.

## 1. AI-native

### Objective
The primary authoring form MUST be naturally usable by standard frontier LLMs without model-specific training, fine-tuning, or custom grammar learning.

### MUST
- The primary source of truth MUST be machine-first and distinct from generated code artifacts.
- The notation MUST be usable by standard frontier LLMs without project-specific training, fine-tuning, or post-training adapters.
- The notation MUST reuse common patterns already known by general-purpose coding LLMs and MUST avoid mandatory novel grammar outside the published syntax.
- At least 90% of canonical benchmark tasks MUST be solvable by a frontier LLM in one shot into syntactically valid artifacts.
- At least 90% of canonical benchmark tasks MUST be solvable without raw escape blocks.

### SHOULD
- The same benchmark prompts SHOULD work across at least 3 frontier LLM families with no prompt changes except provider-specific system framing.
- Invalid generations SHOULD fail with localized, machine-readable diagnostics.
- Canonical examples SHOULD be expressible with a small fixed vocabulary.

### METRIC
- One-shot syntax validity rate.
- One-shot semantic validity rate.
- Cross-model portability rate.
- Escape-hatch usage rate.

### Test conditions
- Maintain a benchmark suite of at least 20 canonical prompts.
- Run the suite against at least 3 standard frontier LLMs.
- Record syntax validity, semantic validity, and escape-hatch usage.

## 2. Token- and cost-efficient

### Objective
The notation MUST minimize token cost while preserving structure, intent, and verifiability.

### MUST
- Median source-token count divided by median generated-code-token count MUST be 0.25 or lower on the benchmark suite.
- The syntax MUST use the approved compact vocabulary and short aliases for core constructs.
- The notation MUST avoid mandatory boilerplate that does not add semantic value.

### SHOULD
- A canonical 5-step panel SHOULD fit within 30 lines.
- A canonical 5-step panel SHOULD fit within 250 tokens.
- The token budget for system-prompt reference material SHOULD remain stable or improve release over release.

### METRIC
- Median source tokens per benchmark.
- Median generated output tokens per benchmark.
- Compression ratio.
- Estimated generation cost per benchmark.

### Test conditions
- Tokenize all benchmark sources and generated targets with a fixed tokenizer policy.
- Report per-benchmark and median compression ratios.
- Fail on regressions above an agreed threshold, default 10%.

## 3. Certified by design

### Objective
Trust evidence MUST be embedded in the artifact itself through explicit interfaces, typed composition, immutable identity, and certification scope.

### MUST
- Every reusable component MUST declare typed interfaces.
- Every published component MUST have a version and content hash.
- Certification scope MUST be explicitly bound to configuration-level combinations where applicable.
- Builds or audits MUST fail when a system uses configuration outside declared certification scope.
- Every active input MUST have exactly one valid typed connection.

### SHOULD
- Certification evidence SHOULD be machine-readable and portable.
- Certification reports SHOULD identify exactly which condition failed and where.
- Certification metadata SHOULD survive composition into larger systems.

### METRIC
- Percentage of components with full typed interface metadata.
- Percentage of published components with version and content hash.
- Certification scope coverage rate.
- Audit failure localization rate.

### Test conditions
- Validate manifests for interfaces, hashes, versions, and scope.
- Run in-scope and out-of-scope fixtures.
- Assert failure for invalid snaps, missing scope, and uncertified configurations.

## 4. Human-translatable on demand

### Objective
Humans MUST be able to obtain deterministic human-facing representations when needed, without requiring the primary source to be optimized for manual reading.

### MUST
- The same source plus the same lock state MUST produce byte-identical output on repeated builds.
- Every supported construct MUST have at least one deterministic human-readable or engineer-readable target.
- Translation MUST not silently drop supported semantics.

### SHOULD
- Explanations SHOULD be generatable from the structured form.
- Human-readable outputs SHOULD preserve traceability back to source constructs.
- Translation coverage SHOULD be 100% for supported benchmark constructs.

### METRIC
- Deterministic build rate.
- Translation coverage rate.
- Round-trip traceability rate.
- Explanation generation coverage.

### Test conditions
- Repeat builds in clean environments and compare artifacts byte-for-byte.
- Diff source semantics against generated outputs.
- Maintain translation coverage fixtures for every supported construct.

## 5. Built for performance

### Objective
The system MUST favor minimal operations, predictable structure, and efficient runnable output.

### MUST
- Every executable component MUST expose a framework-independent logic core or equivalent normalized behavior definition.
- Generated targets MUST run successfully on the supported benchmark suite.
- Performance regressions beyond agreed release thresholds MUST fail review.

### SHOULD
- Generated implementations SHOULD stay within 20% latency of hand-written reference implementations on canonical workloads.
- Generated implementations SHOULD stay within 15% memory overhead of hand-written reference implementations on canonical workloads.
- Build time SHOULD remain within agreed release thresholds.

### METRIC
- Build time.
- Runtime latency.
- Throughput.
- Memory usage.
- Regression percentage versus baseline.

### Test conditions
- Maintain reference implementations for canonical workloads.
- Benchmark generated targets against baselines.
- Fail when regressions exceed default thresholds.

## 6. Structure first. Code second.

### Objective
Structured source MUST remain the canonical definition of the system, and generated code MUST be treated as a derived artifact.

### MUST
- All shipped generated artifacts MUST be reproducible from source plus lock state.
- CI MUST fail when generated output diverges from source.
- Source edits MUST be sufficient to regenerate the full supported output set.

### SHOULD
- Direct edits to generated artifacts SHOULD be rejected or clearly marked as out-of-band.
- Derived outputs SHOULD preserve references back to source structures.
- Canonical workflows SHOULD start from source, not generated code.

### METRIC
- Reproducibility rate.
- Drift detection rate.
- Source-to-output coverage rate.

### Test conditions
- Run build parity checks in CI.
- Introduce controlled drift in generated output and assert failure.
- Validate regeneration of all supported targets from source.

## 7. Trust built in. Not bolted on.

### Objective
Trust metadata MUST come from the same source artifact as system structure, not from separate after-the-fact documents.

### MUST
- Regulated or auditable capabilities in scope MUST be declared in machine-readable source metadata.
- Dependency locks MUST pin versions, hashes, and certification snapshots where applicable.
- Audit outputs MUST be derivable from source and lock state.

### SHOULD
- Lineage SHOULD be generated automatically from source.
- Compliance outputs SHOULD be generated automatically for supported frameworks.
- Trust metadata SHOULD remain attached through composition and publication.

### METRIC
- Lock completeness rate.
- Audit generation success rate.
- Lineage generation coverage.
- Compliance output coverage.

### Test conditions
- Validate lock completeness.
- Generate audit, lineage, and compliance outputs from fixtures.
- Fail if required trust metadata exists only outside the source artifact.

## LLM review contract

Use the following normalized output for LLM-based review:

```json
{
  "artifact": "spec|implementation|release",
  "version": "string",
  "overall": "PASS|WARN|FAIL",
  "scores": {
    "ai_native": {
      "status": "PASS|WARN|FAIL",
      "must_passed": 0,
      "must_total": 0,
      "should_passed": 0,
      "should_total": 0,
      "metrics": {
        "one_shot_syntax_validity_rate": 0.0,
        "one_shot_semantic_validity_rate": 0.0,
        "cross_model_portability_rate": 0.0,
        "escape_hatch_usage_rate": 0.0
      }
    },
    "token_cost_efficient": {
      "status": "PASS|WARN|FAIL",
      "metrics": {
        "median_source_tokens": 0,
        "median_generated_tokens": 0,
        "compression_ratio": 0.0,
        "estimated_generation_cost": 0.0
      }
    },
    "certified_by_design": {"status": "PASS|WARN|FAIL"},
    "human_translatable_on_demand": {"status": "PASS|WARN|FAIL"},
    "built_for_performance": {"status": "PASS|WARN|FAIL"},
    "structure_first_code_second": {"status": "PASS|WARN|FAIL"},
    "trust_built_in": {"status": "PASS|WARN|FAIL"}
  },
  "failures": [
    {
      "principle": "string",
      "severity": "MUST|SHOULD",
      "condition": "string",
      "evidence": "string"
    }
  ]
}
```

## Release gate

A release is acceptable only if:
- All MUST conditions pass.
- Deterministic build rate is 100%.
- Translation coverage is 100% for supported constructs.
- Benchmark performance stays within approved thresholds.
- Compression ratio stays at or better than the target threshold.
