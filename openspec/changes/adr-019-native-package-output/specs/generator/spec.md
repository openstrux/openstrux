## MODIFIED Requirements

### Requirement: Generator accepts a validated AST and returns generated files
The generator SHALL expose a `generate(ast: TopLevelNode[], manifest: Manifest, options: ResolvedOptions): GeneratedFile[]` function. It SHALL resolve the target adapter set from `options` (which contains resolved framework, ORM, validation, and runtime dependencies) rather than a single `target` string.

#### Scenario: Next.js target produces files
- **WHEN** `generate(ast, manifest, resolvedOptions)` is called with resolved options containing `framework: { name: "next", version: "15.1.2" }`
- **THEN** the result SHALL be a non-empty array of `GeneratedFile` with `path`, `content`, and `lang` fields

#### Scenario: Unknown framework throws
- **WHEN** `generate(ast, manifest, resolvedOptions)` is called with a framework name that has no registered adapter
- **THEN** the function SHALL throw `UnknownTargetError` with the framework name in the message

### Requirement: Adapter contract is stable across target implementations
Every adapter SHALL implement `Adapter.emit(ast, manifest, options): GeneratedFile[]` and `Adapter.package(files): PackageOutput`. The generator engine SHALL NOT inspect adapter internals beyond this interface.

#### Scenario: Custom adapter can be registered
- **WHEN** `registerAdapter("my-target", myAdapter)` is called before `generate()`
- **THEN** `generate(ast, manifest, resolvedOptions)` SHALL delegate to `myAdapter.emit()` when the framework name matches

### Requirement: Generator output paths are package-relative
All `GeneratedFile.path` values returned by the generator SHALL be relative to the package output directory, not the consumer project root.

#### Scenario: Type file path is package-relative
- **WHEN** the generator emits a type file for `@type Proposal`
- **THEN** the `GeneratedFile.path` SHALL be `types/Proposal.ts`, not `src/types/Proposal.ts` or an absolute path

## ADDED Requirements

### Requirement: Generator orchestrates the full build pipeline
The `strux build` command SHALL orchestrate: config parsing → adapter resolution → `.strux` parsing → validation → `adapter.emit()` → `adapter.package()` → filesystem write.

#### Scenario: Build pipeline runs end to end
- **WHEN** `strux build` is invoked with valid config, valid `.strux` files, and a compatible adapter
- **THEN** the output directory SHALL contain all generated files plus package metadata and barrel exports

### Requirement: Generator resolves config to adapter set
The generator SHALL read `strux.config.yaml`, resolve each dependency range against adapter manifests, and pass the resolved options to the adapter.

#### Scenario: Config resolution populates ResolvedOptions
- **WHEN** config contains `framework: next@^15.0` and adapter `adapter/nextjs@1.2.0` supports `next@>=14.0 <17.0`
- **THEN** `ResolvedOptions.framework` SHALL contain `{ name: "next", version: "15.1.2", adapter: "adapter/nextjs@1.2.0" }`
