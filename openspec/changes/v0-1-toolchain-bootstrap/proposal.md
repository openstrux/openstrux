## Why

Openstrux-core has zero implementation code — all six packages are empty stubs. Before any parsing, validation, or target generation can happen, the monorepo needs a working build system and a typed AST that mirrors the v0.4-draft spec. Without this foundation, every downstream package (parser, validator, generator) has nothing to build on. This must land by 2026-03-20 to keep the v0.1 delivery on track.

## What Changes

- Add pnpm workspace configuration, root `tsconfig.json`, vitest, and a build runner (turbo) to `openstrux-core`
- Implement `packages/ast/` with TypeScript interfaces for every AST node type defined in `openstrux-spec/specs/core/type-system.md`
- Write five valid `.strux` conformance fixtures in `openstrux-spec/conformance/valid/` covering the constructs needed for the grant-workflow P0 domain model

## Capabilities

### New Capabilities

- `core-ast`: Typed TypeScript AST node interfaces (StruxRecord, StruxEnum, StruxUnion, Panel, Rod, Knot, TypePath, AccessContext) mirroring the v0.4-draft type system
- `monorepo-toolchain`: pnpm workspace, tsconfig, vitest, turbo build pipeline for openstrux-core
- `conformance-fixtures-p0`: Five valid `.strux` fixtures for grant-workflow P0 domain model constructs (record, enum, union, panel + rod, AccessContext)

### Modified Capabilities

_(none — no existing specs affected)_

## Impact

- **openstrux-core**: New monorepo configuration files at repo root; `packages/ast/` goes from stub README to full TypeScript source
- **openstrux-spec**: Five new files under `conformance/valid/`
- **Downstream changes**: `packages/parser/`, `packages/validator/`, `packages/manifest/` all import from `packages/ast/` — this change unblocks all of them
- **No breaking changes** — nothing is implemented yet to break
