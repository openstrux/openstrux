# Cross-Repo Coordination

This document defines how the Openstrux repos relate to each other, how changes propagate, and how use-case repos fit into the ecosystem. It is normative for all contributors and maintainers.

---

## Repo ecosystem

```
openstrux-spec          ← source of truth for the language
       │
       ▼
openstrux-core          ← implements the spec (parser, validator, AST/IR)
       │
       ▼
openstrux               ← hub: benchmark definitions, baselines, results, roadmap
       │
       ▼
openstrux-<usecase>     ← use-case repos (e.g. openstrux-uc-grant-workflow)
                           depend on core (optional, for the Openstrux path)
                           baseline path has no core dependency
```

Spec wins in all conflicts. Core never defines normative behaviour; it implements spec.
Use-case repos consume core; they do not contribute back to it.

---

## Version lock: `openstrux.repo.json`

Every repo in the ecosystem carries an `openstrux.repo.json` manifest. The `compatibility` field is the machine-readable version lock:

```json
// openstrux-core/openstrux.repo.json
{
  "name": "openstrux-core",
  "type": "core",
  "version": "0.4.0",
  "depends_on": ["openstrux-spec@0.4.x"],
  "compatibility": { "spec": "0.4.x" }
}

// openstrux-uc-grant-workflow/openstrux.repo.json
{
  "name": "openstrux-uc-grant-workflow",
  "type": "usecase",
  "version": "0.1.0",
  "usecase_id": "uc-grant-workflow",
  "depends_on": ["openstrux-core@0.4.x"],
  "execution_paths": ["baseline", "openstrux"],
  "compatibility": { "core": "0.4.x" }
}
```

When a dependency advances minor version, the consuming repo opens a tracking PR to update its `depends_on` and `compatibility` fields.

---

## Core dependency chain

### Fixture synchronisation (spec → core)

`openstrux-core/tests/fixtures/` mirrors `openstrux-spec/conformance/`. Two modes:

- **Local dev:** fixtures read directly from `../openstrux-spec/conformance/` (sibling path)
- **CI:** openstrux-spec is checked out at the pinned tag; fixtures are copied in as a pre-test step; a diff check fails CI if local copies diverge from the pinned tag

The `tests/fixtures/` mirror is never edited by hand — always sourced from spec.

### AST/IR sync

`openstrux-core/packages/ast/` must stay in sync with `openstrux-spec/specs/core/type-system.md`. Enforced by:

- PR convention: any spec type-system change must link a corresponding `openstrux-core` AST PR
- CI diff check (advisory in v0.4, hard gate at v1.0): compares AST node names against spec type definitions

### Spec change → core propagation

1. Spec RFC accepted; spec PR merges to `openstrux-spec/main`.
2. A GitHub Actions workflow in `openstrux-spec` opens a tracking issue in `openstrux-core` titled `[spec] <RFC title> — implementation required`, linking the spec PR and RFC number.
3. `openstrux-core` implementer opens a feature branch (in a worktree per `governance/BRANCHING.md`), implements against the new spec.
4. Conformance tests pass against the updated fixtures → `openstrux-core` PR merges.
5. `openstrux.repo.json` `compatibility.spec` updated if minor version advanced.
6. Both repos tagged in order: spec first, core after.

### Breaking spec changes

A breaking spec change invalidates existing valid fixtures or changes error codes for invalid fixtures. Breaking changes:

- Require an RFC (per `governance/RFC_PROCESS.md`)
- Bump the spec minor version (`0.4.x` → `0.5.x`)
- Require a `openstrux-core` PR that passes all conformance tests before spec is tagged
- Are announced in GitHub Release notes for both repos

### Cross-repo PR linking

PRs implementing a spec change must include:

```
Implements: openstrux-spec#<PR number>
RFC: RFC-NNNN
```

PRs in `openstrux-spec` that require core work must include:

```
Requires: openstrux-core#<issue or PR number>
```

---

## Use-case repos

### What they are

A use-case repo is a self-contained starter repository for demonstrating and benchmarking a specific application of Openstrux. It supports two execution paths over the same initialized repo and the same task set:

1. **Baseline path** — direct prompt-driven generation without Openstrux
2. **Openstrux path** — prompt-driven generation with an Openstrux layer added

Both paths use the same prompts, the same benchmark inputs, the same expected outputs, and the same measurement rules. This makes the results directly comparable.

### Naming and creation

- Naming: `openstrux-<usecase-id>` (e.g. `openstrux-uc-grant-workflow`)
- Use-case repos are initialized from the canonical use-case template (see below)
- Each use-case repo is independent; it is not a fork of another use-case repo

### Default structure

Every use-case repo follows this structure:

```
openstrux-<id>/
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  .gitignore
  .editorconfig
  .env.example
  openstrux.repo.json

  docs/                         Human-facing project documentation
  specs/                        Structured source-of-truth for this use case
  prompts/
    shared/                     Prompts common to both paths
    baseline/                   Prompts for direct generation (no Openstrux)
    openstrux/                  Prompts for Openstrux-assisted generation
  openspec/                     OpenSpec orchestration assets (if used)
  app/                          Running application code
  packages/                     Reusable typed business logic
  infra/                        Container and deployment configuration
  tests/
    unit/
    integration/
    e2e/
    fixtures/
  conformance/
    valid/
    invalid/
    golden/
  benchmark/
    cases/                      Benchmark case definitions (follow openstrux hub format)
    baselines/
      baseline/                 Hand-written reference for direct path
      openstrux/                Hand-written reference for Openstrux path
    runs/                       Dated run outputs
    scorecards/
  scripts/
    setup/
    generate/
    validate/
    benchmark/
    export/
    install-output.sh           Extracts and installs a zipped output locally
  output/
    baseline/                   Generated artifacts from direct path
    openstrux/                  Generated artifacts from Openstrux path
```

### Execution model

An execution run produces a set of generated artifacts for one path. After a run:

1. Generated files land in `output/baseline/` or `output/openstrux/`
2. A `manifest.json` is written alongside the artifacts recording:
   - execution path (`baseline` or `openstrux`)
   - run ID and timestamp
   - prompts used (file paths + content hashes)
   - openstrux-core version (Openstrux path only)
   - token counts per prompt
   - execution time
   - repair/no-repair status per task
   - final scorecard entry
3. The output directory is zipped: `output/<path>/<run-id>.zip`

### Output artifacts: zipped format

Output zips are the canonical shareable unit for a run result. They are:

- **Self-contained:** include all generated files and the `manifest.json`
- **Installable:** `scripts/install-output.sh <zip>` extracts to `output/<path>/installed/` and runs local validation
- **Comparable:** two zips from different paths (same run ID prefix) can be diffed using `scripts/benchmark/compare.sh`
- **Archived:** stored in `benchmark/runs/<YYYY-MM-DD>/` for traceability

Zips are committed to the repo only for official benchmark runs. Ad-hoc development runs are kept local (`.gitignore` covers `output/*/[^i]*`).

### Local install and test

Anyone can install and validate a published run result without re-running generation:

```sh
git clone https://github.com/openstrux/openstrux-uc-grant-workflow
cd openstrux-uc-grant-workflow
scripts/install-output.sh benchmark/runs/2026-03-19/output-baseline-2026-03-19.zip
scripts/install-output.sh benchmark/runs/2026-03-19/output-openstrux-2026-03-19.zip
# Runs local validation tests against installed outputs
npm test -- --filter=installed
```

### Benchmark integration with the hub

Use-case benchmark cases follow the same format as `openstrux/benchmarks/cases/` (per `docs/manifesto/MANIFESTO_BENCHMARKS.md §5`). After an official benchmark run:

1. Scorecards from `benchmark/scorecards/` are submitted to `openstrux/benchmarks/results/` via PR
2. The PR references the use-case repo, run ID, and both path results
3. The hub tracks cross-use-case comparison over time

### Relationship to openstrux-core

The Openstrux path requires `openstrux-core` at the pinned version in `openstrux.repo.json`. The baseline path has no dependency on openstrux-core and must run cleanly without it installed.

This separation is a hard constraint — it ensures the baseline path is a genuine independent comparison, not an Openstrux-assisted result with the Openstrux layer removed.

---

## Hub (`openstrux`) coordination

The hub owns benchmark definitions, baselines, and results — not code or spec content. After both spec and core are tagged:

1. Benchmark scorecard published to `openstrux/benchmarks/results/` via a PR from the core benchmark workflow
2. `docs/roadmap/` updated to reflect the released version
3. Use-case scorecard PRs reviewed and merged by a maintainer

No code or spec content ever lives permanently in `openstrux`.
