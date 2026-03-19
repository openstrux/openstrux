## Why

The toolchain is complete but untested on a real use case. The grant-workflow demo is the proof that Openstrux works end-to-end. More than a simple demo script, this change prepares a starter repository (`openstrux-uc-grant-workflow`) that supports side-by-side comparison of direct prompt-driven generation vs Openstrux-assisted generation, per the use-case requirements (§1, §8.6, §8.13).

## What Changes

### Starter repository (`openstrux-uc-grant-workflow`)

The repository is initialized with three **archived changes** (already completed):

1. **Frontend (archived)**: A completed Next.js frontend calling predefined service interfaces. The UI is functional — forms, navigation, workflow screens per `UseCaseRequirements.md`. This is the starting point that both generation paths build on.

2. **Backend generation (defined, not archived)**: The change to generate the backend. This is the task that both generation paths execute — one via direct TS prompts, one via `.strux` panels compiled to TS.

3. **Tests (archived)**: Unit and integration tests (vitest) for the domain model, policies, and service interfaces. Pre-written so both paths are tested against the same acceptance criteria.

### Prompts folder

Two prompt sets in `prompts/`:
- `prompts/baseline/` — "Apply this change using Next.js + Prisma directly"
- `prompts/openstrux/` — "Apply this change using `.strux` panels, then compile to TypeScript" with links to strux documentation in the openstrux-spec and openstrux-core repos

### Scripts

- `scripts/save-result.sh` — Zips the generated backend files, creates a benchmark entry JSON, asks for manual input (LLM used, manual test results, global result note, feedback), stores all in `results/`
- `scripts/reset.sh` — Restores the repo to initial state (frontend + tests, no backend) for a new test run
- `scripts/view-results.sh` — Starts a local dev server for the results viewer

### Results viewer

A simple page already implemented in the frontend that navigates between benchmark results stored in `results/`. Shows per-run: LLM, tokens, time, test pass rate, notes.

## Capabilities

### New Capabilities

- `grant-workflow-starter-repo`: Initialized repository with archived frontend + tests, defined backend change, two prompt sets, and automation scripts
- `grant-workflow-demo`: End-to-end demonstration in `openstrux/demos/grant-workflow/`

### Modified Capabilities

_(none)_

## Impact

- **openstrux-uc-grant-workflow**: New repo with full starter structure, archived changes, prompts, scripts, results viewer
- **openstrux** (hub): New `demos/grant-workflow/` with README and run.sh
- **No changes** to openstrux-core or openstrux-spec
