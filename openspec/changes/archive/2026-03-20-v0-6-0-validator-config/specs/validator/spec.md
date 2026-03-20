## Capability: `validator`

### Requirements

- **V-001**: Validator resolves all type references — emits `V001` on unresolved reference
- **V-002**: Validator checks rod knot compatibility pairwise in the snap chain — emits `V002` on type mismatch
- **V-003**: Validator checks fields in `@access scope` are declared on referenced types — emits `V003` on missing field
- **V-004**: Validator enforces `@access` block on all panels — emits `W002` (warning, not error in v0.6.0) if absent
- **V-005**: Validator checks rod signatures against static table from `specs/modules/rods/overview.md`
- **V-006**: Validator enforces `@cert` rules per ADR-011:
  - `E_CERT_IN_CONTEXT` if `@cert` found in `strux.context` file
  - `E_CERT_HASH_MISMATCH` if cert hash does not match compiled output
  - `W_CERT_SCOPE_UNCOVERED` if panel uses type paths outside cert scope
- **V-007**: Validator emits policy diagnostics:
  - `W_POLICY_OPAQUE` when guard references an external or unreachable hub policy
  - `W_SCOPE_UNVERIFIED` when scope fields cannot be statically confirmed

### Acceptance Scenarios

**Scenario: Valid P0 domain model**
Given a well-formed `@type` file defining records, enums, and unions
When the validator runs
Then zero diagnostics are emitted

**Scenario: Unresolved type reference**
Given a panel rod referencing a type not defined in the source
When the validator runs
Then `V001` diagnostic is emitted with the undefined type name and source location

**Scenario: Guard with external policy**
Given a panel with a guard rod referencing an OPA policy
When the validator runs
Then `W_POLICY_OPAQUE` is emitted for the guard rod
