## Context

The benchmark runner (`benchmarks/runner/generate.ts`) sets up worktrees for generating LLMs. For the openstrux path, it injects a language spec bundle (`openstrux-lang/`) and assembles a prompt that instructs the LLM to write `.strux` files, run `strux build`, then gap-fill remaining stubs.

The `@openstrux/cli` package lives in `openstrux-core/packages/cli` with workspace deps on parser, validator, generator, ast, config, manifest, lock. All are pure TypeScript with zero external npm runtime dependencies (~2.3MB dist total). The CLI is already built and functional — just not reachable from worktrees.

The UC repo already has `strux.config.yaml` and tsconfig path alias `@openstrux/build/*` → `.openstrux/build/*` ready.

## Goals / Non-Goals

**Goals:**
- `npx strux build` works inside benchmark worktrees without sibling repo access at runtime
- CLI version is pinnable per benchmark run
- The OPENSTRUX_PROMPT clearly separates generated artifacts from gap-fill stubs
- An Openstrux skill exists that any Claude session can use when working with `.strux` files
- Benchmark worktrees get the skill automatically

**Non-Goals:**
- Publishing `@openstrux/cli` to npm (standalone bundle is sufficient for now)
- Changing the strux CLI itself or the generator output format
- Modifying the direct benchmark path
- Changing test suites or contract stubs

## Decisions

### D1: esbuild single-file bundle

Bundle the CLI and all workspace deps into one `strux-standalone.mjs` using esbuild.

**Why esbuild:** zero-config for pure TS, fast, produces a single file. All 8 workspace packages have zero external runtime deps, so the bundle is fully self-contained.

**Alternatives considered:**
- `pnpm pack` each package + `file:` deps in worktree — more complex, preserves package boundaries that don't matter for this use case
- Symlink to sibling repo — breaks self-sufficiency requirement
- Publish to npm — premature; adds release process overhead for a dev-only tool

**Output:** `openstrux-core/packages/cli/dist/strux-standalone.mjs` (~200-400KB)

**Script location:** `packages/cli/package.json` → `"bundle"` script. esbuild added as root devDependency.

### D2: CLI injection in generate.ts

New function `injectStruxCli(wt: string)` in `generate.ts`, following the same pattern as `injectSpecBundle()`:

1. Locate `openstrux-core/packages/cli/dist/strux-standalone.mjs` relative to the UC repo (build-time — the runner machine has sibling repos)
2. Copy to `<worktree>/.openstrux/cli/strux.mjs`
3. Create shell wrapper at `<worktree>/node_modules/.bin/strux`:
   ```bash
   #!/bin/sh
   exec node "$(dirname "$0")/../../.openstrux/cli/strux.mjs" "$@"
   ```
4. `chmod +x` both files
5. Log: `[generate] Injected strux CLI → <path>`

**Discovery paths** (same sibling convention as spec bundle):
- `<uc-repo>/../openstrux-core/packages/cli/dist/strux-standalone.mjs`
- `<uc-repo>/../openstrux/openstrux-core/packages/cli/dist/strux-standalone.mjs`

**If not found:** warn and continue. The prompt has fallback language.

**Called in:** both `promptMode()` and `agentMode()`, for openstrux path only, after `pnpm install` (which creates `node_modules/`).

### D3: Updated OPENSTRUX_PROMPT

The current prompt (lines 268-320) says "gap-fill any TypeScript stubs that strux build did not generate" without explaining what the build produces. Update to:

- Step 5: explain that `strux build` generates types, Zod schemas, Prisma schema, route handler scaffolds, and prisma client into `.openstrux/build/`
- Step 5: mention the `@openstrux/build/*` tsconfig alias
- Step 6: explicitly list which contract stubs are gap-fills (service layer, policies, DAL, routes with auth, seed) vs which overlap with build output (prisma schema, domain schemas, prisma client)
- Remove the implicit "if strux build is not available" fallback — if the CLI is injected, it should always work

### D4: Openstrux skill

**Location:** `.claude/skills/openstrux/SKILL.md` (global, available in all projects)

**Trigger:** when working with `.strux` files, running `strux build`, debugging strux compilation errors, or when a repo has `strux.config.yaml`

**Content:**
1. Language reference — read `syntax-reference.md` from local `openstrux-lang/` or `openstrux-spec` sibling
2. CLI usage — `strux build --explain`, interpret diagnostics, build output structure (`.openstrux/build/`)
3. Project setup — verify `strux.config.yaml`, source globs, CLI availability
4. Examples — point to conformance examples as patterns to follow
5. Build → gap-fill workflow — `.strux` defines domain + flows; `strux build` generates scaffolding; hand-write service logic, policies, DAL

**Does NOT cover:** benchmark runner workflow (stays in CLAUDE.md).

**Benchmark injection:** `generate.ts` copies the skill into `<worktree>/.claude/skills/openstrux/SKILL.md` so the generating LLM has it without needing the global skill directory. Same injection pattern as spec bundle and CLI.

### D5: Baseline cleanup

Remove stale `.openstrux/build/` from the UC repo (`openstrux-uc-grant-workflow`). This is a one-time commit to the baseline, not a runtime step. The build dir should start empty — populated only by the LLM's `strux build`.

Example build output (what `strux build` produces from the spec examples) should be documented in `openstrux-lang/examples/` README or a dedicated `build-output-example/` subdirectory in the injected docs.

## Risks / Trade-offs

- **[Risk] esbuild bundle may not handle edge cases in workspace resolution** → Mitigation: all deps are pure TS with no native modules; test the bundle end-to-end by running `node strux-standalone.mjs build` against the UC repo.
- **[Risk] `node_modules/.bin/strux` wrapper may be overwritten by `pnpm install`** → Mitigation: inject CLI *after* `pnpm install`. The worktree's lockfile doesn't include `@openstrux/cli`, so pnpm won't touch that bin entry.
- **[Risk] Skill content may become stale as the language evolves** → Mitigation: the skill reads live files (`syntax-reference.md`, `strux.config.yaml`) rather than hardcoding language details. Only the workflow guidance is static.
