## ADDED Requirements

### Requirement: GDPR Art. 5 principle enforcement

When `framework: gdpr` is used, the `private-data` rod SHALL enforce GDPR Art. 5 principles at compile time:

- **Purpose limitation**: The `purpose` config knot is required and must be non-empty.
- **Data minimization**: If `predicate` arg is provided, only matching fields pass through. The expanded `pseudonymize` rod masks all fields classified as `identifying` or `quasi_identifying`.
- **Storage limitation**: `retention` config is required for GDPR framework.

#### Scenario: Purpose is required for GDPR
- **WHEN** a `private-data` rod uses `framework: gdpr` without `purpose`
- **THEN** the compiler emits a diagnostic error: `purpose` is required for GDPR (Art. 5(1)(b))

#### Scenario: Retention is required for GDPR
- **WHEN** a `private-data` rod uses `framework: gdpr` without `retention`
- **AND** no `retention` is inherited from `@privacy` in context
- **THEN** the compiler emits a diagnostic error: `retention` is required for GDPR (Art. 5(1)(e))

### Requirement: GDPR Art. 25 data protection by design

When `framework: gdpr` is used, the expanded sub-graph SHALL apply pseudonymization by default to all fields with `category: identifying` or `category: quasi_identifying`. This is the Art. 25 "data protection by design and by default" guarantee.

#### Scenario: Identifying fields pseudonymized by default
- **WHEN** a `private-data` rod classifies `email` as `identifying` and `zip_code` as `quasi_identifying`
- **THEN** the expanded `pseudonymize` rod includes both `email` and `zip_code` in its field mask without the author needing to list them explicitly

#### Scenario: Non-identifying fields pass through
- **WHEN** a `private-data` rod classifies `proposal_title` with no category (or as non-personal)
- **THEN** the field is not included in the pseudonymize mask

### Requirement: GDPR Art. 6 lawful basis validation

The `private-data` rod with GDPR framework SHALL require `lawful_basis` in the framework config. The expanded `guard` rod SHALL include a policy check that the declared lawful basis is valid for the stated purpose.

#### Scenario: Consent basis accepted
- **WHEN** `framework: gdpr` with `lawful_basis: consent` and `purpose: "marketing"`
- **THEN** the compiler accepts and the guard rod checks for valid consent context at runtime

#### Scenario: Legitimate interest requires documentation
- **WHEN** `framework: gdpr` with `lawful_basis: legitimate_interest`
- **AND** no `dpia_ref` is provided
- **THEN** the compiler emits a warning (not error): DPIA recommended for legitimate interest processing

### Requirement: GDPR Art. 30 manifest record

When a panel with `private-data { framework: gdpr }` is compiled, the manifest SHALL include an Art. 30 record entry with:

- Controller identity (from `@dp`)
- Processing purpose (from rod `purpose`)
- Lawful basis (from framework config)
- Data subject categories (from framework config)
- Personal data categories (derived from `fields` classification)
- Recipients (derived from downstream `write-data` targets)
- Retention period and basis (from rod `retention`)
- Technical measures applied (pseudonymization, encryption — derived from expansion)
- DPIA reference (from framework config, if present)

#### Scenario: Art. 30 record in manifest
- **WHEN** a panel with `private-data { framework: gdpr, purpose: "intake", lawful_basis: contract, ... }` is compiled
- **THEN** the manifest contains a `privacyRecords` entry with all Art. 30 fields populated

#### Scenario: Multiple private-data rods produce multiple records
- **WHEN** a panel contains two `private-data` rods with different purposes
- **THEN** the manifest contains two separate Art. 30 record entries

### Requirement: GDPR special category data handling

When any field in `fields` has `sensitivity: special_category` (Art. 9 data), the `private-data` rod with GDPR framework SHALL:
- Default `encryption_required` to `true`
- Require `lawful_basis` to be one of: `consent`, `legal_obligation`, `vital_interests` (the Art. 9(2) permitted bases)
- Include the field categories in the Art. 30 record under a `specialCategories` sub-field

#### Scenario: Special category forces encryption
- **WHEN** `fields` includes `{ field: "ethnicity", category: political, sensitivity: special_category }`
- **AND** `encryption_required` is not set
- **THEN** the compiler defaults `encryption_required` to `true`

#### Scenario: Special category restricts lawful basis
- **WHEN** `fields` includes a `special_category` field and `lawful_basis: legitimate_interest`
- **THEN** the compiler emits a diagnostic error: `legitimate_interest` is not a valid basis for special category data under Art. 9
