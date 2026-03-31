## Capability: `bdsg-specialization`

### Purpose

Define BDSG-specific behavior when `framework: gdpr.bdsg` is used — Section 26 employee data rules, Betriebsrat consent tracking, stricter pseudonymization defaults, manifest extensions, and GDPR inheritance.

### Requirements

### Requirement: BDSG Section 26 employee data rules

When `framework: gdpr.bdsg` is used with `employee_data: true`, the `private-data` rod SHALL apply stricter processing rules per BDSG Section 26:

- All `identifying` and `quasi_identifying` fields are treated as `sensitivity: special_category` (elevated protection for employment context)
- `encryption_required` defaults to `true` regardless of field sensitivity
- The `employee_category` config knot becomes required

#### Scenario: Employee data elevates sensitivity
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and a field `{ field: "salary", category: financial, sensitivity: standard }`
- **THEN** the compiler treats the field as `special_category` for pseudonymization and encryption purposes

#### Scenario: Employee category required for employee data
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and no `employee_category`
- **THEN** the compiler emits a diagnostic error: `employee_category` is required when `employee_data` is true (BDSG Section 26)

### Requirement: Betriebsrat consent tracking

When `framework: gdpr.bdsg` is used with `employee_data: true`, the `betriebsrat_consent` config knot SHALL be validated. If the processing purpose involves employee monitoring, performance evaluation, or behavioral analysis, `betriebsrat_consent` is required.

#### Scenario: Monitoring purpose requires Betriebsrat consent
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and `purpose` contains "monitoring" or "performance"
- **AND** `betriebsrat_consent` is not provided
- **THEN** the compiler emits a warning: Betriebsrat consent reference recommended for employee monitoring under BDSG Section 87 BetrVG

#### Scenario: Betriebsrat consent recorded in manifest
- **WHEN** `framework: gdpr.bdsg` with `betriebsrat_consent: "BR-2026-003"`
- **THEN** the manifest privacy record includes `betriebsratConsent: "BR-2026-003"` alongside the Art. 30 entry

### Requirement: BDSG stricter pseudonymization defaults

When `framework: gdpr.bdsg` is used, the expanded `pseudonymize` rod SHALL use stronger defaults than base GDPR:

- Default algorithm: `sha256_hmac` (keyed hash, reversible with key) instead of `sha256` (one-way)
- All `quasi_identifying` fields are pseudonymized (GDPR base only pseudonymizes if explicitly classified)
- The pseudonymization key reference is required (no keyless hashing)

#### Scenario: BDSG uses keyed pseudonymization
- **WHEN** `framework: gdpr.bdsg` and the expanded `pseudonymize` rod is emitted
- **THEN** the generated code uses HMAC-based pseudonymization with a key reference, not plain SHA-256

#### Scenario: Quasi-identifying fields always masked under BDSG
- **WHEN** `framework: gdpr.bdsg` with `fields` containing `{ field: "department", category: quasi_identifying }`
- **THEN** the field is included in the pseudonymize mask regardless of other settings

### Requirement: BDSG manifest extensions

The manifest privacy record for `framework: gdpr.bdsg` SHALL extend the GDPR Art. 30 record with:

- `bdsgSection26`: `true` if `employee_data` is true
- `employeeCategory`: the declared employee category
- `betriebsratConsent`: the consent reference (if provided)
- `dataProtectionOfficer`: required (BDSG Section 38 — mandatory for companies processing employee data)

#### Scenario: BDSG manifest includes employee context
- **WHEN** a `private-data` rod with `framework: gdpr.bdsg`, `employee_data: true`, `employee_category: employee`
- **THEN** the manifest privacy record contains `bdsgSection26: true`, `employeeCategory: "employee"`, and `dataProtectionOfficer` from `@dp.dpo`

### Requirement: BDSG inherits all GDPR requirements

All GDPR requirements (Art. 5 enforcement, Art. 25 defaults, Art. 6 lawful basis, Art. 30 records, Art. 9 special categories) SHALL apply unchanged when `framework: gdpr.bdsg` is used. BDSG adds constraints on top of GDPR — it never relaxes them.

#### Scenario: GDPR purpose requirement applies under BDSG
- **WHEN** `framework: gdpr.bdsg` without `purpose`
- **THEN** the compiler emits the same diagnostic error as for `framework: gdpr`: `purpose` is required (Art. 5(1)(b))

#### Scenario: GDPR Art. 30 record emitted under BDSG
- **WHEN** `framework: gdpr.bdsg` is compiled
- **THEN** the manifest contains a standard Art. 30 record plus the BDSG extensions — not a replacement
