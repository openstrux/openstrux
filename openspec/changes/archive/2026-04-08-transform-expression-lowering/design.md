## Context

The Openstrux expression-shorthand spec (`expression-shorthand.md`) defines a SQL-like expression language for filter predicates, projections, aggregations, group keys, join conditions, sort, split routes, and guard policies. The parser currently captures these expressions as raw text (`captureRawExpr` at `parser.ts:1073`) — preserving the source string but discarding all structure. The generator rod emitters (`transform.ts`, `filter.ts`, `guard.ts`) receive these raw-text nodes and emit `STRUX-STUB: expression not lowered` placeholders.

This means a `.strux` file that fully expresses business logic still produces a backend where every transform, filter, and guard is a `throw new Error("not implemented")`. The LLM must hand-write the TypeScript equivalent of logic already declared in strux.

Three packages in openstrux-core are affected: parser (parse expressions), ast (new node types), generator (lower to TypeScript).

## Goals / Non-Goals

**Goals:**
- Parse all 8 portable expression forms into typed AST nodes
- Lower portable expressions to idiomatic TypeScript in the Next.js adapter
- Wire `FnRef` (`fn: path`) to TypeScript imports
- Pass through source-specific expressions (`sql:`, `mongo:`, `kafka:`) as annotated strings
- Add conformance fixtures (golden, valid, invalid) for expression lowering
- Reduce benchmark gap-fill from ~12 hand-written stubs to only `prisma/seeds/seed.ts`

**Non-Goals:**
- Source-specific expression lowering (SQL pushdown, Mongo query generation) — deferred post-v0.6.0
- `COLLECT` aggregation and `CASE/WHEN/THEN/ELSE/END` conditional — reserved in spec, defer if complex
- Pushdown optimization / fusion chain analysis — spec §9.2-9.4 describes this but it's a separate concern from lowering
- Other generator adapters (only Next.js for v0.6.0)

## Decisions

### D1: Expression AST as a sum type on KnotValue

**Decision**: Add expression variants to the existing `KnotValue` discriminated union rather than creating a parallel type hierarchy.

**Rationale**: Rod `cfg.*` and `arg.*` values are already typed as `KnotValue`. Adding `{ kind: "portable-filter", ... }`, `{ kind: "portable-projection", ... }`, etc. keeps the parser → AST → generator pipeline uniform. The alternative — a separate `Expression` type — would require bridging at every rod emitter.

**Alternatives considered**: Separate `Expression` hierarchy with a wrapper `KnotValue.expression` variant. Rejected because it adds indirection without benefit — the expression IS the value of the arg.

### D2: Recursive-descent expression parser as a separate module

**Decision**: Implement a new `parseExpression(rawText: string, context: ExpressionContext)` function in `packages/parser/src/expression-parser.ts` that the main parser calls after detecting an expression-valued arg.

**Rationale**: Expression parsing is a self-contained grammar (operator precedence, parentheses, function calls) distinct from the block-structured `.strux` grammar. Keeping it in a separate module makes it testable in isolation and avoids bloating the 1200-line main parser.

**Context detection**: The main parser knows the expression context from the arg name — `arg.predicate` → filter, `arg.fields` → projection, `arg.fn` → aggregation, `arg.key` → group, `arg.on` → join, `arg.order` → sort, `arg.routes` → split, `arg.policy` → guard. The expression parser uses this context to select the right sub-grammar.

### D3: Lowering as a visitor on expression AST nodes

**Decision**: Each rod emitter receives the typed expression AST and lowers it to TypeScript using a `lowerExpr(node): string` visitor. The visitor is shared across emitters (e.g., comparison lowering is the same in filter and guard).

**Rationale**: Expression lowering follows the same pattern everywhere — `==` → `===`, `IN` → `.includes()`, `IS NULL` → `=== null`, `LIKE` → regex, `AND/OR/NOT` → `&&/||/!`. A shared visitor avoids duplicating this logic across 7 rod emitters. Rod-specific concerns (guard's `HAS`/`HAS ANY`/`HAS ALL`, projection's field mapping) are handled by rod-specific extensions.

### D4: FnRef generates import + call, not inline code

**Decision**: `fn: module/path.function_name` lowers to `import { function_name } from "module/path"` at the file level plus a call site `function_name(input)` at the expression position.

**Rationale**: The function body is user-written code. Strux wires it in but doesn't generate it. This matches the existing pattern for custom rods and keeps the generated code readable. The import path is resolved relative to the project root, following TypeScript path resolution.

### D5: Source-specific expressions emit as annotated comments

**Decision**: `sql:`, `mongo:`, `kafka:` prefixed expressions lower to a TypeScript comment with the raw text plus a `throw new Error("source-specific expression — manual implementation required")`.

**Rationale**: Lowering source-specific expressions requires adapter-specific code generators (SQL dialect, Mongo query builder). This is out of scope for v0.6.0. The comment preserves the author's intent for manual implementation, and the throw ensures tests fail if the stub isn't replaced.

## Risks / Trade-offs

**[Operator precedence bugs]** → Extensive golden fixture coverage. The expression parser must handle SQL precedence (NOT > AND > OR) with parentheses override. Mitigation: port precedence rules from the EBNF in grammar.md §7 and test every combination.

**[Incomplete expression coverage]** → Start with the grant-workflow benchmark as the forcing function. If the benchmark's `.strux` files compile and the generated TypeScript passes tests, coverage is sufficient for v0.6.0. Exotic forms (COLLECT, CASE/WHEN) can be deferred.

**[Breaking change to KnotValue]** → All code that pattern-matches on `KnotValue.kind` must handle new variants. Mitigation: the validator and generator already have exhaustive switches — the TypeScript compiler will flag missing cases.

**[Expression parser error messages]** → Raw text expressions currently always "parse" (they're just strings). Structured parsing will surface errors that were previously silent. Mitigation: clear error messages with position info and expected token, matching the main parser's diagnostic style.
