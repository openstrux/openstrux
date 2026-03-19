## Context

The grant-workflow use case (NLnet MVP) has six phases (P0-P6). For v0.6.0 the demo covers P0-P2 via the toolchain, but the starter repository must be structured for the full comparison model described in `UseCaseRequirements.md` (§1, §8.6, §8.13): same initialized repository, same task set, two execution paths.

The demo has three audiences:
1. **Funders/reviewers (NLnet)** — want clarity + proof that the approach works
2. **Developers** — want to clone, run, and see results
3. **Benchmarkers** — want reproducible side-by-side comparison data

## Goals / Non-Goals

**Goals:**
- Starter repository with pre-built frontend (Next.js) calling predefined service interfaces
- Pre-written unit + integration tests (vitest) as acceptance criteria
- Backend generation change defined but not executed — this is what the two paths implement
- Two prompt sets: baseline (direct Next.js + Prisma) and openstrux (`.strux` -> compile -> TS)
- Scripts: `save-result.sh` (zip + benchmark JSON + manual input), `reset.sh` (restore initial state), `view-results.sh` (start results viewer)
- Results viewer page in the frontend for navigating comparison data
- `.strux` source files for P0-P2 demonstrating context cascade + shorthand panels

**Non-Goals:**
- P3-P6 implementation (deferred to v0.7.0)
- Automated test execution as part of the generation benchmark (tests are run manually)
- Production deployment

## Decisions

**Starter repo structure follows `UseCaseRequirements.md` §8.7**
```
openstrux-uc-grant-workflow/
  docs/
  specs/                    # Domain model, workflow states, access policies
  prompts/
    shared/                 # Common system prompt and constraints
    baseline/               # Per-phase prompts for direct TS generation
    openstrux/              # Per-phase prompts for .strux generation
  openspec/
    changes/
      frontend/             # Archived: completed Next.js frontend
      backend-generation/   # Defined: the task both paths execute
      tests/                # Archived: vitest unit + integration tests
  app/web/                  # Next.js app (frontend pre-built)
  packages/
    domain/                 # Typed entities and value objects
    policies/               # Eligibility, access, retention, workflow rules
  prisma/
  tests/
    unit/
    integration/
  results/                  # Benchmark run outputs (JSON + zips)
  scripts/
    save-result.sh
    reset.sh
    view-results.sh
  output/
    baseline/               # Generated files from direct-TS path
    openstrux/              # Generated files from .strux path
```

**Frontend is pre-built, not generated**
The frontend (forms, navigation, workflow screens) is already implemented as an archived change. This ensures both generation paths start from the same UI baseline and only differ in backend implementation.

**Tests are pre-written, not generated**
Unit and integration tests are an archived change. They define the acceptance criteria that both generated backends must pass. This makes the comparison fair.

**save-result.sh workflow**
1. Zips all files in `output/<path>/` (where path is `baseline` or `openstrux`)
2. Creates `results/<date>-<path>/benchmark.json` with auto-populated fields: `timestamp`, `generatedFileCount`, `totalLines`
3. Prompts operator for: `llm` (model used), `manualTestResults` (pass/fail summary), `resultNote` (overall assessment), `feedback` (free text)
4. Stores zip + JSON in `results/`

**reset.sh restores initial state**
Uses `git checkout` to restore the repo to the state after frontend + tests changes but before any backend generation. Clears `output/baseline/` and `output/openstrux/`.

**Results viewer is a simple frontend page**
A `/results` page in the Next.js app that reads `results/*/benchmark.json` files and displays a table: date, path (baseline/openstrux), LLM, token counts, time, test results, notes. Sortable and filterable. Already implemented as part of the frontend archived change.

**Token optimization: context cascade + shorthand panels**
The `.strux` source files follow the token-efficient pattern:
- Root `strux.context` for project-wide defaults (controller, DPO, common policies, named infrastructure)
- Domain-level `strux.context` for narrower access scope and domain-specific sources/targets
- One small panel per use case, declaring only the delta from context
- Named references instead of repeated inline config
- Shorthand syntax with implicit chaining

## Risks / Trade-offs

**[Risk] Token compression ratio may exceed 0.25 target**
-> Mitigation: Record actual ratio. The target applies to the full benchmark run, not the demo alone.

**[Risk] Generated TypeScript may not compile cleanly due to raw-expr gaps**
-> Mitigation: P0-P2 `.strux` files avoid complex expressions.

**[Risk] Frontend archived change is large and may drift**
-> Mitigation: Frontend is frozen once archived. Backend generation does not modify frontend files.

## Open Questions

- Should `run.sh` require openstrux-core to be built first? Decision: yes — `cd ../openstrux-core && pnpm build`. No binary distribution for v0.6.0.
