## 1. Art. 30 schema and reference record

- [ ] 1.1 Create `benchmarks/schemas/art30-record.json` — JSON schema defining the expected Art. 30 output structure
- [ ] 1.2 Create `benchmarks/baselines/art30-reference.json` — human-authored reference record for the grant workflow (intake + eligibility pipelines)
- [ ] 1.3 Validate reference record against schema

## 2. Benchmark cases (B011–B015)

- [ ] 2.1 Write `benchmarks/cases/B011.md` — Art. 30 record from generated backend (certification-and-audit)
- [ ] 2.2 Write `benchmarks/cases/B012.md` — Privacy field classification accuracy (certification-and-audit)
- [ ] 2.3 Write `benchmarks/cases/B013.md` — Change propagation correctness (certification-and-audit)
- [ ] 2.4 Write `benchmarks/cases/B014.md` — Certification token efficiency (token-efficiency)
- [ ] 2.5 Write `benchmarks/cases/B015.md` — Technical measures identification (certification-and-audit)

## 3. Certification prompt templates

- [ ] 3.1 Create `benchmarks/prompts/step-2-certify.md` — path-agnostic certification prompt requesting structured Art. 30 JSON
- [ ] 3.2 Create `benchmarks/prompts/step-3-propagate.md` — propagation prompt specifying `phone_number` PII field addition
- [ ] 3.3 Add path-specific context appendices for step 2 (openstrux: read `.strux` + manifest; direct: read TypeScript + Prisma)

## 4. Runner multi-step support

- [ ] 4.1 Add `--step` flag to `run-benchmark.sh` (default: 1)
- [ ] 4.2 Update `benchmarks/runner/generate.ts` to support step 2/3 prompt assembly — read worktree from step 1 result dir
- [ ] 4.3 Update prompt assembly to concatenate step-specific prompt template after the base system prompt
- [ ] 4.4 Implement step result isolation — `step-2/`, `step-3/` subdirectories in result dir
- [ ] 4.5 Add validation: step 2/3 require `--result-dir` with existing `worktree.txt`

## 5. Scoring infrastructure

- [ ] 5.1 Create scoring script that compares Art. 30 JSON against reference record
- [ ] 5.2 Implement completeness scorer (field population ratio)
- [ ] 5.3 Implement accuracy scorer (field-by-field comparison with synonym matching)
- [ ] 5.4 Implement queryability scorer (heuristic: check if response references `.strux`/manifest vs TypeScript files)
- [ ] 5.5 Output `scoring.json` with three-dimensional scores and weighted total

## 6. Documentation

- [ ] 6.1 Update `CLAUDE.md` benchmark runner section with `--step` flag documentation
- [ ] 6.2 Add step 2/3 to the benchmark runner quick reference table
