## ADDED Requirements

### Requirement: Prompt assembly and persistence
In `--mode prompt`, `generate.ts` SHALL assemble the full benchmark prompt from the worktree's config and prompt files, write it to the result-dir, and exit without calling any LLM. For the openstrux path, it SHALL additionally inject the bundled strux CLI and the Openstrux skill into the worktree.

#### Scenario: Prompt file written to result-dir
- **WHEN** `generate.ts --mode prompt --path <path> --result-dir <dir>` is invoked
- **THEN** `<dir>/prompt-<path>.txt` is created containing the fully assembled prompt (system, constraints, specs, tasks, generation instructions, path instructions, output format)

#### Scenario: Worktree path persisted
- **WHEN** `--mode prompt` completes successfully
- **THEN** `<result-dir>/worktree.txt` is created containing the absolute worktree path

#### Scenario: Cleanup reminder printed
- **WHEN** `--mode prompt` exits
- **THEN** the script prints to stderr the `git worktree remove <path>` command for the created worktree

#### Scenario: Worktree is not removed on exit
- **WHEN** `--mode prompt` exits
- **THEN** the worktree directory remains on disk intact

#### Scenario: Exit 0 on success
- **WHEN** prompt assembly and file writing succeed
- **THEN** the script exits with code 0

#### Scenario: Strux CLI injected for openstrux path
- **WHEN** `--path openstrux` is used in prompt or agent mode
- **THEN** `<worktree>/node_modules/.bin/strux` exists and is executable, delegating to the bundled `strux-standalone.mjs`

#### Scenario: Strux CLI works in worktree
- **WHEN** the generating LLM runs `npx strux build` in the worktree after writing `.strux` files
- **THEN** the build succeeds and outputs to `<worktree>/.openstrux/build/`

#### Scenario: CLI not found is non-fatal
- **WHEN** `--path openstrux` is used but the bundled CLI is not found on the runner machine
- **THEN** a warning is logged and setup continues without the CLI

#### Scenario: Openstrux skill injected for openstrux path
- **WHEN** `--path openstrux` is used in prompt or agent mode
- **THEN** `<worktree>/.claude/skills/openstrux/SKILL.md` exists with the Openstrux skill content

#### Scenario: Build directory starts clean
- **WHEN** the worktree is created for any path
- **THEN** `<worktree>/.openstrux/build/` is empty or does not exist

## ADDED Requirements

### Requirement: OPENSTRUX_PROMPT explains build output
The `OPENSTRUX_PROMPT` in `generate.ts` SHALL clearly describe what `strux build` generates and what requires hand-written gap-fills.

#### Scenario: Build output documented in prompt
- **WHEN** the openstrux path prompt is assembled
- **THEN** the prompt explains that `strux build` generates types, Zod schemas, Prisma schema, route handler scaffolds, and prisma client into `.openstrux/build/`

#### Scenario: Gap-fill stubs listed in prompt
- **WHEN** the openstrux path prompt is assembled
- **THEN** the prompt lists which contract stubs are gap-fills (service layer, policies, DAL, auth-aware routes, seed) vs which overlap with build output

#### Scenario: Import alias documented
- **WHEN** the openstrux path prompt is assembled
- **THEN** the prompt mentions that `@openstrux/build/*` is a preconfigured tsconfig path alias for importing generated artifacts

## ADDED Requirements

### Requirement: Multi-step prompt assembly

The runner prompt mode SHALL support a `--step` flag that selects which step of the benchmark protocol to assemble. Default is `--step 1` (existing behavior, backward compatible).

- `--step 1`: Assemble the backend generation prompt (existing behavior, no change).
- `--step 2`: Assemble the certification prompt from `benchmarks/prompts/step-2-certify.md`. Requires `--result-dir` pointing to a completed step 1.
- `--step 3`: Assemble the propagation prompt from `benchmarks/prompts/step-3-propagate.md`. Requires `--result-dir` pointing to a completed step 1.

#### Scenario: Step 1 is default
- **WHEN** `run-benchmark.sh --mode prompt` is invoked without `--step`
- **THEN** behavior is identical to current runner (step 1 by default)

#### Scenario: Step 2 reuses step 1 worktree
- **WHEN** `run-benchmark.sh --mode prompt --step 2 --result-dir <dir>` is invoked
- **THEN** the runner reads `<dir>/worktree.txt` to find the existing worktree and assembles the certification prompt in that context

#### Scenario: Step 2 fails without completed step 1
- **WHEN** `--step 2` is invoked without `--result-dir` or with a result dir that has no `worktree.txt`
- **THEN** the runner exits with an error: "Step 2 requires a completed step 1 result directory"

### Requirement: Step result isolation

Each step's results SHALL be stored in a subdirectory within the result dir:

```
<result-dir>/
  step-1/              # existing results (prompt, response, test results, meta)
  step-2/              # certification results
    prompt-certify.txt
    response-certify.txt
    art30-record.json   # extracted structured output
    scoring.json        # completeness, accuracy, queryability scores
  step-3/              # propagation results
    prompt-propagate.txt
    response-propagate.txt
    art30-record-updated.json
    scoring.json
    diff-summary.txt    # files changed during propagation
```

#### Scenario: Step 2 results stored in subdirectory
- **WHEN** step 2 apply completes
- **THEN** results are written to `<result-dir>/step-2/` without affecting step 1 results

#### Scenario: Step 1 results remain at root for backward compatibility
- **WHEN** only step 1 is run (no `--step` flag)
- **THEN** results are stored at the result dir root as before (no `step-1/` subdirectory unless step 2 is also run)
