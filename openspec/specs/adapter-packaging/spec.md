## ADDED Requirements

### Requirement: Adapter interface includes a package method
Every adapter SHALL implement both `emit()` and `package()` methods. `emit()` produces generated source files. `package()` produces ecosystem-native package metadata and entrypoints.

#### Scenario: Adapter produces package output
- **WHEN** `adapter.package(files)` is called with generated files
- **THEN** the result SHALL include `outputDir`, `metadata` (package.json, tsconfig.json), and `entrypoints` (barrel exports)

### Requirement: Package output is self-contained
The package output directory SHALL be self-contained: all generated files, metadata, and entrypoints SHALL be within the output directory. No generated file SHALL reference paths outside the output directory.

#### Scenario: All imports are internal
- **WHEN** the package output is examined
- **THEN** no generated file SHALL import from a path outside the output directory (external npm dependencies like `zod`, `next`, `prisma` are allowed)

### Requirement: Package includes barrel exports
The package output SHALL include barrel export files (e.g., `index.ts`) that re-export all public types, schemas, and handlers.

#### Scenario: Root barrel exports types and schemas
- **WHEN** the package contains types `Proposal` and `ReviewStatus`
- **THEN** `index.ts` SHALL re-export both types

#### Scenario: Sub-path exports for categories
- **WHEN** the package contains schemas and handlers
- **THEN** `schemas/index.ts` and `handlers/index.ts` SHALL provide category-level barrel exports

### Requirement: Adapter declares compatibility ranges
Each adapter SHALL declare its compatibility range in a manifest, specifying which framework versions, ORMs, validation libraries, and runtimes it supports.

#### Scenario: Adapter manifest lists supported versions
- **WHEN** an adapter manifest is read
- **THEN** it SHALL contain a `supports` section with semver ranges for each dependency category

#### Scenario: Adapter rejects incompatible config
- **WHEN** an adapter's compatibility range does not intersect the config's requested range
- **THEN** the adapter SHALL NOT be selected during resolution
