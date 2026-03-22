## ADDED Requirements

### Requirement: strux doctor validates config against adapters
`strux doctor` SHALL read `strux.config.yaml` and check each target dependency against available adapter compatibility ranges.

#### Scenario: All dependencies resolve
- **WHEN** `strux doctor` is run and all config entries match available adapters
- **THEN** each entry SHALL be reported with ✓ and the resolved adapter name/version

#### Scenario: Dependency has no matching adapter
- **WHEN** `strux doctor` is run and a config entry has no compatible adapter
- **THEN** the entry SHALL be reported with ✗, the closest available range, and a suggestion

### Requirement: strux doctor verifies tsconfig paths
For TypeScript targets, `strux doctor` SHALL verify that `tsconfig.json` contains the correct path aliases for `@openstrux/build`.

#### Scenario: Paths correctly configured
- **WHEN** `strux doctor` runs and `tsconfig.json` has correct `@openstrux/build` path aliases
- **THEN** the tsconfig check SHALL report ✓

#### Scenario: Paths missing or incorrect
- **WHEN** `strux doctor` runs and `tsconfig.json` is missing `@openstrux/build` paths
- **THEN** the tsconfig check SHALL report ✗ and suggest running `strux init` or adding the paths manually
