## 1. Config inheritance resolution

- [x] 1.1 Add `packages/config/` to `pnpm-workspace.yaml` and `turbo.json`
- [x] 1.2 Define `ResolvedContext` interface in `packages/config/src/types.ts` — fully flattened `@dp`, `@access`, `@ops`, `@sec`, named sources/targets
- [x] 1.3 Implement `strux.context` file parser — reuse lexer/parser from `packages/parser/` for the `@context { ... }` block syntax
- [x] 1.4 Implement directory-walk context collector — walks ancestor directories from panel location to project root, collects context files in cascade order (nearest wins)
- [x] 1.5 Implement `@dp` merge — field-level merge, panel fields win on conflict
- [x] 1.6 Implement `@access` narrowing — verify child scope <= parent scope, emit compile error on widening attempt
- [x] 1.7 Implement `@ops` and `@sec` merge — nearest wins per field
- [x] 1.8 Implement named `@source`/`@target` resolution — resolve `@name` references, apply inline overrides as spread, emit compile error if `@name` not found
- [x] 1.9 Implement `@cert`-in-context rejection — emit `E_CERT_IN_CONTEXT` if any `strux.context` file contains a `@cert` block (ADR-011)
- [x] 1.10 Wire config resolution as pre-validation step: `resolve(panelPath) -> ResolvedAST`
- [x] 1.11 Write unit tests: merge semantics, narrowing enforcement, @name resolution, @cert rejection
- [x] 1.12 Run `pnpm test --filter packages/config` — all tests pass

## 2. Validator

- [x] 2.1 Define `ValidationDiagnostic` interface and diagnostic codes: V001 (unresolved type), V002 (knot mismatch), V003 (scope field missing), V004 (snap chain break), W002 (missing @access), W003 (non-PascalCase type name), E_CERT_IN_CONTEXT, E_CERT_HASH_MISMATCH, W_CERT_SCOPE_UNCOVERED, W_POLICY_OPAQUE, W_SCOPE_UNVERIFIED
- [x] 2.2 Implement `SymbolTable` class — Phase 1 pass collecting all `@type` declarations from the AST
- [x] 2.3 Implement type reference resolver — walks rod knots and type paths, looks up against SymbolTable, emits V001 on miss
- [x] 2.4 Encode rod signature table in `packages/validator/src/rod-signatures.ts` — all 18 rod types with `in`/`out` knot types, sourced from `specs/modules/rods/overview.md`
- [x] 2.5 Implement snap chain compatibility checker — walks panel rod list pairwise, compares `out` -> `in` types, emits V002 on mismatch
- [x] 2.6 Implement AccessContext enforcer — checks every `PanelNode.access` is non-null, emits W002 if absent
- [x] 2.7 Implement scope validator — checks fields in `@access scope` are declared on referenced types, emits V003 on mismatch
- [x] 2.8 Implement `@cert` hash verification — compare against `@cert.hash` if present, emit `E_CERT_HASH_MISMATCH` on mismatch (ADR-011)
- [x] 2.9 Implement `@cert` scope coverage check — compare type paths used in validated AST against `@cert.scope`, emit `W_CERT_SCOPE_UNCOVERED` for uncovered paths (ADR-011)

## 3. Policy resolution

- [x] 3.1 Implement guard policy tier detection — classify each guard rod's policy reference as inline, hub, or external (ADR-010)
- [x] 3.2 Implement inline policy verification — fully resolve and verify at compile time
- [x] 3.3 Implement hub policy resolution — attempt lookup, emit `W_POLICY_OPAQUE` if unreachable
- [x] 3.4 Implement external policy stub — always emit `W_POLICY_OPAQUE` for OPA/Cedar references
- [x] 3.5 Implement `W_SCOPE_UNVERIFIED` — emit when AccessContext scope fields referenced in a policy cannot be statically confirmed against the type system
- [x] 3.6 Wire policy diagnostics into validator output
- [x] 3.7 Write unit tests for each policy tier and diagnostic

## 4. Conformance fixtures

- [x] 4.1 Write config inheritance valid fixtures in `openstrux-spec/conformance/valid/`:
  - `v010-context-dp-merge.strux`, `v010-context-access-narrow.strux`, `v010-context-named-source.strux`
- [x] 4.2 Write config inheritance invalid fixtures in `openstrux-spec/conformance/invalid/`:
  - `i010-access-widening.strux`, `i010-unresolved-source-ref.strux`
- [x] 4.3 Write ADR-011 valid fixtures:
  - `v011-panel-cert.strux`, `v011-rod-cert.strux`, `v011-no-cert.strux`
- [x] 4.4 Write ADR-011 invalid fixtures:
  - `i011-cert-in-project-context.strux`, `i011-cert-in-folder-context.strux`, `i011-cert-hash-mismatch.strux`, `i011-cert-scope-uncovered.strux`
- [x] 4.5 Mirror all fixtures into `openstrux-core/tests/fixtures/`
- [x] 4.6 Write conformance test suite asserting validator diagnostics match expected codes

## 5. Integration

- [x] 5.1 Write unit tests for each validation rule (resolver, snap chain, access, scope, cert hash, cert scope)
- [x] 5.2 Run `pnpm test --filter packages/validator` — all tests pass
- [x] 5.3 Run `pnpm test --filter packages/config` — all tests pass
- [x] 5.4 Run full test suite from repo root — all packages pass
