## Why

The openstrux benchmark path instructs the generating LLM to write `.strux` files and compile them via `npx strux build`, but the CLI is not available in the worktree. The LLM falls back to hand-writing all TypeScript, defeating the purpose of measuring the openstrux-assisted generation path. The worktree must be self-sufficient — no sibling repo dependency at runtime — and the CLI version must be pinnable.

## What Changes

- **Bundle the strux CLI** into a single standalone file (esbuild) in the openstrux-core repo, producing `strux-standalone.mjs` with zero external dependencies.
- **Inject the bundled CLI** into benchmark worktrees during `generate.ts` setup, so `npx strux build` works out of the box for the generating LLM.
- **Create an Openstrux skill** (`.claude/skills/openstrux.md`) that teaches any Claude session how to work with the Openstrux language and CLI. For benchmarks, the runner copies it into the worktree's `.claude/` folder.
- **Update the OPENSTRUX_PROMPT** in `generate.ts` to clarify what `strux build` generates vs what requires hand-written gap-fills.
- **Clean stale build artifacts** from the UC repo baseline (`.openstrux/build/`). Example build output moves to injected documentation.

## Capabilities

### New Capabilities

- `cli-standalone-bundle`: esbuild single-file bundle of `@openstrux/cli` and all workspace dependencies into `strux-standalone.mjs`
- `openstrux-skill`: Claude Code skill for working with the Openstrux language, CLI, and build-to-gap-fill workflow

### Modified Capabilities

- `runner-prompt-mode`: Inject bundled CLI and skill into worktree; update OPENSTRUX_PROMPT to clarify generated vs gap-fill stubs; clean stale build output from baseline

## Impact

- **openstrux-core**: New `esbuild` devDependency at root; new `bundle` script in `packages/cli/package.json`
- **openstrux (this repo)**: `benchmarks/runner/generate.ts` gains `injectStruxCli()` and skill injection; updated `OPENSTRUX_PROMPT`; new `.claude/skills/openstrux.md`
- **openstrux-uc-grant-workflow**: One-time baseline cleanup — remove `.openstrux/build/` stale artifacts
- **Benchmark worktrees**: Gain a working `strux` binary and the openstrux skill in `.claude/`
