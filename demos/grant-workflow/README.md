# Grant Workflow Demo

End-to-end demonstration of the Openstrux grant-workflow use case. Compares two generation paths over the same baseline: direct TypeScript generation vs Openstrux-assisted generation.

## Prerequisites

- Node.js >= 20
- pnpm
- Sister repos cloned side-by-side:
  ```
  openstrux/                    # this repo (hub)
  openstrux-core/               # toolchain
  openstrux-spec/               # language spec (referenced by prompts)
  openstrux-uc-grant-workflow/  # use-case repo (baseline)
  ```

## How the comparison works

Both paths start from the same initialized repository (`openstrux-uc-grant-workflow`): pre-built frontend, pre-written tests, defined backend generation task. They differ only in how the backend is generated.

| Path | What the LLM does | Output |
|---|---|---|
| **Direct** | Reads specs, writes TypeScript directly | `output/direct/` |
| **Openstrux** | Reads specs + syntax-reference, writes `.strux`, runs `strux build` | `.openstrux/build/` + `output/openstrux/` |

## Running a benchmark

### 1. Reset to baseline

```bash
cd ../openstrux-uc-grant-workflow
scripts/reset.sh
```

### 2. Run a generation path

Feed the prompts to an LLM (in order):
```
prompts/shared/system.md
prompts/shared/constraints.md
prompts/shared/generate.md
prompts/<direct|openstrux>/generate.md
prompts/shared/task-format.md
```

### 3. Run tests

```bash
cd app/web && pnpm install
pnpm test
```

### 4. Save results

```bash
scripts/save-result.sh <direct|openstrux>
```

Archives generated files, snapshots prompts used (with version), and records benchmark metrics.

### 5. View results

```bash
scripts/view-results.sh
# Open http://localhost:3000/results
```

## Demo script

For the Openstrux path specifically, `run.sh` automates the toolchain build and compile step:

```bash
demos/grant-workflow/run.sh
```

This builds `openstrux-core`, runs `strux build --explain` on any `.strux` files present, and verifies TypeScript compilation.

## What to look for

- **Token efficiency**: how many tokens in `.strux` source vs equivalent TypeScript
- **Completeness**: do tests pass? what gaps did the LLM log?
- **Correctness**: identity separation, access policies, audit trails
- **Doc gaps**: what couldn't the LLM find in the language reference?
