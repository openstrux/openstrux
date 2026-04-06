## MODIFIED Requirements

### Requirement: strux build emits a package-shaped artifact
The `strux build` command SHALL read `strux.config.yaml`, resolve adapters, parse all `.strux` files, validate the AST, and emit a self-contained package-shaped directory at the configured output path (default: `.openstrux/build/`).

#### Scenario: Successful build produces output directory
- **WHEN** `strux build` is run in a project with valid `strux.config.yaml` and `.strux` files
- **THEN** the output directory SHALL contain generated source files, barrel exports, and package metadata (`package.json`, `tsconfig.json`)

#### Scenario: Build output package.json has correct name
- **WHEN** `strux build` completes successfully
- **THEN** the generated `package.json` SHALL have `name: "@openstrux/build"`

#### Scenario: Build replaces entire output directory
- **WHEN** `strux build` is run and the output directory already exists
- **THEN** the entire output directory SHALL be replaced with the new build output

#### Scenario: Build fails on missing config
- **WHEN** `strux build` is run in a project without `strux.config.yaml`
- **THEN** the command SHALL exit with code 1 and report a config error

#### Scenario: Build fails on invalid strux files
- **WHEN** `strux build` is run and `.strux` files contain parse or validation errors
- **THEN** the command SHALL exit with code 1 and display diagnostics with file locations

#### Scenario: No matching source files — warn and no-op
- **WHEN** `strux build` is run and no `.strux` files match the configured source globs
- **THEN** the command SHALL emit a warning and return without creating the output directory
