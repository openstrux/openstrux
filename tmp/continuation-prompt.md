# Continuation: transform-expression-lowering change + benchmark prompt rewrite

Two tasks, in order. Both in the openstrux repo.

---

## Task 1 — Create openspec change `transform-expression-lowering`

Use `/opsx:propose transform-expression-lowering` to create the change with all artifacts in one step.

### Problem

The `transform` rod emitter in openstrux-core currently emits `STRUX-STUB: expression not lowered` for every transform. This means the entire body of every transform, filter predicate, guard policy, and projection is a `throw new Error("not implemented")` stub that the LLM must hand-write in TypeScript. This defeats the purpose of strux — the author already expressed the logic in `.strux` but the generator throws it away.

The expression-shorthand spec (`openstrux-spec/specs/core/expression-shorthand.md`) defines a rich SQL-like expression language that the parser already captures as `raw-expr` text nodes. The gap is between parsing (raw text preserved) and generation (raw text not lowered to TypeScript).

### What needs to happen

**Parser (openstrux-core/packages/parser):**
- Parse `raw-expr` nodes into structured expression AST nodes: `PortableFilter`, `PortableProjection`, `FnRef`, `SourceSpecificExpr`
- The parser already captures expressions as raw text (see `parser.ts:1073` — `captureRawExpression`). This needs to be replaced with a proper expression parser that produces typed AST nodes.
- Handle all 8 expression forms from expression-shorthand.md: filter, projection, aggregation, group key, join condition, sort, split routes, guard policy.

**AST (openstrux-core/packages/ast):**
- Add expression AST node types: `PortableFilter` (comparison, boolean logic, IN, BETWEEN, IS NULL, LIKE, EXISTS), `PortableProjection` (field list, exclude, rename, computed), `FnRef` (function reference — `fn: path`), `SourceSpecificExpr` (prefixed — `sql:`, `mongo:`)
- These go on rod cfg/arg values where today there's `{ kind: "raw-expr", text: "..." }`

**Generator — Next.js adapter (openstrux-core/packages/generator/src/adapters/nextjs/rods/):**
- `transform.ts`: Lower `PortableProjection` to TypeScript field mapping (`{ id: input.id, country: input.address.country }`), computed fields to expressions, `CASE/WHEN` to ternaries. Lower `FnRef` to import + call.
- `filter.ts`: Lower `PortableFilter` to TypeScript predicate function (`(row) => row.country === "ES" && row.active`). Lower `IN` to `.includes()`, `BETWEEN` to range check, `IS NULL` to `=== null`, `LIKE` to regex.
- `guard.ts`: Lower guard policy expressions to access-control checks (`if (!principal.roles.includes("admin")) ...`). `HAS` → `.includes()`, `HAS ANY` → `.some()`, `HAS ALL` → `.every()`.
- `aggregate.ts`, `group.ts`, `join.ts`, `split.ts`: Same pattern — lower portable expressions to TypeScript equivalents.
- `FnRef` in any position: emit `import { fn } from "path"` + call.

**Conformance:**
- Golden fixtures: `.strux` with expressions → expected TypeScript output
- Valid fixtures: all expression forms parse cleanly
- Invalid fixtures: malformed expressions produce clear diagnostics

### Scope boundaries

- Portable expressions only for v0.6.0. Source-specific (`sql:`, `mongo:`) are pass-through strings — emit as comments or template literals, not lowered.
- `FnRef` (`fn: path`) resolves to a TypeScript import — the function body is user-written, but the wiring is generated.
- `COLLECT` and `CASE/WHEN/THEN/ELSE/END` are reserved in the spec but can be deferred if complex.

### Why this matters for benchmarks

With expression lowering, the openstrux benchmark path becomes:
1. Write `.strux` files expressing domain model, pipelines, business logic, policies, privacy
2. Run `strux build` — generates ALL backend code: Prisma schema, Zod schemas, route handlers, service logic, policy enforcement, privacy processing
3. Gap-fill is reduced to ONLY: `prisma/seeds/seed.ts` (test fixtures)

This is the promise of strux: **write the what, generate the how.**

### Affected repos

- **openstrux-spec**: possibly grammar.md expression EBNF additions (may already be complete), new conformance fixtures
- **openstrux-core**: parser (expression parser), AST (expression nodes), generator (all rod emitters), validator (expression type checking)
- **openstrux**: benchmark prompt update (Task 2 below)

---

## Task 2 — Rewrite benchmark prompt for full backend generation

After the openspec change is created, update the benchmark prompt and `generate.md` to reflect that strux generates the entire backend.

### Files to modify

**`benchmarks/runner/generate.ts`** — rewrite `OPENSTRUX_PROMPT` (lines 303-379):

The new prompt should:
- Frame the task as "express the entire backend in `.strux`, compile, verify" — not "write .strux then hand-code the rest"
- Match the same objectives as `DIRECT_PROMPT` (same stubs, same acceptance criteria, same tests)
- List ALL backend stubs (same list as DIRECT_PROMPT step 3 — schemas, policies, services, all route handlers, audit)
- Make clear that `strux build` generates: Prisma schema, Zod schemas, route handlers with full business logic, policy enforcement, privacy processing
- Gap-fill section should be ONLY `prisma/seeds/seed.ts` (test fixtures not expressible in strux)
- Keep hard constraints identical to DIRECT_PROMPT
- Keep the `.strux files MUST be written` constraint

Key structure:
```
1. Read OpenSpec change specs (same as direct)
2. Learn Openstrux language (read openstrux-lang/)
3. Read domain specs (same as direct)
4. Read stubs — same full list as direct path
5. Write .strux source files:
   - @type definitions with persistence annotations (@pk, @relation, @timestamps, etc.)
   - @context with privacy framework, access policies, named sources
   - @panel pipelines: intake, eligibility, proposals CRUD, audit, review, validation
   - Express ALL business logic in strux: eligibility rules as guard policies,
     blinding as private-data rod, state transitions as guard + transform,
     CRUD as read-data/write-data
6. Run strux build --explain → generates everything
7. Gap-fill: only prisma/seeds/seed.ts
8. Run unit tests
9. Fix and repeat
```

**`benchmarks/prompts/openstrux/generate.md`** (in openstrux-uc-grant-workflow repo):

Rewrite Step 5 "Fill gaps" to reflect that gap-fill is just the seed file. Remove all references to hand-writing schemas, services, policies, or route handlers. Update the Output section to show that everything except seeds comes from strux build.

Update Step 3 to list ALL panels needed (not just intake + eligibility):
- `pipelines/intake/p1-intake.strux` — intake pipeline
- `pipelines/eligibility/p2-eligibility.strux` — eligibility pipeline
- `pipelines/proposals/proposals.strux` — proposals CRUD (list, get, assign, review, validate)
- `pipelines/audit/audit.strux` — audit event log

Update Step 1 to remove "it is included in the prompt" (already done in this session).

### What NOT to change

- `DIRECT_PROMPT` — leave as-is (it's the baseline for comparison)
- `assemblePrompt` function — the webMode-conditional syntax injection is already correct
- Hard constraints — keep identical between both prompts
- Spec bundle injection (`SPEC_BUNDLE_CORE`, `SPEC_BUNDLE_EXAMPLES`) — keep as-is
- Conformance examples — keep the existing set, add `v030-type-field-annotations.strux` if not already there

### Context from this session

Changes already made in this session (uncommitted):
- `generate.ts`: syntax injection now conditional on `--web` mode (line 585)
- `generate.ts`: DIRECT_PROMPT stub list expanded to all backend routes, added `prisma/seeds/seed.ts`
- `generate.md` (UC repo): Step 1 removed "it is included in the prompt"
- `generate.md` (UC repo): Step 5 Prisma section updated — `prisma/schema.prisma` is generated, not hand-written
- `generate.md` (UC repo): gap-fill list removed `dal.ts` (already implemented)
- `docs/roadmap/backlog.md`: added deferred items from type-persistence-annotations, cleaned implemented items
- `openstrux-spec/.github/workflows/ci.yml`: fixed Node.js 24 env, removed `changes/README.md` check
- `openstrux/.github/workflows/ci.yml`: fixed Node.js 24 env

These changes are uncommitted across three repos (openstrux, openstrux-spec, openstrux-uc-grant-workflow). Prepare commit messages following the project commit format (see CLAUDE.md) but do NOT commit until explicitly asked.

### Key files to read for context

- `openstrux-spec/specs/core/expression-shorthand.md` — the full expression language spec
- `openstrux-spec/specs/core/syntax-reference.md` — rod taxonomy, transform/filter/guard signatures
- `openstrux-core/packages/parser/src/parser.ts:1073` — current `captureRawExpression` (raw text, no AST)
- `openstrux-core/packages/generator/src/adapters/nextjs/rods/transform.ts` — current stub emitter
- `openstrux-core/packages/generator/src/adapters/nextjs/rods/filter.ts` — check if also stubs
- `openstrux-core/packages/generator/src/adapters/nextjs/rods/guard.ts` — check if also stubs
- `benchmarks/runner/generate.ts:251-379` — both DIRECT_PROMPT and OPENSTRUX_PROMPT
- `benchmarks/prompts/openstrux/generate.md` (in UC repo) — prompt-mode path instructions
