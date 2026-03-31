## ADDED Requirements

### Requirement: Starter repository supports two generation paths
`openstrux-uc-grant-workflow` SHALL be initialized with a pre-built frontend (archived change), pre-written tests (archived change), and a defined backend generation change. Two prompt sets SHALL exist for baseline (direct TS) and openstrux-assisted paths.

#### Scenario: Repository is in initial state
- **WHEN** `scripts/reset.sh` is run
- **THEN** the repo SHALL contain the frontend and tests but no generated backend, and `output/baseline/` and `output/openstrux/` SHALL be empty

### Requirement: Demo script runs the full toolchain end-to-end
`openstrux/demos/grant-workflow/run.sh` SHALL execute parse -> validate -> generate on all `.strux` files, print a summary, and run `tsc --noEmit`. It SHALL exit non-zero on any failure.

#### Scenario: Clean run exits with code 0
- **WHEN** `run.sh` is executed on a machine with openstrux-core built and Node.js >= 20
- **THEN** it SHALL exit with code 0

### Requirement: save-result.sh captures benchmark data
`scripts/save-result.sh` SHALL zip generated backend files, create a benchmark JSON entry, prompt for manual input (LLM used, test results, result note, feedback), and store results.

#### Scenario: Result is saved
- **WHEN** `scripts/save-result.sh` is run after a generation pass
- **THEN** `results/<date>-<path>/` SHALL contain a zip of generated files and a `benchmark.json` with `timestamp`, `llm`, `generatedFileCount`, `totalLines`, `manualTestResults`, `resultNote`, `feedback`

### Requirement: Results viewer displays comparison data
A page in the frontend at `/results` SHALL read `results/*/benchmark.json` files and display a navigable comparison table.

#### Scenario: Results are viewable
- **WHEN** a user navigates to `/results` after two benchmark runs
- **THEN** both runs SHALL appear in the table with LLM, tokens, time, test results, and notes

### Requirement: Token compression ratio is measured and recorded
The demo SHALL measure token counts and record compression ratio in `benchmarks/results/v0.6.0-demo.json`.

#### Scenario: Compression ratio is recorded
- **WHEN** `run.sh` completes
- **THEN** `benchmarks/results/v0.6.0-demo.json` SHALL contain `struxTokens`, `baselineTokens`, `compressionRatio`

### Requirement: Demo README shows side-by-side Strux vs TypeScript
`openstrux/demos/grant-workflow/README.md` SHALL include a side-by-side comparison of the P1 intake panel in `.strux` shorthand and its generated Next.js route.

#### Scenario: README is self-contained
- **WHEN** a reviewer reads `demos/grant-workflow/README.md`
- **THEN** they SHALL understand the demo and be able to run it without consulting other docs
