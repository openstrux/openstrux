## Why

The parser produces a syntactically valid AST but makes no semantic checks — unknown types, unresolved references, missing required knots, and AccessContext violations all pass through silently. The validator is what makes Openstrux "certified by design" (Principle 3). Config inheritance must be resolved before validation because panels depend on context cascade for `@dp`, `@access`, named sources/targets, and `@ops`/`@sec`.

Policy resolution is not an afterthought — AccessContext and policy provenance are structural parts of the language. Scope narrowing, guard evaluation tiers, and diagnostics like `W_POLICY_OPAQUE` and `W_SCOPE_UNVERIFIED` must be implemented alongside validation because they affect whether the validator accepts a panel.

This package is the semantic prerequisite layer. Manifest and explanation output sit on top of it (see `v0-6-0-manifest-explain`).

## What Changes

- Implement `packages/validator/` — type resolution, snap chain checking, AccessContext enforcement, scope validation, `@cert` enforcement (ADR-011), policy resolution diagnostics
- Implement `packages/config/` — `strux.context` cascade: `@dp` merge, `@access` narrowing, `@ops`/`@sec` merge, named `@source`/`@target` resolution, `@cert`-in-context rejection (ADR-011)
- Policy resolution plumbing: guard evaluation tiers (inline → hub → external), `W_POLICY_OPAQUE` when policy source is unverifiable, `W_SCOPE_UNVERIFIED` when scope fields cannot be statically confirmed
- Conformance fixtures for config inheritance and ADR-011

## Capabilities

### New Capabilities

- `validator`: Type-checks AST nodes against the spec type system; validates rod knot compatibility; enforces AccessContext on all panels; enforces `@cert` rules (ADR-011: `E_CERT_IN_CONTEXT`, `E_CERT_HASH_MISMATCH`, `W_CERT_SCOPE_UNCOVERED`); emits policy diagnostics (`W_POLICY_OPAQUE`, `W_SCOPE_UNVERIFIED`); reports `ValidationDiagnostic[]`
- `config-inheritance`: Resolves `strux.context` cascade (project -> folder -> panel) — merges `@dp`, narrows `@access`, merges `@ops`/`@sec`, resolves named `@source`/`@target` references, rejects `@cert` in context files (ADR-011)

### Modified Capabilities

_(none)_

## Impact

- **openstrux-core**: Two packages go from stubs to implementations (validator, config)
- **openstrux-spec**: New conformance fixtures under `conformance/valid/` and `conformance/invalid/` for config inheritance and ADR-011
- **Downstream**: Lock-determinism and manifest-explain both require a validated, resolved AST — this change unblocks both
- **No breaking changes**
