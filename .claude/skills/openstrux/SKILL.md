---
name: openstrux
description: Working with the Openstrux language and CLI — writing .strux files, running strux build, debugging compile errors, and the build-to-gap-fill workflow
allowed-tools: Read, Glob, Grep, Bash
---

# Openstrux Skill

Activate this skill when:
- Writing or editing `.strux` files
- Running `strux build` or `npx strux build`
- Debugging strux compile errors or diagnostics
- A repo contains `strux.config.yaml`
- Implementing the backend gap-fills after `strux build`

---

## Step 1 — Read the language reference

Before writing any `.strux` source, read the live reference files in this order:

1. **`openstrux-lang/syntax-reference.md`** (or `../openstrux-spec/docs/syntax-reference.md` if not local) — compact, self-sufficient reference covering type forms, panel structure, shorthand rules, rod taxonomy, expressions, decorators, context inheritance.
2. **`openstrux-lang/examples/`** — concrete `.strux` files that parse and typecheck cleanly:
   - `p0-domain-model.strux` — types + panel for a domain model (start here)
   - `v003-panel-shorthand.strux` — shorthand syntax (no `@rod`, no `cfg./arg.` prefix)
   - `v020-validate-schema-ref.strux` — validate rod with SchemaRef
   - `v010-context-named-source.strux` — named `@source` from context
3. **Deep specs** — load only when reference + examples are insufficient:
   - `openstrux-lang/grammar.md` — full EBNF
   - `openstrux-lang/type-system.md` — union/record/enum, type paths
   - `openstrux-lang/panel-shorthand.md` — shorthand derivation rules
   - `openstrux-lang/config-inheritance.md` — context cascade semantics

Do not rely on training data for Openstrux syntax — always read the live files.

---

## Step 2 — Verify project setup

Before writing `.strux` files or running a build:

```bash
cat strux.config.yaml        # verify source globs and output dir
npx strux --help             # confirm CLI is available
```

`strux.config.yaml` should have:
- `sourceGlobs` including `pipelines/**/*.strux` and `openspec/specs/**/*.strux`
- `outputDir` set to `.openstrux/build`

If `npx strux` is not available but `.openstrux/cli/strux.mjs` exists (injected by benchmark runner):
```bash
node .openstrux/cli/strux.mjs build --explain
```

The `node_modules/.bin/strux` wrapper delegates to this bundled file when present.

---

## Step 3 — Write `.strux` source

Use **shorthand syntax** (no `@rod` keyword, no `cfg./arg.` prefix). Leverage context cascade — panels should declare only the delta from `strux.context`.

Typical project layout:
```
strux.context                  # project-wide: controller, DPO, named @source/@target
pipelines/strux.context        # domain overrides: narrower access, domain sources
openspec/specs/*.strux         # @type definitions for domain entities
pipelines/<domain>/*.strux     # pipeline panels
```

---

## Step 4 — Build and interpret output

```bash
npx strux build --explain
```

`--explain` prints what each panel compiles to. Zero diagnostics = clean build.

**What `strux build` generates** (into `.openstrux/build/`):
- TypeScript type definitions (from `@type` declarations)
- Zod schemas (from `@type` + constraints)
- Prisma schema fragments (from db-connected panels)
- Route handler scaffolds (from `receive`/`respond` panels)
- Prisma client re-export

**Import alias:** `@openstrux/build/*` is a preconfigured tsconfig path alias pointing to `.openstrux/build/`. Use it in gap-fill implementations:
```typescript
import type { Submission } from "@openstrux/build/types";
```

**If errors occur:** read the diagnostic message, fix the `.strux` source, rebuild. Diagnostics reference spec codes (e.g. `E-SNAP-001`, `E-TYPE-042`).

---

## Step 5 — Gap-fill remaining stubs

After a successful `strux build`, hand-write the TypeScript stubs that the compiler doesn't generate:

| Gap-fill | Location | Notes |
|----------|----------|-------|
| Service logic | `src/server/services/` | Business rules, orchestration |
| Policy functions | `src/policies/index.ts` | Pure functions: evaluateEligibility, createBlindedPacket, isValidTransition, getNextStatus |
| DAL / session | `src/lib/dal.ts` | verifySession — extract principal from headers |
| Auth-aware routes | `src/app/api/*/route.ts` | Call verifySession, return 401/403 before business logic |
| Seed | `prisma/seeds/seed.ts` | Upsert fixtures; idempotent |

The `.strux` source defines the domain model and data flows; the TypeScript gap-fills implement contract stubs that tests import.

---

## Notes

- `.openstrux/build/` is generated — do not commit it (should be in `.gitignore`)
- `strux.context` files are committed; `.strux` panels are committed
- The Openstrux language is AI-native and token-efficient — prefer shorthand syntax
- This skill covers language + CLI only; benchmark runner workflow is in `CLAUDE.md`
