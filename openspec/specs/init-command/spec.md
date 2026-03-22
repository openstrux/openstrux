## ADDED Requirements

### Requirement: strux init detects the project stack
`strux init` SHALL read the project's `package.json` to detect installed framework, ORM, validation library, TypeScript version, and runtime.

#### Scenario: Detecting a Next.js + Prisma + Zod stack
- **WHEN** `strux init` is run in a project with `next@15.1.2`, `prisma@6.1.0`, `zod@3.23.8`, and `typescript@5.5.4` in `package.json` dependencies
- **THEN** the detected stack SHALL be presented to the user for confirmation

#### Scenario: No recognized framework detected
- **WHEN** `strux init` is run in a project without a recognized framework in `package.json`
- **THEN** the command SHALL present an interactive selection of supported frameworks

### Requirement: strux init writes strux.config.yaml
After stack confirmation, `strux init` SHALL write a `strux.config.yaml` file with the detected or selected stack using npm-style semver ranges.

#### Scenario: Config written with detected versions
- **WHEN** the user confirms the detected stack
- **THEN** `strux.config.yaml` SHALL contain `target` entries with semver ranges matching the detected major versions

#### Scenario: Config not overwritten if it exists
- **WHEN** `strux init` is run and `strux.config.yaml` already exists
- **THEN** the command SHALL ask the user whether to overwrite or keep the existing config

### Requirement: strux init configures tsconfig.json path aliases
For TypeScript targets, `strux init` SHALL add path aliases to `tsconfig.json` so that `@openstrux/build` resolves to the output directory.

#### Scenario: Path aliases added to existing tsconfig
- **WHEN** `strux init` runs and `tsconfig.json` exists
- **THEN** `compilerOptions.paths` SHALL include `@openstrux/build` and `@openstrux/build/*` entries pointing to the output directory

#### Scenario: Existing paths preserved
- **WHEN** `tsconfig.json` already has a `paths` section with other aliases
- **THEN** `strux init` SHALL add the `@openstrux/build` entries without removing existing paths

### Requirement: strux init adds output directory to .gitignore
`strux init` SHALL add `.openstrux/` to `.gitignore` if not already present.

#### Scenario: Gitignore updated
- **WHEN** `strux init` runs and `.gitignore` exists but does not contain `.openstrux/`
- **THEN** `.openstrux/` SHALL be appended to `.gitignore`

### Requirement: strux init creates a starter .strux file
`strux init` SHALL create a minimal, valid `.strux` file that demonstrates a working type definition.

#### Scenario: Starter file created
- **WHEN** `strux init` completes
- **THEN** a `.strux` file SHALL exist at a conventional location (e.g., `src/strux/starter.strux`) containing at least one `@type` definition

### Requirement: strux init runs strux build
After writing config, paths, and starter file, `strux init` SHALL run `strux build` so that imports resolve immediately.

#### Scenario: Build runs automatically
- **WHEN** `strux init` completes all setup steps
- **THEN** `strux build` SHALL have been executed and the output directory SHALL contain generated files

#### Scenario: IDE autocomplete works immediately
- **WHEN** `strux init` completes and the user opens their IDE
- **THEN** `import { ... } from "@openstrux/build"` SHALL resolve to the generated types with full autocomplete
