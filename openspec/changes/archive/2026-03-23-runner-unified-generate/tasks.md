## 1. Scaffold generate.ts

- [x] 1.1 Create `benchmarks/runner/generate.ts` with shebang, file-level comment, and imports mirroring `generate-agent.ts`
- [x] 1.2 Copy CLI arg parsing block from `generate-agent.ts`; add `--mode <agent|prompt|apply>` flag (default: `agent`) and `--response <file>` flag for apply mode
- [x] 1.3 Extend provider auto-detection: `gemini-*` → `google-gemini`; update default model fallback for google-gemini to `gemini-2.5-pro`
- [x] 1.4 Gate API key validation on `mode === "agent"`; skip entirely for `prompt` and `apply`
- [x] 1.5 Copy `BenchmarkConfig` interface and config-loading block verbatim from `generate-agent.ts`
- [x] 1.6 Copy prompt assembly block (`read()`, `section()`, `parts`, `taskPrompt`) verbatim from `generate-agent.ts`
- [x] 1.7 Copy `execTool()`, tool definitions array, and `OAIMessage` types verbatim from `generate-agent.ts`
- [x] 1.8 Copy `runAnthropicAgent()` verbatim from `generate-agent.ts`
- [x] 1.9 Copy `runOpenAIAgent()` verbatim from `generate-agent.ts` (renamed `runOAIAgent()`, shared with google-gemini)
- [x] 1.10 Copy `writeMetaJson()` / metadata-writing logic verbatim from `generate-agent.ts`

## 2. Gemini agent loop

- [x] 2.1 Research Gemini agent SDK — no `cwd`-aware agent SDK equivalent to claude-agent-sdk exists
- [x] 2.2 Decision: route `google-gemini` through Google's OpenAI-compatible endpoint via `runOAIAgent()` — same 4 tools, same loop, no extra SDK
- [x] 2.3 Set default base URL for `google-gemini` to `https://generativelanguage.googleapis.com/v1beta/openai`
- [x] 2.4 API key for `google-gemini`: `GOOGLE_API_KEY`
- [x] 2.5 Token counts tracked via OAI `usage.prompt_tokens` / `completion_tokens` — written to `generation-meta.json`

## 3. Prompt mode (`--mode prompt`)

- [x] 3.1 After prompt assembly, if `mode === "prompt"`: ensure result-dir exists (`mkdirSync`)
- [x] 3.2 Write assembled prompt to `<result-dir>/prompt-<pathArg>.txt`
- [x] 3.3 Write worktree absolute path to `<result-dir>/worktree.txt`
- [x] 3.4 Print next-step instructions to stdout (result-dir location, how to invoke `--mode apply`)
- [x] 3.5 Print cleanup reminder to stderr: `git worktree remove <worktree>`
- [x] 3.6 Exit 0

## 4. Apply mode (`--mode apply`)

- [x] 4.1 Read `<result-dir>/worktree.txt`; exit non-zero with error if missing
- [x] 4.2 Validate `--response <file>` is provided and the file exists; exit non-zero if not
- [x] 4.3 Count existing `response-attempt-*.txt` files in result-dir; determine attempt number N
- [x] 4.4 Save response text as `<result-dir>/response-attempt-<N>.txt`
- [x] 4.5 Implement `parseFencedBlocks(text)` → `Array<{path, content}>` (same regex as old `generate-api.ts`)
- [x] 4.6 Call `writeFiles(files, worktree)` to write each extracted file
- [x] 4.7 Run unit tests via `execSync`; parse Vitest JSON using `assertionResults`/`name` fields
- [x] 4.8 On test pass: invoke `save-result.sh` via `execSync`; run `git worktree remove <worktree>`; exit 0
- [x] 4.9 On test fail: read `prompts/shared/retry.md` from worktree; substitute template vars; print to stdout; exit non-zero; do NOT remove worktree

## 5. Mode dispatch and main

- [x] 5.1 Add top-level dispatch: prompt → promptMode(), apply → applyMode(), else → agentMode()
- [x] 5.2 In `agentMode()`: dispatch to `runAnthropicAgent()` for anthropic, `runOAIAgent()` for openai and google-gemini

## 6. run-benchmark.sh migration

- [x] 6.1 Replace all `generate-agent.ts` and `generate-api.ts` references with `generate.ts --mode agent`
- [x] 6.2 Add `--mode` flag parsing to the shell argument loop
- [x] 6.3 Add `--response <file>` flag parsing for apply mode
- [x] 6.4 In `--mode prompt`: run only Step 1 (worktree create) + Step 2 (pnpm install), then call `generate.ts --mode prompt`; skip Steps 3–7
- [x] 6.5 In `--mode apply`: skip Steps 1–2; call `generate.ts --mode apply --response <file>`; skip Step 4 (tests run inside generate.ts)
- [x] 6.6 Update usage/help comment at top of script

## 7. Cleanup

- [x] 7.1 Delete `benchmarks/runner/generate-agent.ts`
- [x] 7.2 Delete `benchmarks/runner/generate-api.ts`

## 8. Manual verification

- [x] 8.1 Run `run-benchmark.sh --mode agent --provider anthropic --path direct` end-to-end; confirm benchmark.json produced
- [x] 8.2 Run `run-benchmark.sh --mode agent --provider google-gemini --model gemini-2.5-pro --path direct`; confirm generation-meta.json with token counts
- [x] 8.3 Run `run-benchmark.sh --mode prompt --path direct`; confirm `prompt-direct.txt` and `worktree.txt` written
- [x] 8.4 Paste prompt into Claude.ai web session; save response; run `run-benchmark.sh --mode apply --response response.txt --path direct`; confirm files written and tests run
- [x] 8.5 Simulate test failure in apply mode; confirm retry prompt printed to stdout with correct substitutions
