## MODIFIED Requirements

### Requirement: Manifest privacy records

The manifest output SHALL include a `privacyRecords` array when one or more `private-data` rods are present in the compiled panel. Each entry corresponds to one `private-data` rod instance.

The `privacyRecords` field is `null` (omitted) when no `private-data` rods are present. This is additive — all existing manifest fields remain unchanged.

#### Scenario: Manifest includes privacy records for GDPR
- **WHEN** a panel with `private-data { framework: gdpr, ... }` is compiled
- **THEN** the manifest JSON contains a `privacyRecords` array with one entry containing Art. 30 fields

#### Scenario: Manifest omits privacy records when no private-data rod
- **WHEN** a panel with only basic rods (no `private-data`) is compiled
- **THEN** the manifest JSON does not contain a `privacyRecords` field

#### Scenario: BDSG privacy record extends GDPR
- **WHEN** a panel with `private-data { framework: gdpr.bdsg, ... }` is compiled
- **THEN** the manifest `privacyRecords` entry contains all GDPR Art. 30 fields plus `bdsgSection26`, `employeeCategory`, and `betriebsratConsent` fields

#### Scenario: Privacy records are deterministic
- **WHEN** the same panel is compiled twice with identical config
- **THEN** both compilations produce identical `privacyRecords` entries (same field order, same values)
