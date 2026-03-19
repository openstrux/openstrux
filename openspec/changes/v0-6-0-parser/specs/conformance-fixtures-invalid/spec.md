## ADDED Requirements

### Requirement: Invalid fixtures exist for common parser error cases
`openstrux-spec/conformance/invalid/` SHALL contain at least four `.strux` fixture files that trigger specific parser diagnostics. Each fixture SHALL be accompanied by a `.expected.json` file listing the expected diagnostic codes.

#### Scenario: Unclosed brace fixture triggers E001
- **WHEN** the parser processes `conformance/invalid/err-unclosed-brace.strux`
- **THEN** `result.diagnostics` SHALL contain exactly one entry with `code: "E001"`

#### Scenario: Unknown rod type fixture triggers E002
- **WHEN** the parser processes `conformance/invalid/err-unknown-rod.strux`
- **THEN** `result.diagnostics` SHALL contain at least one entry with `code: "E002"`

#### Scenario: Malformed type path fixture triggers E003
- **WHEN** the parser processes `conformance/invalid/err-bad-type-path.strux`
- **THEN** `result.diagnostics` SHALL contain at least one entry with `code: "E003"`

#### Scenario: Missing @access block fixture triggers W001
- **WHEN** the parser processes `conformance/invalid/warn-missing-access.strux`
- **THEN** `result.diagnostics` SHALL contain at least one entry with `code: "W001"` and `severity: "warning"`
