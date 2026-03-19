## ADDED Requirements

### Requirement: Generator accepts a validated AST and returns generated files
The generator SHALL expose a `generate(ast: StruxNode[], manifest: Manifest, options: GenerateOptions): GeneratedFile[]` function. It SHALL select a target adapter from the registry based on `options.target`.

#### Scenario: TypeScript target produces files
- **WHEN** `generate(ast, manifest, { target: "typescript" })` is called with a valid P0 domain model AST
- **THEN** the result SHALL be a non-empty array of `GeneratedFile` with `path`, `content`, and `lang` fields

#### Scenario: Unknown target throws
- **WHEN** `generate(ast, manifest, { target: "unknown" })` is called
- **THEN** the function SHALL throw `UnknownTargetError` with the target name in the message

### Requirement: Adapter contract is stable across target implementations
Every adapter SHALL implement `Adapter.generate(ast, manifest, options): GeneratedFile[]`. The generator engine SHALL not inspect adapter internals beyond this interface.

#### Scenario: Custom adapter can be registered
- **WHEN** `registerAdapter("my-target", myAdapter)` is called before `generate()`
- **THEN** `generate(ast, manifest, { target: "my-target" })` SHALL delegate to `myAdapter.generate()`
