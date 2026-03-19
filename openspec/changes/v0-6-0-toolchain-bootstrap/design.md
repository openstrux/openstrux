## Context

`openstrux-core` has a partially implemented AST package (`packages/ast/` at v0.5.0-alpha.0 with 7 TypeScript source files) but no build system, test runner, or monorepo tooling. The remaining five packages are stub READMEs. In parallel, `openstrux-spec` has zero conformance fixtures.

The AST is the load-bearing piece: every other package depends on it. It was generated against v0.5.0-alpha but must be verified against the current v0.5.0 spec to catch any drift. The grammar uses `@type` for type definitions (not `@strux`).

## Goals / Non-Goals

**Goals:**
- Working pnpm workspace: `pnpm build`, `pnpm test` run cleanly from repo root
- Review existing `packages/ast/` against `openstrux-spec@0.5.0`:
  - Verify node types in `common.ts`, `types.ts`, `values.ts`, `expressions.ts`, `access.ts`, `panel.ts`
  - Add missing types or fields if spec has evolved
  - Verify `kind` discriminants match spec terminology
  - Confirm the `@type` keyword is reflected in AST naming (not `@strux`)
- Five `.strux` fixture files in `openstrux-spec/conformance/valid/`
- AST interfaces remain the source of truth for all downstream packages

**Non-Goals:**
- No parser implementation (next change package)
- No CI pipeline — local dev only for v0.6.0-alpha
- No `packages/lock/` implementation (see `v0-6-0-lock-determinism`)

## Decisions

**Build runner: turbo**
Turbo wins on simplicity — zero config for a monorepo with no remote caching needed yet.

**Test runner: vitest**
Native ESM, zero config with TypeScript, faster cold start than jest.

**AST representation: plain TypeScript interfaces (no classes)**
Already implemented this way. Plain interfaces are serialisable, pattern-matchable with `switch (node.kind)`, and produce no runtime overhead.

**Node kind discriminant: `kind` string**
Every AST node carries a `kind` field. Already implemented. Verify consistency with spec.

**Existing AST review scope**
The current implementation includes: `common.ts` (SourceLocation, FieldPath, TypePath, RodType, NodeBase), `types.ts` (TypeRecord, TypeEnum, TypeUnion, NarrowedUnion), `values.ts` (ValueExpr union: literals, EnvRef, SecretRef, SourceRef, TypePathValue), `expressions.ts` (all expression AST nodes), `access.ts` (AccessContext, Principal, Intent, Scope, AuthzResult), `panel.ts` (Panel, Rod, SnapEdge, DpMetadata, OpsConfig, ResolvedContext). Review each against the spec and fix any gaps.

**Conformance fixtures scope: grant-workflow P0 domain model**
Five fixtures covering: (1) a `@type` record, (2) a `@type` enum, (3) a `@type` union, (4) a `@panel` with a single rod, (5) a full P0 domain model. Using `@type` keyword per spec grammar.

**AST-spec sync enforcement: convention for v0.6.0, hard gate at v1.0**
Per `governance/CROSS_REPO.md`: any PR touching `type-system.md` must link an AST PR.

## Risks / Trade-offs

**[Risk] AST was generated against an earlier spec snapshot and may have drift**
-> Mitigation: Explicit review task comparing each file against current spec. Any delta is fixed in this change.

**[Risk] Conformance fixtures encode assumptions that the parser will contradict**
-> Mitigation: Fixtures are intentionally minimal. Extended alongside the parser.

**[Risk] pnpm workspace version management friction**
-> Mitigation: All packages share root `tsconfig.base.json` and single `vitest.workspace.ts`. Package versions are `0.0.0` in dev.

## Open Questions

- Should `AccessContext` be an AST node or a decorator attached to Panel? The spec treats it as a first-class `@access` block — model it as a child of `Panel`.
- Do expression nodes belong in `packages/ast/` or a separate `packages/expressions/`? Decision: keep in `packages/ast/` — current implementation has them in `expressions.ts` at ~440 lines, which is manageable.
