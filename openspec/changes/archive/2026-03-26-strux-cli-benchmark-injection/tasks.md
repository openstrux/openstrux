## 1. CLI standalone bundle (openstrux-core)

- [x] 1.1 Add `esbuild` as root devDependency in `openstrux-core/package.json`
- [x] 1.2 Add `"bundle"` script to `openstrux-core/packages/cli/package.json`: esbuild entry `src/bin.ts`, platform=node, format=esm, shebang banner, output `dist/strux-standalone.mjs`
- [x] 1.3 Run the bundle script, verify `dist/strux-standalone.mjs` is produced
- [x] 1.4 Test standalone: `node dist/strux-standalone.mjs build` against the UC repo — verify output matches workspace CLI

## 2. Openstrux skill

- [x] 2.1 Create `.claude/skills/openstrux/SKILL.md` with frontmatter (name, description, allowed-tools) and content covering: language reference reading order, CLI usage (`strux build --explain`), project setup verification (`strux.config.yaml`), examples as patterns, build-to-gap-fill workflow, `@openstrux/build/*` import alias
- [x] 2.2 Verify skill appears in Claude Code skill list

## 3. Benchmark runner updates (generate.ts)

- [x] 3.1 Add `injectStruxCli(wt: string)` function: locate bundled CLI from openstrux-core sibling, copy to `<wt>/.openstrux/cli/strux.mjs`, create shell wrapper at `<wt>/node_modules/.bin/strux`, chmod +x both, warn if not found
- [x] 3.2 Add `injectSkill(wt: string)` function: copy `.claude/skills/openstrux/SKILL.md` to `<wt>/.claude/skills/openstrux/SKILL.md`
- [x] 3.3 Call `injectStruxCli` and `injectSkill` in `promptMode()` for openstrux path, after `pnpm install`
- [x] 3.4 Call `injectStruxCli` and `injectSkill` in `agentMode()` for openstrux path, after `pnpm install`
- [x] 3.5 Update `OPENSTRUX_PROMPT`: step 5 explains build output (types, schemas, prisma, handlers, prisma client → `.openstrux/build/`), mentions `@openstrux/build/*` alias; step 6 lists gap-fill stubs explicitly (services, policies, DAL, auth routes, seed)

## 4. Baseline cleanup (openstrux-uc-grant-workflow)

- [x] 4.1 Remove stale `.openstrux/build/` contents from UC repo baseline and commit
- [x] 4.2 Add `.openstrux/build/` to `.gitignore` if not already present

## 5. Verification

- [x] 5.1 Clean up existing test worktree: `git worktree remove --force` the current bench worktree
- [x] 5.2 Run `run-benchmark.sh --uc ../openstrux-uc-grant-workflow --path openstrux --mode prompt` — verify CLI and skill are injected
- [x] 5.3 In new worktree: write a minimal `.strux` file, run `npx strux build`, verify output in `.openstrux/build/`
- [x] 5.4 Verify `.openstrux/build/` is empty before writing `.strux` files
- [x] 5.5 Verify `.claude/skills/openstrux/SKILL.md` exists in worktree
