## 1. Expression AST Node Types

- [x] 1.1 Define top-level expression KnotValue kinds in `packages/ast`: `portable-filter`, `portable-projection`, `portable-agg`, `portable-group-key`, `portable-join-condition`, `portable-sort`, `portable-split-routes`, `portable-guard-policy`, `fn-ref`, `source-specific-expr`
- [x] 1.2 Define sub-node types for all expression forms: `CompareNode` (field, op: eq|ne|gt|lt|gte|lte, value), `BoolNode` (op: and|or|not, children), `MembershipNode` (field, negated, values), `RangeNode` (field, low, high, inclusive, halfOpen), `TernaryNode` (condition, then, else), `NullCoalesceNode` (left, right), `OptionalChainNode` (object, field), `MethodCallNode` (receiver, method, args), `FnCallNode` (fn, args), `LambdaNode` (param, body), `ArithNode` (op, left, right), `FieldRef` (path), `Literal`, `ArrayLit`
- [x] 1.3 Define sub-node types for projection: `IncludeField`, `ExcludeField`, `RenameField`, `ComputedField` (expression + alias)
- [x] 1.4 Define `FnRef` node: `{ kind: "fn-ref", module: string, function: string }`
- [x] 1.5 Define `SourceSpecificExpr` node: `{ kind: "source-specific-expr", prefix: string, text: string }`

## 2. Synonym Normalizer

- [x] 2.1 Create `packages/parser/src/synonym-normalizer.ts` with `normalizeSynonyms(rawText: string): { normalized: string, diagnostics: InfoDiagnostic[] }` — pre-pass before expression parsing
- [x] 2.2 Implement token-level synonym table: `AND`→`&&`, `OR`→`||`, `NOT x`→`!x`, `IS NULL`→`== null`, `IS NOT NULL`→`!= null`, `BETWEEN x AND y`→`in x..y`, `x NOT IN (...)`→`x !in [...]`, `HAS "x"`→`.includes("x")`, `HAS ANY (...)`→`.includesAny([...])`, `HAS ALL (...)`→`.includesAll([...])`, `COALESCE(a,b)`→`a ?? b`, `EXISTS field`→`field != null`, `CASE WHEN c THEN a ELSE b END`→`c ? a : b`
- [x] 2.3 Implement simple LIKE normalization: `LIKE "%foo"` → `.endsWith("foo")`, `LIKE "foo%"` → `.startsWith("foo")`, `LIKE "%foo%"` → `.contains("foo")`
- [x] 2.4 Implement complex LIKE / multi-branch CASE detection: emit compile error with suggestion (`.matches()` / nested ternary) instead of normalizing
- [x] 2.5 Implement case normalization for built-in identifiers: normalize `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`, `FIRST`, `LAST`, `COLLECT`, `DISTINCT`, `ASC`, `DESC`, `AS`, `IN` to canonical camelCase/lowercase silently (no diagnostic)
- [x] 2.6 Wire synonym normalizer as pre-pass in `parseExpression`: run before the recursive-descent parser, merge info diagnostics into result

## 3. Expression Parser

- [x] 3.1 Create `packages/parser/src/expression-parser.ts` with `parseExpression(rawText: string, context: ExpressionContext): ParseResult<KnotValue>`
- [x] 3.2 Implement prefix detection: no prefix → portable, `sql:`/`mongo:`/`kafka:` → source-specific, `fn:` → FnRef, `opa:`/`cedar:` → external policy ref
- [x] 3.3 Implement portable filter parser: C-family operators (`==`, `!=`, `>`, `<`, `>=`, `<=`), boolean logic (`&&`, `||`, `!`), `in`/`!in` for membership and ranges (`x..y`, `x..<y`), `??` null coalescing, `?.` optional chaining, `? :` ternary, method calls (`.startsWith()`, `.endsWith()`, `.contains()`, `.matches()`, `.includes()`, `.includesAny()`, `.includesAll()`, `.any()`, `.all()`), built-in functions (`env()`, `now()`, `year()`, `month()`, `day()`, `hour()`, `dateDiff()`, `dateAdd()`, `dateTrunc()`, `abs()`, `round()`, `floor()`, `ceil()`, `pow()`, `sqrt()`, `int()`, `float()`, `str()`, `bool()`, `coalesce()`, `len()`), parenthesized sub-expressions, nested field access, array index, lambda expressions (`x => expr`)
- [x] 3.4 Implement portable projection parser: field list `[...]`, exclude with `-` prefix, rename with `as`, computed fields with full expression grammar (arithmetic, ternary, null-coalesce, method calls, built-in functions)
- [x] 3.5 Implement portable aggregation parser: built-in aggregation functions (`count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `collect`), `distinct` modifier, multiple aggregations with `[...]` and `as` aliases
- [x] 3.6 Implement portable group key parser: single/composite fields, computed keys with built-in functions
- [x] 3.7 Implement portable join condition parser: `left.field == right.field` with `&&` for composite
- [x] 3.8 Implement portable sort parser: field + `asc`/`desc` + `nulls first`/`nulls last`
- [x] 3.9 Implement split routes parser: `{ name: filter_expr \n ... }` with `*` default
- [x] 3.10 Implement guard policy parser: same expression grammar as filter; context references (`principal.*`, `intent.*`, `element.*`, `scope.*`) treated as field paths
- [x] 3.11 Integrate expression parser into main parser: replace `captureRawExpr` calls with `parseExpression` for expression-valued args
- [x] 3.12 Implement error reporting: position info, expected token, clear diagnostic messages for malformed expressions

## 4. TypeScript Lowering — Next.js Adapter

- [x] 4.1 Create shared `packages/generator/src/adapters/nextjs/rods/expression-lowerer.ts` with `lowerExpr(node): string` visitor for: `CompareNode` (`===`/`!==`/`>`/`<`/`>=`/`<=`), `BoolNode` (`&&`/`||`/`!`), `MembershipNode` (`.includes()`), `RangeNode` (`>= low && <= high`), `TernaryNode` (`? :`), `NullCoalesceNode` (`??`), `OptionalChainNode` (`?.`), `MethodCallNode` (direct passthrough), `FnCallNode` (built-in dispatch), `ArithNode` (`+`/`-`/`*`/`/`/`%`), `FieldRef` (dot path), `Literal`, `ArrayLit`
- [x] 4.2 Rewrite `filter.ts`: lower `PortableFilter` to `(row) => <predicate>` using shared lowerer
- [x] 4.3 Rewrite `transform.ts`: lower `PortableProjection` to `(input) => ({ field: input.field, ... })`, handle exclude (spread + omit), rename, computed (full expression lowering)
- [x] 4.4 Rewrite `guard.ts`: lower `PortableGuardPolicy` using shared lowerer; lower `MethodCallNode` with method `includesAny` → `.some(r => ...)`, `includesAll` → `.every(r => ...)`
- [x] 4.5 Implement `aggregate.ts` lowering: `count(*)` → `.length`, `sum` → `reduce` sum, `avg` → `reduce` avg, `min`/`max` → `reduce` min/max, `first`/`last` → index access, `collect` → identity, `distinct` modifier → `new Set()`
- [x] 4.6 Implement `group.ts` lowering: group key → `Map` grouping logic with key expression lowering
- [x] 4.7 Implement `join.ts` lowering: join condition → nested loop or Map-based join
- [x] 4.8 Implement `split.ts` lowering: split routes → chained if/else with filter predicates per route
- [x] 4.9 Implement `FnRef` lowering across all rod emitters: emit `import { fn } from "module"` at file level and `fn(input)` at call site
- [x] 4.10 Implement source-specific pass-through: emit `// Source-specific (prefix): <text>` comment + `throw new Error("source-specific expression — manual implementation required")`

## 5. Conformance Fixtures

- [x] 5.1 Add valid conformance fixtures: one `.strux` per expression form (filter, projection, aggregation, group, join, sort, split, guard) exercising all v0.6.0 operators (C-family, method calls, built-in functions)
- [x] 5.2 Add valid conformance fixtures for synonym normalization: `.strux` files using SQL/v0.5 forms that should normalize cleanly with info diagnostics
- [x] 5.3 Add invalid conformance fixtures: malformed expressions with expected diagnostic codes (incomplete comparison, unmatched parentheses, unknown operator, complex LIKE, multi-branch CASE)
- [x] 5.4 Add golden conformance fixtures: `.strux` with expressions → expected TypeScript output for filter, transform, guard, and aggregation lowering
- [x] 5.5 Add unit tests for synonym normalizer: one test per synonym, complex LIKE/CASE rejection, case normalization
- [x] 5.6 Add unit tests for expression parser: one test per operator/form, edge cases (deeply nested boolean, multi-level field access, lambda in collection method, chained method calls)
- [x] 5.7 Add unit tests for expression lowerer: verify TypeScript output matches expected strings for each operator mapping

## 6. Benchmark Prompt Update (openstrux repo)

- [x] 6.1 Rewrite `OPENSTRUX_PROMPT` in `benchmarks/runner/generate.ts` to frame task as "express entire backend in .strux, compile, verify" with gap-fill reduced to `prisma/seeds/seed.ts` only
- [x] 6.2 Rewrite `benchmarks/prompts/openstrux/generate.md` (in UC repo) — update Step 3 to list all panels, Step 5 to reflect minimal gap-fill, Output section to show everything generated
