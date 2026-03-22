## ADDED Requirements

### Requirement: strux build emits a package-shaped artifact
The `strux build` command SHALL read `strux.config.yaml`, resolve adapters, parse all `.strux` files, validate the AST, and emit a self-contained package-shaped directory at the configured output path (default: `.openstrux/build/`).

#### Scenario: Successful build produces output directory
- **WHEN** `strux build` is run in a project with valid `strux.config.yaml` and `.strux` files
- **THEN** the output directory SHALL contain generated source files, barrel exports, and package metadata (`package.json`, `tsconfig.json`)

#### Scenario: Build replaces entire output directory
- **WHEN** `strux build` is run and the output directory already exists
- **THEN** the entire output directory SHALL be replaced with the new build output

#### Scenario: Build fails on missing config
- **WHEN** `strux build` is run in a project without `strux.config.yaml`
- **THEN** the command SHALL exit with error and suggest running `strux init`

#### Scenario: Build fails on invalid strux files
- **WHEN** `strux build` is run and `.strux` files contain parse or validation errors
- **THEN** the command SHALL exit with error and display diagnostics with file locations

### Requirement: strux build output is deterministic
Same `.strux` source files plus same `snap.lock` SHALL produce identical output on every build, per ADR-000.

#### Scenario: Repeated builds produce identical output
- **WHEN** `strux build` is run twice with no source changes
- **THEN** the output directory contents SHALL be byte-identical

### Requirement: strux build runs adapter post-build hooks
After writing the package output, `strux build` SHALL run any post-build hook declared by the adapter (e.g., `prisma generate` for the Prisma adapter).

#### Scenario: Post-build hook executes after output
- **WHEN** `strux build` completes and the adapter declares a post-build hook
- **THEN** the hook command SHALL be executed after all files are written

#### Scenario: Post-build hook failure is reported
- **WHEN** a post-build hook exits with a non-zero status
- **THEN** `strux build` SHALL report the hook failure but SHALL NOT delete the generated output
