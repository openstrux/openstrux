## Why

The strux generator emits `STRUX-STUB: expression not lowered` for every transform, filter, guard, and projection rod. The author already expressed the logic in `.strux` using the SQL-like expression shorthand, but the generator throws it away — forcing the LLM (or human) to hand-write the equivalent TypeScript. This defeats the core value proposition of strux: write the what, generate the how. With expression lowering, `strux build` can generate the entire backend — reducing gap-fill to only test seed data.

## What Changes

- **Expression parser**: Replace `captureRawExpr` (raw text capture) with a structured expression parser that produces typed AST nodes (`PortableFilter`, `PortableProjection`, `PortableAgg`, `PortableGroupKey`, `FnRef`, `SourceSpecificExpr`) for all 8 expression forms defined in `expression-shorthand.md`.
- **AST nodes**: Add expression AST node types to `@openstrux/ast` — comparison, boolean logic, IN, BETWEEN, IS NULL, LIKE, EXISTS for filters; field list, exclude, rename, computed for projections; HAS/HAS ANY/HAS ALL for guard policies.
- **TypeScript lowering**: Update all Next.js adapter rod emitters (`transform.ts`, `filter.ts`, `guard.ts`, `aggregate.ts`, `group.ts`, `join.ts`, `split.ts`) to lower portable expressions to idiomatic TypeScript instead of emitting stubs.
- **FnRef wiring**: `fn: path` expressions generate `import { fn } from "path"` + call site — user writes the function body, generator wires it in.
- **Source-specific pass-through**: `sql:`, `mongo:`, `kafka:` prefixed expressions emit as comments or template literals (not lowered) for v0.6.0.
- **Conformance fixtures**: Golden fixtures (`.strux` → expected TypeScript), valid fixtures (all expression forms), invalid fixtures (malformed expressions with clear diagnostics).

## Capabilities

### New Capabilities

- `expression-lowering`: Parsing structured expression AST from shorthand syntax and lowering portable expressions to TypeScript in the Next.js generator adapter. Covers filter predicates, projections, aggregations, group keys, join conditions, sort, split routes, and guard policies.

### Modified Capabilities

_(none — expression-shorthand.md already specifies the source syntax; this change implements what the spec defines)_

## Impact

- **openstrux-core/packages/parser**: Major — new expression parser replaces raw text capture
- **openstrux-core/packages/ast**: New node types for all expression forms
- **openstrux-core/packages/generator**: All Next.js adapter rod emitters rewritten to lower expressions
- **openstrux-core/packages/validator**: Expression type checking against upstream source compatibility
- **openstrux-spec/conformance**: New golden/valid/invalid fixtures for expression lowering
- **openstrux (this repo)**: Benchmark prompt rewrite — openstrux path becomes "write .strux, compile, verify" with minimal gap-fill
- **Benchmark impact**: Gap-fill reduced from ~12 hand-written stubs to only `prisma/seeds/seed.ts`
