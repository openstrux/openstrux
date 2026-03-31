## ADDED Requirements

### Requirement: Benchmark cases B001–B010 follow the MANIFESTO_BENCHMARKS.md §5 format
Each case file in `openstrux/benchmarks/cases/` SHALL contain: `id`, `category`, `description`, `prompt`, `expected-constructs` (list of Strux construct types the output must include), `scoring-criteria`, and `baseline-path`.

#### Scenario: Case file contains all required fields
- **WHEN** `benchmarks/cases/B001.md` is read
- **THEN** it SHALL contain all six required fields with non-empty values

### Requirement: B001–B008 cover syntax generation for grant-workflow constructs
Cases B001–B008 SHALL each present a natural-language prompt describing a grant-workflow concept and require the LLM to produce a valid `.strux` response. Coverage SHALL include at minimum: record definition, enum definition, panel with intake rods, panel with eligibility rods, @access block, expression shorthand, union type, config inheritance.

#### Scenario: B001 prompt targets record generation
- **WHEN** B001 is evaluated
- **THEN** the `expected-constructs` field SHALL list `@strux record` as a required construct in the output

#### Scenario: B005 prompt targets @access block generation
- **WHEN** B005 is evaluated
- **THEN** the `expected-constructs` field SHALL list `@access` as a required construct in the output

### Requirement: B009–B010 measure token compression for P1 and P2 panels
Cases B009–B010 SHALL compare token counts (cl100k_base) between the hand-authored `.strux` source for P1 (intake) and P2 (eligibility) and their TypeScript baselines.

#### Scenario: B009 records compression ratio for P1
- **WHEN** B009 is scored
- **THEN** the result SHALL record `struxTokens`, `baselineTokens`, and `compressionRatio` for the P1 intake panel
