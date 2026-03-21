## Why

The current TypeScript target adapter emits loose files directly into the user's project tree with `// do not edit` headers — a convention with no structural enforcement. Regeneration risks overwriting hand-written code, and rod implementations are stubs with TODO comments despite the `.strux` source containing all information needed for complete implementations. ADR-019 establishes that generated output must be a self-contained, importable package and that rod implementations must be fully generated. This change implements that decision across specs and code.

## What Changes

- **BREAKING** Generator output changes from loose files to a package-shaped build artifact in a repo-owned directory (`.openstrux/build/`), with stable imports via `tsconfig.json` path aliases
- **BREAKING** `target: "typescript"` replaced with config-driven target selection using npm-style semver ranges (`framework: next@^15.0`, `orm: prisma@^6.0`, etc.)
- **BREAKING** Rod emitters produce complete implementations instead of TODO stubs — the generated package is immediately usable without hand-editing
- **BREAKING** Target adapter renamed from `target-ts` / `typescript` to framework-specific identifiers (`nextjs`, `nestjs`)
- New `strux build` command replaces the generation step, emitting a complete package artifact
- New `strux init` command with project auto-detection, config generation, starter `.strux` file, and immediate build
- New `strux doctor` command validates config against available adapters
- Target adapter interface extended with `package()` method for ecosystem-native packaging
- Config format: `strux.config.yaml` with semver-ranged dependency declarations
- Adapter manifests declare compatibility ranges (like npm peerDependencies)

## Capabilities

### New Capabilities
- `build-command`: The `strux build` CLI command — parses, validates, resolves adapters, emits native package. Replaces the generation step with a complete build pipeline.
- `init-command`: The `strux init` CLI command — detects installed stack from project (package.json, etc.), writes `strux.config.yaml`, configures `tsconfig.json` path aliases, creates starter `.strux` file, runs initial build. Zero-gap onboarding.
- `target-config`: Config-driven target selection via `strux.config.yaml` — framework, ORM, validation, and runtime as npm-style package@semver entries. Adapter resolution from config ranges to pinned versions in `snap.lock`.
- `adapter-packaging`: Target adapter packaging profile — each adapter defines how to emit a package-shaped artifact for its ecosystem (output directory, metadata files, entrypoints).
- `adapter-discovery`: CLI commands for adapter ecosystem discovery — `strux doctor` (validate config), `strux adapters list` (browse available), `strux adapters check` (test combinations).

### Modified Capabilities
- `generator`: Generator interface changes from `generate()` returning loose files to `build()` orchestrating parse → validate → resolve → emit → package. Target selection moves from a simple string to config-resolved adapter set.
- `target-adapter-ts`: Renamed to framework-specific adapters (nextjs, nestjs). Output paths change from project-relative (`types/`, `app/api/`) to package-relative (`.openstrux/build/`). Rod emitters produce complete implementations, not stubs.

## Impact

- **openstrux-spec**: Generator spec, target-ts specs (generator.md, rods.md), RFC-0001 all need updates. Golden conformance fixtures need new output paths and package structure.
- **openstrux-core**: Generator engine, TypeScript adapter, all rod emitters, CLI commands. New `build`, `init`, `doctor` commands. New config parser for `strux.config.yaml`. Adapter interface extended with `package()`.
- **openstrux (hub)**: Adapter manifest format for compatibility ranges. Discovery/listing infrastructure.
- **Downstream consumers**: Any project using the current generator must migrate to `strux.config.yaml` + `strux build`. Import paths change from relative to `@openstrux/build`.
