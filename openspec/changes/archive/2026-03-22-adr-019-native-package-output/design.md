## Context

The generator in `openstrux-core/packages/generator` currently exposes a `generate(ast, manifest, options)` function that returns `GeneratedFile[]` — an array of `{ path, content, lang }` objects. The TypeScript adapter emits loose files at project-relative paths (`types/`, `lib/schemas/`, `app/api/`, `prisma/`). Rod emitters return string snippets, many with TODO stubs. There is no CLI — the generator is a library consumed programmatically.

ADR-019 requires: (1) output as a package-shaped build artifact in a repo-owned directory, (2) fully generated rod implementations, (3) config-driven target with semver ranges, (4) `strux build`/`init`/`doctor` CLI commands, and (5) adapter packaging profiles.

The current adapter interface is minimal: `Adapter.generate(ast, manifest, options): GeneratedFile[]`. The registry maps a string target name to an adapter. This needs to evolve to support config-resolved adapter sets and package emission.

## Goals / Non-Goals

**Goals:**
- Replace loose file output with a package-shaped build artifact in `.openstrux/build/`
- Stable import paths via `tsconfig.json` path aliases (`@openstrux/build`)
- Rod emitters produce complete, working implementations by chaining the panel's rod graph
- `strux build` as the primary CLI command (parse → validate → resolve → emit → package)
- `strux init` with auto-detection for zero-friction onboarding (config, paths, starter file, initial build)
- Config-driven target selection via `strux.config.yaml` with semver ranges
- Adapter interface extended with `package()` for ecosystem-native packaging
- Rename `target: "typescript"` to framework-specific identifiers (`nextjs`, `nestjs`)
- Documentation: getting-started guide, onboarding walkthrough, migration guide from loose files
- Update all golden conformance fixtures to match new output structure

**Non-Goals:**
- Multiple targets from one project (backlog)
- Incremental builds (backlog)
- Eject command (backlog, required before 1.0)
- Community adapter registry/hub infrastructure
- NestJS adapter implementation (future — only Next.js for v0.6)
- Brownfield DB support / `strux introspect` (ADR-020, separate change)
- `strux adapters list` / `strux adapters check` (backlog — `strux doctor` is in scope)

## Decisions

### 1. Package output location: repo-owned directory with path aliases

**Decision:** `strux build` writes to `.openstrux/build/` in the project root. Import paths use `@openstrux/build` via `tsconfig.json` path aliases configured by `strux init`.

**Why repo-owned over `node_modules`:** Prisma's evolution is the strongest signal. Prisma historically generated into `node_modules/.prisma/client` but deprecated this in 6.6 and requires a custom output path in Prisma 7. Their reasoning applies directly: generated code is application-specific source, not a reusable dependency. Package managers prune, hoist, and deduplicate `node_modules` unpredictably. CI pipelines and containers work more reliably without install-time code generation. Editor caches and TypeScript project references are more stable with repo-owned paths.

**Why `.openstrux/build/` over `src/generated/`:** A dotfile directory signals "tooling-managed, don't edit" without polluting the visible source tree. Same convention as `.next/`, `.prisma/`, `.turbo/`. The directory is `.gitignore`d by default — generated on build, not committed.

**How imports work:** `strux init` configures `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@openstrux/build": [".openstrux/build"],
      "@openstrux/build/*": [".openstrux/build/*"]
    }
  }
}
```

Next.js reads tsconfig paths natively. For bundlers that don't, `strux init` configures the bundler's alias mechanism. The import surface is identical regardless of physical location:
```typescript
import { Proposal } from "@openstrux/build"
```

### 2. Adapter interface extension

**Decision:** Split the adapter interface into `emit()` (code generation) and `package()` (ecosystem packaging):

```typescript
interface Adapter {
  name: string
  emit(ast: TopLevelNode[], manifest: Manifest, options: ResolvedOptions): GeneratedFile[]
  package(files: GeneratedFile[]): PackageOutput
}

interface PackageOutput {
  outputDir: string                    // e.g., ".openstrux/build"
  metadata: GeneratedFile[]            // package.json, tsconfig.json, etc.
  entrypoints: GeneratedFile[]         // index.ts barrel, sub-path exports
}

interface ResolvedOptions {
  framework: ResolvedDep               // { name: "next", version: "15.1.2", adapter: "adapter/nextjs@1.2.0" }
  orm: ResolvedDep
  validation: ResolvedDep
  runtime: ResolvedDep
}
```

**Why split over single method:** `emit()` is pure and testable — given AST, produce files. `package()` is ecosystem-specific plumbing. Separation means conformance tests can validate `emit()` output without touching the filesystem.

**Migration:** The existing `Adapter.generate()` becomes `Adapter.emit()`. The return type stays `GeneratedFile[]`. `package()` is new. The registry signature stays the same but accepts the extended interface.

### 3. Config format and resolution

**Decision:** `strux.config.yaml` at project root:

```yaml
target:
  base: typescript@~5.5
  framework: next@^15.0
  orm: prisma@^6.0
  validation: zod@^3.23
  runtime: node@>=20
```

Resolution: config ranges → adapter manifest compatibility check → resolved versions pinned in `snap.lock`. For v0.6, resolution is local (adapter bundled with CLI, not fetched from hub). Hub-based resolution is future work.

**Why YAML over JSON:** Supports comments (needed for documenting version choices). Consistent with other config files in the ecosystem (docker-compose, GitHub Actions, etc.).

**Why npm semver ranges:** Universal familiarity. Every JS/TS developer knows `^15.0` means ">=15.0.0 <16.0.0". No new syntax to learn.

### 4. Rod chaining for complete implementations

**Decision:** Rod emitters receive the full panel graph context, not just the individual rod. The route file emitter walks the rod chain (receive → validate → guard → write-data → respond) and emits a complete handler.

**Current state:** `RodEmitter = (rod: Rod, panel: Panel) => string` — each rod emits an independent snippet. `emitRouteFile()` concatenates snippets into a route handler with TODO comments.

**New approach:** `emitRouteFile()` receives the panel's rod chain as an ordered list and emits a complete function body that calls each step in sequence. Individual rod emitters become "step emitters" that produce one statement or block within the handler, not standalone stubs.

Example output for receive → validate → write-data → respond:
```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const input = ProposalSchema.parse(body);
  const result = await prisma.proposal.create({ data: input });
  return NextResponse.json(result, { status: 201 });
}
```

**Rod emitter signature change:**
```typescript
// Old: standalone snippet
type RodEmitter = (rod: Rod, panel: Panel) => string

// New: step within a chain, receives context from previous steps
type RodStepEmitter = (rod: Rod, context: ChainContext) => ChainStep

interface ChainContext {
  panel: Panel
  previousSteps: ChainStep[]
  inputVar: string          // variable name holding current data
  inputType: string         // TypeScript type of current data
}

interface ChainStep {
  imports: ImportDecl[]     // imports this step needs
  statement: string         // the code line(s) for this step
  outputVar: string         // variable name after this step
  outputType: string        // TypeScript type after this step
}
```

### 5. Framework-specific adapter naming and structure

**Decision:** The TypeScript adapter directory restructures from `adapters/typescript/` to:

```
adapters/
  ts-base/              # shared: type mappers, schema emitters, prisma emitters
  nextjs/               # Next.js specific: route emitters, middleware
    index.ts            # NextJsAdapter implements Adapter
    rods/               # rod step emitters for Next.js patterns
  nestjs/               # NestJS specific (future, not in this change)
```

`ts-base` is not an adapter itself — it's a shared utility layer. `nextjs` is the adapter that composes `ts-base` utilities with Next.js-specific emission.

**Why not one adapter with a framework flag:** Next.js App Router and NestJS controllers are fundamentally different architectures. A flag inside one adapter creates unmaintainable branching. Separate adapters with shared utilities is cleaner.

### 6. CLI commands

**`strux build`:**
1. Read `strux.config.yaml`
2. Resolve adapter set (for v0.6: bundled adapters, version checked against config ranges)
3. Parse all `.strux` files → AST
4. Validate AST
5. Call adapter `emit(ast, manifest, resolvedOptions)` → `GeneratedFile[]`
6. Call adapter `package(files)` → `PackageOutput`
7. Write package to `outputDir` (default: `.openstrux/build/`)
8. Run adapter's post-build hook if present (e.g., `prisma generate`)

**`strux init`:**
1. Detect installed packages from `package.json` (framework, ORM, validation lib, TS version)
2. Match detected stack against available adapter compatibility ranges
3. Prompt user to confirm or adjust
4. Write `strux.config.yaml`
5. Configure `tsconfig.json` path aliases for `@openstrux/build`
6. Add `.openstrux/` to `.gitignore`
7. Write starter `.strux` file (`src/strux/starter.strux`)
8. Run `strux build`

**`strux doctor`:**
1. Read `strux.config.yaml`
2. Check each dependency range against available adapter manifests
3. Verify `tsconfig.json` paths are configured correctly
4. Report: resolved (✓), no adapter (✗), closest match, suggestions

### 7. Documentation

**New docs to create (in `openstrux/docs/`):**
- `docs/getting-started.md` — end-to-end onboarding: install CLI → `strux init` → first `.strux` file → `strux build` → import in app code. Target audience: developer who has never seen OpenStrux.
- `docs/migration/from-loose-files.md` — for anyone using the current generator output. Step-by-step migration to package output.

**Existing docs to update:**
- `openstrux-spec/specs/modules/target-ts/generator.md` — output paths, adapter interface, package structure
- `openstrux-spec/specs/modules/target-ts/rods.md` — rod emitter changes (steps, not stubs)
- `openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md` — adapter contract updated
- `openstrux/CLAUDE.md` — mention new CLI commands and docs folder updates
- `openstrux-core` README — usage examples with `strux build`

## Risks / Trade-offs

**[Path aliases require tsconfig configuration]** → Mitigation: `strux init` handles this automatically. `strux doctor` verifies the configuration is correct. Next.js reads tsconfig paths natively. For other bundlers, `strux init` configures their alias mechanism. This is one extra setup step compared to `node_modules` injection, but it's automated and explicit — no hidden magic.

**[Rod chaining assumes linear pipelines]** → Mitigation: the implicit linear chain (ADR-007) covers the common case. Branching panels (`split` rod) emit a switch statement that dispatches to sub-chains. For v0.6, only linear chains and single-level splits need to produce complete code. Complex DAGs can fall back to step-level TODO comments with a clear diagnostic.

**[Config resolution without hub is limited]** → Mitigation: for v0.6, adapters are bundled with the CLI. The config is still validated against adapter compatibility ranges, but resolution is local. This is explicitly a stepping stone — hub-based resolution is future work.

**[Breaking change for existing generator consumers]** → Mitigation: the current generator has no external consumers beyond the conformance test suite. Migration is internal: update tests, update golden fixtures, update the grant-workflow use case. Document migration path in `docs/migration/from-loose-files.md` for future reference.

**[`.openstrux/build/` disappears on clean builds]** → Mitigation: `strux build` is an explicit build step, like `tsc` or `prisma generate`. CI pipelines run it before the app build. This is predictable and auditable — no implicit install hooks that may or may not execute.

## Open Questions

- Should `strux.config.yaml` support multiple output packages (e.g., separate `@openstrux/build-types` and `@openstrux/build-routes`) or always one package? Current decision: one package. Revisit if the single package grows too large.
- Should the generated output include its own test stubs (e.g., example test importing from the package) to help developers verify the setup? Leaning yes for onboarding.
- Should `strux init` support framework-specific bundler configurations beyond Next.js (Webpack alias, Vite alias, etc.) in v0.6, or defer to documentation? Leaning defer — Next.js reads tsconfig paths natively, which covers the v0.6 target.
