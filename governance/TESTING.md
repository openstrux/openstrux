# Testing Strategy

This document defines the testing strategy across all Openstrux repos. It is normative for CI gate decisions and release readiness.

## Ownership

| Repo | Testing responsibility |
|---|---|
| `openstrux-spec` | Owns fixture files (valid, invalid, golden outputs) — no runnable test suites |
| `openstrux-core` | Owns all runnable test suites (unit, integration, conformance, benchmark runners) |
| `openstrux` | Owns benchmark case definitions (`benchmarks/cases/`) and regression baselines (`benchmarks/baselines/`) |

Spec fixtures are the source of truth for conformance. `openstrux-core` consumes them; `openstrux-spec` maintains them.

---

## Test levels

| Level | Name | Scope | When it runs |
|---|---|---|---|
| L0 | Static / lint | Markdown, YAML, links, frontmatter, stub completeness | Every commit (pre-push hook) |
| L1 | Unit | Pure functions, parser internals, AST/IR nodes | Every PR |
| L2 | Spec conformance | Valid/invalid/golden fixtures from `openstrux-spec` | Every PR |
| L3 | Integration | End-to-end pipeline (parse → validate → emit) | Every PR |
| L4 | Benchmark | Accuracy and throughput vs. baselines | Mandatory pre-production gate |
| L5 | Regression | Output comparison against prior release | Pre-release only (manual trigger) |
| L6 | SAST | CodeQL, osv-scanner, Dependabot | Every PR + nightly scheduled |

---

## Tooling per language

| Language | Unit / integration | Coverage | Mutation testing |
|---|---|---|---|
| Python | pytest | coverage.py — line ≥ 80%, branch ≥ 80% | mutmut |
| TypeScript | vitest | c8 — line ≥ 80%, branch ≥ 80% | Stryker |
| Go | go test + go tool cover | line ≥ 80%, branch ≥ 80% | — |

Fixture format in `openstrux-spec` is validated by markdownlint and a frontmatter schema check (L0 only — no runnable test runner lives in that repo).

---

## Spec conformance (L2) detail

Spec conformance tests are driven by fixtures in `openstrux-spec`. Three fixture categories:

- **Valid fixtures** — parser must accept the input; resulting AST must match the golden JSON snapshot.
- **Invalid fixtures** — parser must reject the input and return the specified error code.
- **Golden fixtures** — full deterministic output comparison (AST + any emitted artefacts).

**Rule:** every new language feature added to `openstrux-spec` requires fixture coverage (at minimum one valid + one invalid case) before the spec PR may merge.

See `governance/SPEC_VALIDATION.md` for the full spec validation policy and the L1/L2 gate definitions used during development.

---

## Benchmark gate (L4)

- Benchmark case definitions live in `openstrux/benchmarks/cases/` (B001–B030+).
- Cases follow the format defined in `docs/manifesto/MANIFESTO_BENCHMARKS.md §5`.
- Benchmark runs are mandatory before any production release tag is created.
- Scorecards are stored in `openstrux/benchmarks/results/` with a date-stamped filename.
- **Regression rule:** a new release must score ≥ the prior release on all defined cases. Any regression blocks the release.
- Hand-written reference implementations (Beam Python, TypeScript) live in `openstrux/benchmarks/baselines/` and serve as the correctness ground truth.

---

## Regression testing (L5)

- Triggered manually before a release, not on every PR.
- Compares the full output of the candidate release against the prior release's stored outputs.
- Any diff in deterministic outputs is a regression and must be explained or fixed before tagging.

---

## AI-generated test policy

- AI-generated tests are permitted under the same rules as AI-generated code: a human must review, validate, and attest before merge.
- AI **must not** be the sole author of a spec fixture that asserts spec-correctness. Fixture authorship for `openstrux-spec` is human-led; AI may assist with drafting but a human must own the final content.
- All AI-assisted test commits must follow `governance/COMMIT_FORMAT.md` (co-author trailer line is mandatory).

---

## Coverage thresholds

| Metric | Threshold | Enforcement |
|---|---|---|
| Line coverage | ≥ 80% | Hard CI gate — merge blocked on failure |
| Branch coverage | ≥ 80% | Hard CI gate — merge blocked on failure |
| Mutation score | ≥ 60% | Advisory in v0.4 — reported but not a merge blocker |

The mutation score target becomes a hard gate at v1.0.

---

## Enforcement summary

| Level | Mechanism |
|---|---|
| L0 | Pre-push hook in each repo (`core.hooksPath .githooks`) |
| L1, L2, L3, L6 | GitHub Actions required status checks — merge blocked on failure |
| L4 | CI nightly run + manual trigger; required before production release tag |
| L5 | Manual trigger pre-release |
