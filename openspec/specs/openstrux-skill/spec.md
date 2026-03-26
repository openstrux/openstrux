## ADDED Requirements

### Requirement: Openstrux skill file
A Claude Code skill SHALL exist at `.claude/skills/openstrux/SKILL.md` that teaches Claude sessions how to work with the Openstrux language and CLI.

#### Scenario: Skill activates on strux-related work
- **WHEN** a user asks to write `.strux` files, run `strux build`, debug strux compilation errors, or a repo contains `strux.config.yaml`
- **THEN** the skill is available and provides guidance on language syntax, CLI usage, and the build-to-gap-fill workflow

#### Scenario: Skill reads live reference files
- **WHEN** the skill is activated
- **THEN** it instructs Claude to read `syntax-reference.md` from the local `openstrux-lang/` directory or `openstrux-spec` sibling repo, rather than relying on training data

### Requirement: Language reference guidance
The skill SHALL direct Claude to read the Openstrux syntax reference and conformance examples before writing `.strux` files.

#### Scenario: Reading order specified
- **WHEN** Claude needs to write `.strux` source
- **THEN** the skill instructs it to read `syntax-reference.md` first, then `examples/` (especially `p0-domain-model.strux`), then deep specs only if needed

### Requirement: CLI usage guidance
The skill SHALL document how to run the strux CLI and interpret its output.

#### Scenario: Build command documented
- **WHEN** Claude needs to compile `.strux` files
- **THEN** the skill instructs it to run `npx strux build --explain` and explains the output structure (`.openstrux/build/` containing types, schemas, prisma schema, handlers, prisma client)

#### Scenario: Diagnostics guidance
- **WHEN** `strux build` produces errors
- **THEN** the skill instructs Claude to read the diagnostic messages, fix the `.strux` source, and rebuild

### Requirement: Build-to-gap-fill workflow
The skill SHALL explain the relationship between generated artifacts and hand-written code.

#### Scenario: Generated vs gap-fill distinction
- **WHEN** Claude has run `strux build` successfully
- **THEN** the skill explains that generated artifacts in `.openstrux/build/` can be imported via `@openstrux/build/*`, and that service logic, policies, DAL, seed, and auth-aware route handlers require hand-written implementations

### Requirement: Project setup verification
The skill SHALL guide Claude to verify the project is correctly configured for Openstrux.

#### Scenario: Config check
- **WHEN** Claude starts working with Openstrux in a project
- **THEN** the skill instructs it to check `strux.config.yaml` exists, verify source globs include the right directories, and confirm `npx strux build` is available

### Requirement: Benchmark skill injection
The benchmark runner SHALL copy the Openstrux skill into the worktree's `.claude/skills/` directory for openstrux path runs.

#### Scenario: Skill available in worktree
- **WHEN** `generate.ts` sets up a worktree for `--path openstrux`
- **THEN** `.claude/skills/openstrux/SKILL.md` exists in the worktree with the same content as the global skill
