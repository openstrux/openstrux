## ADDED Requirements

### Requirement: strux.config.yaml defines the target stack
The project's target stack SHALL be declared in `strux.config.yaml` at the project root, using npm-style package names with semver ranges.

#### Scenario: Valid config with all target fields
- **WHEN** `strux.config.yaml` contains:
  ```yaml
  target:
    base: typescript@~5.5
    framework: next@^15.0
    orm: prisma@^6.0
    validation: zod@^3.23
    runtime: node@>=20
  ```
- **THEN** the config parser SHALL resolve each entry to a package name and semver range

#### Scenario: Missing required field
- **WHEN** `strux.config.yaml` has a `target` section without a `framework` entry
- **THEN** the config parser SHALL report an error identifying the missing field

### Requirement: Config ranges resolve to adapter versions
Each dependency range in `strux.config.yaml` SHALL be resolved against available adapter compatibility manifests. Resolved versions SHALL be pinned in `snap.lock`.

#### Scenario: Successful resolution
- **WHEN** config declares `framework: next@^15.0` and an adapter exists with `supports.framework: next@>=14.0 <17.0`
- **THEN** the adapter SHALL be selected and its version pinned in `snap.lock`

#### Scenario: No compatible adapter
- **WHEN** config declares `framework: next@^16.0` and no adapter supports that range
- **THEN** resolution SHALL fail with a diagnostic naming the unsupported dependency and suggesting the closest available range

### Requirement: Resolved config is locked in snap.lock
After resolution, the exact adapter versions and dependency versions SHALL be recorded in `snap.lock` under an `adapters` section.

#### Scenario: Lock file records adapter versions
- **WHEN** `strux build` resolves adapters successfully
- **THEN** `snap.lock` SHALL contain the exact resolved version for each target dependency and each adapter brick
