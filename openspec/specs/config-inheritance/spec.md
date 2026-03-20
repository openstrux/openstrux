## Capability: `config-inheritance`

### Requirements

- **CI-001**: Config resolver walks ancestor directories from panel location to project root, collecting `strux.context` files in cascade order
- **CI-002**: `@dp` fields are merged with field-level granularity — panel fields win on conflict
- **CI-003**: `@access` scope narrows monotonically — child scope must be a subset of parent scope; widening attempt emits compile error
- **CI-004**: `@ops` and `@sec` are merged with nearest-wins-per-field semantics
- **CI-005**: Named `@source`/`@target` references are resolved against context declarations; inline overrides apply as spread; unresolved reference emits compile error
- **CI-006**: `@cert` blocks in `strux.context` files are rejected with `E_CERT_IN_CONTEXT` (ADR-011)
- **CI-007**: The resolved context is a fully flattened `ResolvedContext` object — no context references remain after resolution

### Acceptance Scenarios

**Scenario: @dp merge**
Given a root context with `controller: "Legal"` and a folder context with `processor: "TechPartner"`
When config is resolved for a panel in that folder
Then the resolved `@dp` contains both `controller` and `processor`

**Scenario: @access widening rejected**
Given a root context with `scope: { fields: [name, email] }` and a panel with `scope: { fields: [name, email, ssn] }`
When config is resolved
Then a compile error is emitted (scope widening)

**Scenario: Named source resolution**
Given a root context defining `@source production { type: db.sql.postgres, host: "prod.db" }`
And a panel using `cfg.source: @production`
When config is resolved
Then `cfg.source` is replaced with the full `db.sql.postgres` config with `host: "prod.db"`

**Scenario: @cert in context rejected**
Given a `strux.context` file containing a `@cert` block
When config is resolved
Then `E_CERT_IN_CONTEXT` is emitted
