## Purpose

Defines the multi-step benchmark protocol for certification benchmarks, including the step sequence, certification prompt template (step 2), and propagation prompt template (step 3).

## Requirements

### Requirement: Multi-step benchmark protocol

The benchmark system SHALL support a three-step protocol where each step builds on the previous step's output:

- **Step 1 (Generate)**: Existing backend generation flow. Produces working TypeScript code.
- **Step 2 (Certify)**: Produce a GDPR Art. 30 record of processing activities from the generated code.
- **Step 3 (Propagate)**: Add a new PII field and update the Art. 30 record.

Steps 2 and 3 operate in the same worktree as step 1.

#### Scenario: Step 2 runs after step 1 completes
- **WHEN** step 1 has completed and all acceptance criteria pass
- **THEN** step 2 can be initiated in the same worktree with the certification prompt

#### Scenario: Step 2 skipped if step 1 fails
- **WHEN** step 1 fails its acceptance criteria (tests fail or types don't compile)
- **THEN** step 2 is not scored (marked as "skipped — prerequisite failed")

#### Scenario: Step 3 runs after step 2 completes
- **WHEN** step 2 has produced a valid Art. 30 record
- **THEN** step 3 can be initiated with the propagation prompt

### Requirement: Certification prompt template

The step 2 prompt SHALL be path-agnostic (identical for direct and openstrux paths). It SHALL request a structured JSON output conforming to a defined Art. 30 schema.

The prompt SHALL ask for, per data flow:
1. Controller identity and DPO
2. Processing purpose
3. Lawful basis (GDPR Art. 6)
4. Categories of data subjects
5. Categories of personal data processed
6. Recipients or categories of recipients
7. Retention period
8. Technical and organizational security measures
9. DPIA reference (if applicable)

#### Scenario: Same prompt for both paths
- **WHEN** the benchmark runner assembles the step 2 prompt
- **THEN** the prompt text is identical for both `--path direct` and `--path openstrux`

#### Scenario: Structured output requested
- **WHEN** the step 2 prompt is delivered to the LLM
- **THEN** it requests JSON output conforming to `benchmarks/schemas/art30-record.json`

### Requirement: Propagation prompt template

The step 3 prompt SHALL specify a concrete change: add a new PII field (e.g., `phone_number` to applicant identity) and request an updated Art. 30 record that reflects the change.

#### Scenario: Propagation adds a PII field
- **WHEN** the step 3 prompt is delivered
- **THEN** it instructs the LLM to add `phone_number` as an `identifying` field to applicant identity and update all affected artifacts

#### Scenario: Updated Art. 30 record reflects new field
- **WHEN** step 3 is complete
- **THEN** the updated Art. 30 record includes `phone_number` in the personal data categories for affected data flows
