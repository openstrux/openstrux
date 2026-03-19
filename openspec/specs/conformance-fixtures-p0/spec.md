## ADDED Requirements

### Requirement: Valid fixtures exist for all P0 domain model constructs
`openstrux-spec/conformance/valid/` SHALL contain at least five `.strux` fixture files covering the grant-workflow P0 domain model. Each file SHALL use the `@type` keyword for type definitions and be parseable under the v0.6.0 spec.

#### Scenario: Record fixture parses without errors
- **WHEN** the parser processes `conformance/valid/p0-record.strux`
- **THEN** it SHALL produce an AST with `kind: "TypeRecord"` at the root and exit with no diagnostics

#### Scenario: Enum fixture parses without errors
- **WHEN** the parser processes `conformance/valid/p0-enum.strux`
- **THEN** it SHALL produce an AST with `kind: "TypeEnum"` at the root and exit with no diagnostics

#### Scenario: Union fixture parses without errors
- **WHEN** the parser processes `conformance/valid/p0-union.strux`
- **THEN** it SHALL produce an AST with `kind: "TypeUnion"` at the root and exit with no diagnostics

#### Scenario: Panel-with-rod fixture parses without errors
- **WHEN** the parser processes `conformance/valid/p0-panel-rod.strux`
- **THEN** it SHALL produce an AST with `kind: "Panel"` containing at least one rod node and exit with no diagnostics

#### Scenario: Full P0 domain model fixture parses without errors
- **WHEN** the parser processes `conformance/valid/p0-domain-model.strux`
- **THEN** it SHALL produce an AST containing TypeRecord, TypeEnum, TypeUnion, and Panel nodes, with an `@access` block, and exit with no diagnostics

### Requirement: Fixture files are the canonical test inputs for the parser
Conformance fixtures in `openstrux-spec/conformance/valid/` SHALL be mirrored verbatim into `openstrux-core/tests/fixtures/valid/`. They SHALL NOT be edited inside openstrux-core.

#### Scenario: Core fixtures match spec fixtures exactly
- **WHEN** `openstrux-core/tests/fixtures/valid/p0-*.strux` is diffed against `openstrux-spec/conformance/valid/p0-*.strux`
- **THEN** the diff SHALL be empty
