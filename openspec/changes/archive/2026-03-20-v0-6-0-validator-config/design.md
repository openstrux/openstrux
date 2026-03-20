## Context

The validator sits between parser and generator. It receives a syntactically valid AST and enforces semantic rules: are referenced types defined? Do rod input/output knots resolve to declared types? Is every panel accompanied by an AccessContext? Does the `@access` scope match the field-level declarations?

Config inheritance is a prerequisite — panels authored with shorthand assume a resolved context cascade. The validator receives a fully-resolved AST with no context references remaining. This matches the spec design: "source is compact, compiled is complete."

Policy resolution is a structural concern, not middleware. AccessContext scope narrowing, guard evaluation tiers, and warnings like `W_POLICY_OPAQUE` and `W_SCOPE_UNVERIFIED` are not optional details once validator work begins, because AccessContext and policy provenance are structural parts of the language rather than middleware afterthoughts.

## Goals / Non-Goals

**Goals:**
- Type resolution: all `@type` references in rod knots and type paths resolve to defined types
- Rod knot compatibility: `in`/`out` knot types are compatible with adjacent rods in the panel's snap chain
- AccessContext enforcement: every `@panel` has a non-null `@access` block (warning W002 if absent in v0.6.0, error in v0.7.0)
- Scope validation: fields referenced in `@access scope` are declared on the relevant types
- `@cert` enforcement (ADR-011): reject `@cert` in `strux.context` files, verify content hash, warn on uncovered scope
- Config inheritance resolution: `strux.context` cascade (project -> folder -> panel)
- Policy resolution: guard evaluation tiers (inline/hub/external), policy verification diagnostics

**Non-Goals:**
- Manifest generation or `--explain` output (see `v0-6-0-manifest-explain`)
- Lock file semantics (see `v0-6-0-lock-determinism`)
- Full data-flow analysis (post-0.6.0)
- Cross-panel reference validation (post-0.6.0)
- Runtime execution or side-effect checks

## Decisions

**Validator is a single-pass tree walk, not a constraint solver**
The type system is simple enough (no generics, no recursive types in v0.6.0) that a top-down tree walk with a symbol table is sufficient.

**Symbol table: two-phase (collect declarations, then resolve references)**
Phase 1: walk all top-level `@type` definitions and populate a `SymbolTable: Map<string, TypeDef>`. Phase 2: walk all panels and validate knot types against the symbol table. This avoids ordering constraints.

**Config inheritance: resolve before validate**
`packages/config/` resolves the `strux.context` cascade before validation. It walks ancestor directories collecting context files, merges `@dp` (field-level merge, panel wins), narrows `@access` (child scope <= parent scope, else compile error), merges `@ops`/`@sec` (nearest wins), and resolves named `@source`/`@target` references.

**`@cert` enforcement (ADR-011): three diagnostics**
- `E_CERT_IN_CONTEXT`: `@cert` block found in any `strux.context` file -> compile error. Checked during config resolution.
- `E_CERT_HASH_MISMATCH`: `@cert` block references a content hash that does not match the compiled output -> compile error.
- `W_CERT_SCOPE_UNCOVERED`: Panel uses a type path not covered by its `@cert` scope -> warning.

**Policy resolution: three-tier guard evaluation**
Guard rods reference policies from three tiers (ADR-010): inline (static verification at compile time), hub (versioned artifacts, resolved at compile time), external (OPA/Cedar, opaque at compile time). When the validator encounters a guard rod:
- Inline policy: fully verified, no diagnostic
- Hub policy: resolved and verified if available, `W_POLICY_OPAQUE` if hub is unreachable
- External policy: always emits `W_POLICY_OPAQUE` (cannot verify at compile time)
`W_SCOPE_UNVERIFIED` is emitted when AccessContext scope fields referenced in a policy cannot be statically confirmed against the type system.

**Rod signature table: static, derived from spec**
Rod signatures are encoded in `packages/validator/src/rod-signatures.ts`, derived from `specs/modules/rods/overview.md`. The table is the single source of truth for knot compatibility.

## Risks / Trade-offs

**[Risk] AccessContext enforcement rejects valid-but-legacy panels without @access**
-> Mitigation: Emit W002 warning (not error) in v0.6.0. Upgrade to error in v0.7.0.

**[Risk] Config inheritance adds a pre-validation phase that increases complexity**
-> Mitigation: Config resolution is a separate package with its own unit tests. The validator receives an already-resolved AST and has no knowledge of inheritance.

**[Risk] `@cert` hash verification creates a chicken-and-egg: hash depends on compiled output, but cert is part of the source**
-> Mitigation: `@cert.hash` is excluded from the canonical form used for hash computation. Documented in RFC-0001 annex.

**[Risk] External policy resolution always emits W_POLICY_OPAQUE, which may be noisy**
-> Mitigation: External policies are expected to be rare in v0.6.0. The warning is suppressible via `@ops { suppress: ["W_POLICY_OPAQUE"] }` in context.

## Open Questions

- Should the validator enforce that `@type` names are PascalCase? Decision: warning only (W003) in v0.6.0.
- Should config inheritance support multi-file panels? Decision: no for v0.6.0 — each panel resolves context independently.
