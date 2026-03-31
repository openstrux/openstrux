## Capability: `private-data-rod`

### Purpose

Define the `private-data` standard rod — its knots, implicit chaining, composition of basic compliance rods, context inheritance, and the `@privacy` panel decorator.

### Requirements

### Requirement: private-data rod definition

The spec SHALL define a `private-data` standard rod with the following knots:

**Configuration knots (cfg):**
- `framework`: `PrivacyFramework` — which privacy law governs this flow
- `fields`: `Batch<FieldClassification>` — classified personal data fields
- `purpose`: `string` — processing purpose (human-readable, maps to Art. 30)
- `retention`: `RetentionPolicy` — how long data is kept
- `encryption_required`: `bool` — whether encrypt rod is included in expansion (default: framework-dependent)

**Argument knots (arg):**
- `predicate`: `Optional<string>` — additional filter predicate for data minimization

**Input knots (in):**
- `data`: `Single<T>` or `Stream<T>` — personal data to process

**Output knots (out):**
- `protected`: the processed data with pseudonymization/encryption applied
- `audit`: privacy processing audit record

**Error knots (err):**
- `denied`: access denied by privacy guard
- `invalid`: data failed schema validation
- `policy_violation`: framework-specific policy violation (e.g., missing lawful basis)

#### Scenario: private-data rod compiles with valid config
- **WHEN** a panel contains `pd = private-data { framework: gdpr, fields: [...], purpose: "intake", retention: { duration: "5y" } }`
- **THEN** the compiler accepts it and produces a valid IR with expanded basic rods

#### Scenario: private-data rod rejects missing fields
- **WHEN** a panel contains `pd = private-data { framework: gdpr }` without `fields`
- **THEN** the compiler emits a diagnostic error: required knot `fields` is missing

### Requirement: private-data implicit chain compatibility

The `private-data` rod SHALL follow implicit chaining rules. Its default input knot is `data` and default output knot is `protected`.

#### Scenario: Implicit chain from receive to private-data
- **WHEN** a panel has `recv = receive { ... }` followed by `pd = private-data { ... }` with no explicit `from:`
- **THEN** the compiler wires `recv.out.request -> pd.in.data` via implicit chain

#### Scenario: Implicit chain from private-data to write-data
- **WHEN** `pd = private-data { ... }` is followed by `sink = write-data { ... }` with no explicit `from:`
- **THEN** the compiler wires `pd.out.protected -> sink.in.rows` via implicit chain

### Requirement: private-data composes basic compliance rods

The `private-data` rod SHALL expand to a sub-graph containing at minimum: `validate` (schema check), `pseudonymize` (field masking), and `guard` (access check). The `encrypt` rod is included when `encryption_required` is true or when the framework mandates it.

#### Scenario: Base expansion includes validate, pseudonymize, guard
- **WHEN** `pd = private-data { framework: gdpr, encryption_required: false, ... }` is compiled
- **THEN** the expanded IR contains `validate → pseudonymize → guard` in sequence

#### Scenario: Expansion with encryption
- **WHEN** `pd = private-data { framework: gdpr, encryption_required: true, ... }` is compiled
- **THEN** the expanded IR contains `validate → pseudonymize → encrypt → guard` in sequence

### Requirement: private-data inherits from context

The `private-data` rod SHALL inherit `framework`, `fields`, and `retention` from `strux.context` if a `@privacy` block is declared in context. Panel-level config overrides context values (field-level merge).

#### Scenario: Framework inherited from context
- **WHEN** `strux.context` declares `@privacy { framework: gdpr, retention: { duration: "3y" } }`
- **AND** a panel contains `pd = private-data { fields: [...], purpose: "analytics" }` without `framework`
- **THEN** the rod inherits `framework: gdpr` and `retention: { duration: "3y" }` from context

### Requirement: @privacy panel decorator

The spec SHALL define a `@privacy` decorator at panel level. When declared, the validator SHALL enforce that every data flow path from a source rod (`receive`, `read-data`) to a sink rod (`write-data`, `respond`) passes through at least one `private-data` rod with a compatible framework.

#### Scenario: Missing private-data rod on data path
- **WHEN** a panel declares `@privacy { framework: gdpr }` and contains a path `receive → transform → write-data` with no `private-data` rod
- **THEN** the compiler emits a diagnostic error: data flow path bypasses privacy protection

#### Scenario: Compatible framework accepted
- **WHEN** a panel declares `@privacy { framework: gdpr }` and all data paths include a `private-data { framework: gdpr }` rod
- **THEN** the compiler accepts the panel with no privacy-related diagnostics

#### Scenario: Narrower framework accepted
- **WHEN** a panel declares `@privacy { framework: gdpr }` and a data path includes `private-data { framework: gdpr.bdsg }`
- **THEN** the compiler accepts it — BDSG is a narrowing of GDPR, which is compatible
