## ADDED Requirements

### Requirement: Monorepo builds from root with a single command
The `openstrux-core` repository SHALL be a pnpm workspace. Running `pnpm build` at the repo root SHALL compile all packages in dependency order.

#### Scenario: Root build succeeds with no packages changed
- **WHEN** `pnpm build` is run on a clean checkout
- **THEN** all packages SHALL compile without errors and emit declaration files to their `dist/` directories

#### Scenario: Build is incremental via turbo
- **WHEN** `pnpm build` is run after only `packages/ast/` has changed
- **THEN** turbo SHALL rebuild only `packages/ast/` and any packages that depend on it; unchanged packages SHALL be served from cache

### Requirement: Tests run from root with a single command
Running `pnpm test` at the repo root SHALL execute all package test suites via vitest.

#### Scenario: All tests pass on clean checkout
- **WHEN** `pnpm test` is run on a clean checkout with no source changes
- **THEN** all test suites SHALL pass with exit code 0

#### Scenario: Test run is scoped per package
- **WHEN** `pnpm test --filter packages/ast` is run
- **THEN** only the `packages/ast/` test suite SHALL execute

### Requirement: TypeScript compilation is strict
The root `tsconfig.base.json` SHALL enable `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true`. All packages SHALL extend from this base.

#### Scenario: Implicit any is rejected
- **WHEN** a source file contains an untyped parameter
- **THEN** TypeScript compilation SHALL fail with a type error
