## Context

The benchmark runner currently has two scripts:
- `generate-agent.ts`: working agentic loop supporting `anthropic` (Claude Agent SDK) and `openai` (custom tool-calling loop for OpenAI-compatible APIs like z.ai).
- `generate-api.ts`: a clean-context Messages API loop that is broken and unused.

`run-benchmark.sh` calls one or the other based on the provider. This split is accidental complexity — the agentic loop is the only working and desired execution model. The new `generate.ts` unifies everything under a single entry point with an explicit `--mode` flag, adds a `google-gemini` provider to the existing agentic loop, and introduces `prompt`/`apply` modes for API-key-free copy-paste operation.

## Goals / Non-Goals

**Goals:**
- Single `generate.ts` replacing both deleted scripts.
- `--mode agent` (default): agentic loop, providers: `anthropic`, `openai`, `google-gemini`.
- `--mode prompt`: assemble prompt + write `prompt-<path>.txt` + `worktree.txt`; no LLM call; no API key required.
- `--mode apply`: recover worktree, parse response file, write files, run tests, retry prompt on failure, archive + clean up on success.
- `run-benchmark.sh` updated to call `generate.ts` with appropriate flags.
- Gemini Pro support via `@google/genai` (Google Gen AI SDK), using the native function-calling API.

**Non-Goals:**
- Re-introducing a clean-context (non-agentic) Messages API loop.
- Auto-retry loop in `apply` mode (retries stay manual).
- Integration test orchestration inside `generate.ts`.
- Streaming output for Gemini (start with non-streaming for simplicity).

## Decisions

**D1 — Single file, `--mode` flag, not separate scripts.**
The three modes share CLI arg parsing, prompt assembly, config loading, and `save-result.sh` invocation. A single file with a mode branch avoids duplication and makes the execution model explicit to readers.

*Alternative:* Three scripts sharing a lib module. Rejected — premature abstraction for a ~600-line script.

**D2 — Gemini via `@google/genai` SDK, custom tool-calling loop (mirroring OpenAI path).**
Gemini supports function calling in a similar pattern to OpenAI: send `tools` declarations, receive `functionCall` parts, return `functionResponse` parts. The existing `execTool()` helper is reused verbatim. `GOOGLE_API_KEY` env var required.

*Alternative:* OpenAI-compatible Gemini endpoint (`generativelanguage.googleapis.com/v1beta/openai/`). This would let us reuse the OpenAI path entirely. Chosen NOT to do this for now — the native SDK gives better error messages and doesn't depend on undocumented compat endpoints. Can be revisited.

**D3 — Provider auto-detection extended to Gemini.**
`gemini-*` model names auto-select `google-gemini` provider, `claude-*` auto-selects `anthropic`, everything else falls back to `openai`. Explicit `--provider` always wins.

**D4 — `prompt` mode needs no worktree (optionally creates one).**
If `--worktree` is explicitly passed, use it. If not, `prompt` mode creates a dated worktree via `git worktree add` (same as `run-benchmark.sh` does) and records the path in `worktree.txt`. `run-benchmark.sh` can still pre-create the worktree as before and pass `--worktree`.

**D5 — `apply` mode reads config from the recovered worktree.**
`benchmark.config.json` lives in the worktree, so `apply` mode reads it from `worktree.txt` path — same as `agent` mode does today.

**D6 — Retry prompt in `apply` mode reuses `retry.md` template from the worktree.**
`prompts/shared/retry.md` is filled with `{{passed}}`, `{{total}}`, `{{attempt}}`, `{{maxRetries}}`, `{{failures}}`. Attempt number is derived from existing `response-attempt-*.txt` count in result-dir.

## Risks / Trade-offs

- **`@google/genai` is a new runtime dependency**: adds a package to the runner. Mitigation: optional import — only loaded when `provider === "google-gemini"`.
- **Gemini function-calling response shape differs from OpenAI**: `candidates[0].content.parts[]` contains `functionCall`/`text` parts rather than `choices[0].message.tool_calls`. The Gemini loop must handle this shape. Mitigation: isolated `runGeminiAgent()` function, easy to adjust.
- **Worktree leak in `prompt` mode**: if user never runs `apply`, the worktree stays on disk. Mitigation: print cleanup reminder with `git worktree remove <path>`.

## Migration Plan

1. Add `generate.ts` alongside the two old scripts.
2. Update `run-benchmark.sh` to call `generate.ts` (using `--mode agent`) for all existing invocations.
3. Delete `generate-agent.ts` and `generate-api.ts`.
4. No result schema changes — existing benchmark.json, evidence.zip format unchanged.

## Open Questions

- Should Gemini use streaming? The native SDK supports `generateContentStream`. Deferred — start non-streaming, add later if latency is a concern.
- Should `apply` mode support `--with-db` (integration tests)? Deferred to a follow-up.
