## Why

Openstrux-core has partial implementation — `packages/ast/` contains v0.5.0-alpha.0 typed AST/IR definitions (7 source files, ~1,150 lines), but the monorepo has no build system, no test runner, and no conformance fixtures. The remaining five packages (parser, validator, manifest, lock, conformance) are empty stubs. Before any parsing, validation, or target generation can happen, the monorepo needs a working build system and the existing AST must be reviewed against the current v0.5.0 spec and evolved where needed.

## What Changes

- Add pnpm workspace configuration, root `tsconfig.json`, vitest, and a build runner (turbo) to `openstrux-core`
- **Review and evolve** the existing `packages/ast/` implementation against `openstrux-spec@0.5.0`:
  - Verify all node types in `common.ts`, `types.ts`, `values.ts`, `expressions.ts`, `access.ts`, `panel.ts` match the current spec
  - Add any missing node types or fields introduced since the initial AST generation
  - Ensure `@type` keyword alignment (the grammar uses `@type` for record/enum/union definitions)
  - Verify the `SourceFile` top-level container includes all required fields
- Write five valid `.strux` conformance fixtures in `openstrux-spec/conformance/valid/` covering the constructs needed for the grant-workflow P0 domain model

## Capabilities

### New Capabilities

- `monorepo-toolchain`: pnpm workspace, tsconfig, vitest, turbo build pipeline for openstrux-core
- `conformance-fixtures-p0`: Five valid `.strux` fixtures for grant-workflow P0 domain model constructs (record, enum, union, panel + rod, AccessContext)

### Modified Capabilities

- `core-ast`: Review and evolve existing v0.5.0-alpha.0 AST interfaces against current spec — add missing nodes, fix drift, ensure `@type` keyword alignment

## Impact

- **openstrux-core**: New monorepo configuration files at repo root; `packages/ast/` reviewed and updated to match v0.5.0 spec
- **openstrux-spec**: Five new files under `conformance/valid/`
- **Downstream changes**: All packages import from `packages/ast/` — this change unblocks all of them
- **No breaking changes** — AST is types-only and downstream consumers don't exist yet
