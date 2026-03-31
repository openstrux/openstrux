## MODIFIED Requirements

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
