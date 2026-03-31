## ADDED Requirements

### Requirement: Three-dimensional scoring model

Certification benchmarks SHALL be scored on three dimensions:

1. **Completeness** (40% weight): Proportion of Art. 30 required fields that are populated per data flow.
2. **Accuracy** (40% weight): Correctness of populated fields compared against the reference record. Synonym matching is permitted for purpose and basis descriptions.
3. **Structural queryability** (20% weight): Whether the LLM derived its answer from structured metadata (`.strux`, manifest) or by scanning implementation code.

#### Scenario: Perfect completeness score
- **WHEN** all 9 Art. 30 fields are populated for every data flow
- **THEN** the completeness dimension scores 100

#### Scenario: Partial completeness
- **WHEN** 7 of 9 Art. 30 fields are populated for a data flow
- **THEN** the completeness score for that flow is proportional (7/9)

#### Scenario: Accuracy with synonym matching
- **WHEN** the reference says purpose is "grant application processing" and the LLM says "processing grant applications"
- **THEN** this is scored as accurate (synonym match)

### Requirement: Structural queryability measurement

The queryability dimension SHALL distinguish between structural and heuristic approaches:

- **Structural** (high score): The LLM references manifest `privacyRecords`, `.strux` `@dp`/`@access` blocks, `FieldClassification` types, or `private-data` rod config.
- **Heuristic** (lower score): The LLM greps through TypeScript files, reads Prisma schema fields, or infers PII from variable names.
- **Both used** (medium score): The LLM uses structural metadata supplemented by code reading.

#### Scenario: Openstrux path scores high on queryability
- **WHEN** the openstrux path agent produces an Art. 30 record by reading `.strux` source and manifest
- **THEN** the queryability score is 80–100

#### Scenario: Direct path baseline queryability
- **WHEN** the direct path agent produces an Art. 30 record by scanning TypeScript files
- **THEN** the queryability score is 30–50 (correct but fragile method)

### Requirement: Art. 30 JSON schema

A JSON schema SHALL be defined at `benchmarks/schemas/art30-record.json` that specifies the expected structure of Art. 30 record output. The schema SHALL include:

- `processingActivities`: array of data flow records
- Each record: `controller`, `dpo`, `purpose`, `lawfulBasis`, `dataSubjectCategories`, `personalDataCategories`, `recipients`, `retention`, `technicalMeasures`, `dpiaRef`

#### Scenario: Valid Art. 30 JSON validates against schema
- **WHEN** a correctly structured Art. 30 record is validated against the schema
- **THEN** validation passes with no errors

#### Scenario: Missing required fields fail validation
- **WHEN** an Art. 30 record omits `purpose` for a processing activity
- **THEN** schema validation fails, identifying the missing field

### Requirement: Meaningful code surface measurement

The benchmark runner SHALL measure and record the token size of meaningful generated code after step 1 completes.

**Meaningful code** is defined per path:
- **Openstrux path**: all `.strux` files in the worktree root. TypeScript files emitted by `strux build` are explicitly excluded.
- **Direct path**: all `.ts` files under `src/`. Files under `node_modules/`, `dist/`, `.next/`, `*.d.ts` declaration files, and test fixture directories are excluded.

Token count SHALL use tiktoken cl100k_base encoding as a stable, model-independent approximation.

Output SHALL be written to `<result-dir>/code-surface.json` with the following structure:

```json
{
  "path": "openstrux | direct",
  "tokenCount": 4200,
  "fileCount": 7,
  "files": ["src/data/submission.strux", "..."],
  "excludedPatterns": ["**/*.ts", "..."]
}
```

#### Scenario: Code surface JSON is written after step 1
- **WHEN** the step 1 apply phase completes
- **THEN** `code-surface.json` exists in the result directory with all required fields populated

#### Scenario: Openstrux token count is lower than direct token count
- **WHEN** both paths complete step 1 on the grant workflow use case
- **THEN** the openstrux `tokenCount` is lower than the direct `tokenCount` (structural compression hypothesis)

#### Scenario: Excluded files are listed
- **WHEN** `code-surface.json` is inspected
- **THEN** `excludedPatterns` lists every glob pattern used to exclude files, enabling reproducibility and audit

### Requirement: Reference Art. 30 record for grant workflow

A human-authored reference Art. 30 record SHALL exist at `benchmarks/baselines/art30-reference.json` for the grant workflow use case. It SHALL cover:

- Intake pipeline: purpose, basis, data subjects (applicants), personal data categories, recipients, retention, measures
- Eligibility pipeline: purpose, basis, data subjects (applicants evaluated by reviewers), personal data categories, recipients, retention, measures

#### Scenario: Reference record is complete
- **WHEN** the reference record is inspected
- **THEN** all 9 Art. 30 fields are populated for both intake and eligibility pipelines

#### Scenario: Reference record matches domain model
- **WHEN** the reference record's personal data categories are compared to `openspec/specs/domain-model.md` in the UC repo
- **THEN** every PII field in the domain model appears in the reference record
