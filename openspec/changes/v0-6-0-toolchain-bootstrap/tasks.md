## 1. Monorepo setup (openstrux-core)

- [ ] 1.1 Add `pnpm-workspace.yaml` listing all six packages
- [ ] 1.2 Add root `package.json` with `build`, `test`, `lint` scripts using turbo
- [ ] 1.3 Add `turbo.json` pipeline: `build` depends on upstream `build`; `test` depends on local `build`
- [ ] 1.4 Add `tsconfig.base.json` at repo root with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- [ ] 1.5 Add per-package `tsconfig.json` extending base in each of the six packages
- [ ] 1.6 Add root `vitest.workspace.ts` referencing all packages
- [ ] 1.7 Run `pnpm build` from root — confirm clean compile with zero errors

## 2. AST review and evolution (openstrux-core/packages/ast)

- [ ] 2.1 Review `common.ts` against spec: verify `SourceLocation`, `SourceSpan`, `NodeBase`, `FieldPath`, `TypePath`, `RodType` (18 basic types), `KnotDir`, `PrimitiveTypeName`, `ContainerKind` — fix any drift
- [ ] 2.2 Review `types.ts` against `type-system.md`: verify `TypeRecord`, `TypeEnum`, `TypeUnion`, `NarrowedUnion`, `TypeExpr`, `FieldDecl` — ensure `@type` keyword alignment in documentation
- [ ] 2.3 Review `values.ts` against `grammar.md §6`: verify `ValueExpr` union (LitString, LitNumber, LitBool, LitNull, EnvRef, SecretRef, SourceRef, TypePathValue, ArrayValue, ObjectValue, ExpressionValue) — add any missing value forms
- [ ] 2.4 Review `expressions.ts` against `expression-shorthand.md`: verify all 8 expression types (filter, projection, aggregation, group key, join condition, sort, split routes, guard policy) — add any missing expression nodes
- [ ] 2.5 Review `access.ts` against `access-context.strux`: verify `AccessContext`, `Principal`, `Intent`, `Scope`, `AuthzResult` — add any missing fields (e.g., `TimeWindow`, `ResourceGrant`)
- [ ] 2.6 Review `panel.ts` against `ir.md` and `panel-shorthand.md`: verify `Panel`, `Rod`, `SnapEdge`, `DpMetadata`, `OpsConfig`, `CertMetadata`, `ResolvedContext` — add any missing panel-level metadata
- [ ] 2.7 Review `index.ts` barrel exports — ensure all types are exported, `SourceFile` includes `types` and `panels`
- [ ] 2.8 Document any additions or changes in `packages/ast/CHANGELOG.md`
- [ ] 2.9 Run `pnpm build --filter @openstrux/ast` — confirm clean compile
- [ ] 2.10 Write one smoke test in `packages/ast/src/__tests__/` asserting all node kinds are present in type system

## 3. Conformance fixtures (openstrux-spec/conformance/valid)

- [ ] 3.1 Write `p0-record.strux` — a `@type Proposal` record with 4-6 typed fields
- [ ] 3.2 Write `p0-enum.strux` — a `@type ReviewStatus` enum with 4 variants
- [ ] 3.3 Write `p0-union.strux` — a `@type DataSource` union with stream/db variants
- [ ] 3.4 Write `p0-panel-rod.strux` — a minimal `@panel` with one `receive` rod and an `@access` block
- [ ] 3.5 Write `p0-domain-model.strux` — full P0 model combining all types above in one file
- [ ] 3.6 Mirror all five fixtures into `openstrux-core/tests/fixtures/valid/` (copy, do not symlink)
- [ ] 3.7 Verify fixtures are syntactically well-formed by manual review against `syntax-reference.md` and `grammar.md` — confirm `@type` keyword usage
- [ ] 3.8 Create placeholder files for ADR-011 conformance fixtures in `openstrux-spec/conformance/` with `-- TODO: authored in v0-6-0-validator-config` header
- [ ] 3.9 Create placeholder files for config inheritance conformance fixtures
