## ADDED Requirements

### Requirement: B011 — Art. 30 record from generated backend

A benchmark case SHALL exist (B011) in the `certification-and-audit` category that measures whether an LLM can produce a complete GDPR Art. 30 record from generated backend code.

**Constructs tested:** `@dp`, `@access`, field classification, data flow tracing

#### Scenario: B011 case file exists with required fields
- **WHEN** the benchmark suite is inspected
- **THEN** `benchmarks/cases/B011.md` exists with id, category, intent prompt, expected validation, and expected metrics

#### Scenario: B011 scored against reference record
- **WHEN** B011 is evaluated for the grant workflow use case
- **THEN** the output Art. 30 JSON is compared field-by-field against `benchmarks/baselines/art30-reference.json`

### Requirement: B012 — Privacy field classification accuracy

A benchmark case SHALL exist (B012) that measures whether an LLM correctly identifies and classifies PII fields in the generated system.

**Constructs tested:** Field classification, data category identification, sensitivity levels

#### Scenario: B012 tests field identification
- **WHEN** B012 is evaluated
- **THEN** the LLM must identify all PII fields (name, email, organization) and classify them by category (identifying, quasi-identifying) and sensitivity

#### Scenario: B012 openstrux path uses type metadata
- **WHEN** B012 is evaluated for the openstrux path
- **THEN** field classifications can be derived from `@type` definitions and `FieldClassification` annotations in `.strux` source

### Requirement: B013 — Change propagation correctness

A benchmark case SHALL exist (B013) that measures whether adding a new PII field correctly propagates through the certification artifacts.

**Constructs tested:** Change propagation, re-certification, structural update

#### Scenario: B013 measures files touched
- **WHEN** B013 step 3 is evaluated
- **THEN** the scoring tracks how many files the LLM modified to propagate the change and whether the Art. 30 record is correctly updated

#### Scenario: B013 openstrux path propagates structurally
- **WHEN** the openstrux path adds a field to `@type` and rebuilds
- **THEN** the manifest `privacyRecords` update automatically, and the Art. 30 record reflects the change without manual audit

### Requirement: B014 — Certification token efficiency

A benchmark case SHALL exist (B014) that compares the token cost of producing an Art. 30 record between the two paths.

**Constructs tested:** Token efficiency for compliance tasks, metadata queryability

#### Scenario: B014 measures certification tokens
- **WHEN** B014 step 2 is evaluated for both paths
- **THEN** the total tokens consumed (input + output) for the certification step are recorded and compared

### Requirement: B015 — Technical measures identification

A benchmark case SHALL exist (B015) that measures whether an LLM correctly identifies the technical and organizational security measures applied in the generated system.

**Constructs tested:** Pseudonymization detection, encryption detection, access control identification

#### Scenario: B015 lists technical measures
- **WHEN** B015 is evaluated
- **THEN** the output must identify pseudonymization (if applied), encryption (if applied), and access control mechanisms as technical measures in the Art. 30 record

#### Scenario: B015 openstrux path reads compliance rods
- **WHEN** B015 is evaluated for the openstrux path
- **THEN** technical measures can be derived directly from `pseudonymize`, `encrypt`, and `guard` rods in the `.strux` source or from manifest `technicalMeasures`
