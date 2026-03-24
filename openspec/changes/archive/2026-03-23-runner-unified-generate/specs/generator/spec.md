## ADDED Requirements

### Requirement: Unified generate.ts entry point
The runner SHALL provide a single `generate.ts` script that replaces both `generate-agent.ts` and `generate-api.ts`. The old scripts SHALL be deleted.

#### Scenario: generate.ts is the only runner script
- **WHEN** the benchmark runner directory is inspected
- **THEN** `generate.ts` exists and neither `generate-agent.ts` nor `generate-api.ts` exist

### Requirement: Mutually exclusive operating modes
`generate.ts` SHALL accept a `--mode <agent|prompt|apply>` flag. Exactly one mode is active per invocation. If `--mode` is omitted, `agent` is the default.

#### Scenario: Default mode is agent
- **WHEN** `generate.ts` is invoked without `--mode`
- **THEN** it runs in `agent` mode

#### Scenario: Conflicting mode values are rejected
- **WHEN** an unrecognised value is passed to `--mode`
- **THEN** the script exits non-zero with a usage error listing valid values

### Requirement: Provider auto-detection
The `--provider` flag SHALL be optional. When omitted, the provider is auto-detected from the model name: `claude-*` → `anthropic`; `gemini-*` → `google-gemini`; anything else → `openai`.

#### Scenario: Claude model auto-selects anthropic
- **WHEN** `--model claude-sonnet-4-6` is passed without `--provider`
- **THEN** provider is resolved as `anthropic`

#### Scenario: Gemini model auto-selects google-gemini
- **WHEN** `--model gemini-2.5-pro` is passed without `--provider`
- **THEN** provider is resolved as `google-gemini`

#### Scenario: Unknown model falls back to openai
- **WHEN** `--model glm-5` is passed without `--provider`
- **THEN** provider is resolved as `openai`

#### Scenario: Explicit provider overrides auto-detection
- **WHEN** `--provider openai --model claude-sonnet-4-6` is passed
- **THEN** provider is resolved as `openai`

### Requirement: API key validation per provider
`generate.ts` SHALL validate the required environment variable for the active provider in `agent` mode, and skip validation entirely in `prompt` and `apply` modes.

#### Scenario: anthropic requires ANTHROPIC_API_KEY in agent mode
- **WHEN** `--mode agent --provider anthropic` and `ANTHROPIC_API_KEY` is unset
- **THEN** the script exits non-zero with a clear error

#### Scenario: google-gemini requires GOOGLE_API_KEY in agent mode
- **WHEN** `--mode agent --provider google-gemini` and `GOOGLE_API_KEY` is unset
- **THEN** the script exits non-zero with a clear error

#### Scenario: No API key required for prompt mode
- **WHEN** `--mode prompt` and no API key env vars are set
- **THEN** the script proceeds without error

#### Scenario: No API key required for apply mode
- **WHEN** `--mode apply` and no API key env vars are set
- **THEN** the script proceeds without error

### Requirement: run-benchmark.sh uses generate.ts
`run-benchmark.sh` SHALL call `generate.ts --mode agent` for all existing benchmark runs and SHALL support `--mode prompt` and `--mode apply` pass-through flags.

#### Scenario: Default run uses generate.ts
- **WHEN** `run-benchmark.sh` is invoked without mode flags
- **THEN** it calls `generate.ts --mode agent` (not any deleted script)

#### Scenario: Prompt mode skips setup steps in shell
- **WHEN** `run-benchmark.sh --mode prompt` is invoked
- **THEN** only worktree creation and `pnpm install` run before `generate.ts --mode prompt`; test and save-result steps are skipped

#### Scenario: Apply mode skips worktree setup in shell
- **WHEN** `run-benchmark.sh --mode apply --response <file>` is invoked
- **THEN** worktree creation and `pnpm install` are skipped; `generate.ts --mode apply` is called directly
