## ADDED Requirements

### Requirement: esbuild single-file bundle
The `@openstrux/cli` package SHALL be bundleable into a single standalone `.mjs` file using esbuild, with all workspace dependencies inlined and zero external runtime dependencies.

#### Scenario: Bundle produces standalone file
- **WHEN** the `bundle` script in `packages/cli/package.json` is executed
- **THEN** `packages/cli/dist/strux-standalone.mjs` is created as a single ESM file with a `#!/usr/bin/env node` shebang

#### Scenario: Bundle is self-contained
- **WHEN** `strux-standalone.mjs` is copied to an empty directory with only a Node.js runtime
- **THEN** `node strux-standalone.mjs build` executes without import errors (given a valid `strux.config.yaml` and `.strux` files)

#### Scenario: Bundle produces identical output to workspace CLI
- **WHEN** `node strux-standalone.mjs build` is run against a project with `.strux` files
- **THEN** the output in `.openstrux/build/` is identical to what `node packages/cli/dist/bin.js build` produces

### Requirement: Bundle script in package.json
The `packages/cli/package.json` SHALL contain a `"bundle"` script that invokes esbuild with the correct entry point, platform, and format settings.

#### Scenario: Script exists and runs
- **WHEN** `pnpm --filter @openstrux/cli run bundle` is executed in the openstrux-core monorepo
- **THEN** it completes with exit code 0 and produces `dist/strux-standalone.mjs`

### Requirement: esbuild as root devDependency
The openstrux-core root `package.json` SHALL include `esbuild` as a devDependency.

#### Scenario: esbuild available after install
- **WHEN** `pnpm install` is run at the openstrux-core root
- **THEN** `npx esbuild --version` exits 0
