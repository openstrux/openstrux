## Why

The benchmark runner currently ships two separate scripts (`generate-api.ts` for the Anthropic Messages API and `generate-agent.ts` for the agentic loop), and `generate-api.ts` is broken. Maintaining two scripts with divergent logic is unsustainable. A single `generate.ts` that unifies all execution modes — including a new copy-paste mode for use without an API key — simplifies the runner, removes the broken script, and makes multi-provider support (including Google Gemini Pro) a first-class concern.

## What Changes

- **BREAKING**: `generate-api.ts` is deleted.
- `generate-agent.ts` is replaced by `generate.ts` with a `--mode` flag:
  - `agent` (default): stateful agentic loop — Anthropic Claude Agent SDK or OpenAI-compatible tool-calling (unchanged behaviour from `generate-agent.ts`).
  - `prompt`: assemble the full benchmark prompt, write `prompt-<path>.txt` + `worktree.txt` to the result-dir, exit without calling any LLM (no API key required).
  - `apply`: recover worktree from `worktree.txt`, parse a fenced-block response file, write files, run unit tests, emit a filled retry prompt on failure, archive results and clean up on success.
- `--provider` gains a new value: `google-gemini` — drives generation via the Google Generative AI API (Gemini Pro) using a custom tool-calling loop.
- `--model` accepts Gemini model IDs (e.g., `gemini-2.5-pro`).
- `run-benchmark.sh` updated: references to `generate-api.ts` replaced by `generate.ts --mode agent`; new `--mode prompt` and `--mode apply` flags wired through.

## Capabilities

### New Capabilities

- `runner-prompt-mode`: assemble and persist the full benchmark prompt without calling any LLM, leaving the worktree ready for manual use.
- `runner-apply-mode`: apply a freeform text response to an existing worktree, run tests, emit a retry prompt on failure, archive results.
- `runner-gemini-provider`: drive benchmark generation via Google Gemini Pro using the Google Generative AI API with native function-calling.

### Modified Capabilities

- `generator`: gains `--mode` flag (agent / prompt / apply), `--provider google-gemini`, and removes the `generate-api.ts` execution path.

## Impact

- `benchmarks/runner/generate-agent.ts` — deleted (replaced by `generate.ts`).
- `benchmarks/runner/generate-api.ts` — deleted.
- `benchmarks/runner/generate.ts` — new unified file.
- `benchmarks/runner/run-benchmark.sh` — updated references and new mode flags.
- New runtime dependency: `@google/generative-ai` (or `@google/genai`) for Gemini support.
- No changes to prompt files, `save-result.sh`, result schema, or viewer.
