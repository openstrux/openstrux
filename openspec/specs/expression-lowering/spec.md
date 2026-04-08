# Spec: Expression Lowering

## Purpose

Defines how the parser and generator handle the v0.6.0 C-family expression grammar: structured AST production from shorthand syntax, code generation (lowering) to TypeScript, synonym normalization, and conformance fixture requirements.

## Requirements

### Requirement: Parser produces typed expression AST from shorthand syntax

The parser SHALL replace raw-text expression capture (`captureRawExpr`) with a structured expression parser that produces typed AST nodes for all portable expression forms. The parser SHALL detect the expression context from the arg name (`arg.predicate` → filter, `arg.fields` → projection, `arg.fn` → aggregation, `arg.key` → group key, `arg.on` → join condition, `arg.order` → sort, `arg.routes` → split, `arg.policy` → guard) and parse accordingly.

Expression syntax follows the v0.6.0 C-family grammar defined in `specs/expression-shorthand/expression-grammar-v060.md`.

#### Scenario: Filter predicate with comparison and boolean logic

- **WHEN** a `.strux` file contains `arg.predicate = country == "ES" && active == true`
- **THEN** the parser produces a `PortableFilter` AST node with an AND node containing two comparison children: `country == "ES"` and `active == true`

#### Scenario: Filter predicate with in operator

- **WHEN** a `.strux` file contains `arg.predicate = country in ["ES", "FR", "DE"]`
- **THEN** the parser produces a `PortableFilter` with a membership node: field `country`, values `["ES", "FR", "DE"]`, negated false

#### Scenario: Filter predicate with range operator

- **WHEN** a `.strux` file contains `arg.predicate = age in 18..65`
- **THEN** the parser produces a `PortableFilter` with a range node: field `age`, low `18`, high `65`, inclusive true

#### Scenario: Filter predicate with null check

- **WHEN** a `.strux` file contains `arg.predicate = deleted_at == null`
- **THEN** the parser produces a `PortableFilter` with a comparison node: field `deleted_at`, op `eq`, value `null`

#### Scenario: Filter with method call

- **WHEN** a `.strux` file contains `arg.predicate = email.endsWith("@miempresa.es")`
- **THEN** the parser produces a `PortableFilter` with a MethodCallNode: receiver `email`, method `endsWith`, args `["@miempresa.es"]`

#### Scenario: Filter with ternary

- **WHEN** a `.strux` file contains `arg.fields = [id, country == "ES" ? "domestic" : "international" as market]`
- **THEN** the parser produces a `PortableProjection` with a TernaryNode for the computed field

#### Scenario: Filter with null coalescing

- **WHEN** a `.strux` file contains `arg.fields = [id, nickname ?? full_name as display_name]`
- **THEN** the parser produces a `PortableProjection` with a NullCoalesceNode

#### Scenario: Filter with optional chaining

- **WHEN** a `.strux` file contains `arg.predicate = address?.country == "ES"`
- **THEN** the parser produces a `PortableFilter` with an OptionalChainNode accessing `address?.country`

#### Scenario: Projection with field list, exclude, rename, computed

- **WHEN** a `.strux` file contains `arg.fields = [id, email, address.country as country, amount * 1.21 as total]`
- **THEN** the parser produces a `PortableProjection` with include fields `id`, `email`, a rename `address.country → country`, and a computed field `amount * 1.21 → total`

#### Scenario: Aggregation with builtin functions

- **WHEN** a `.strux` file contains `arg.fn = [count(*) as total, sum(amount) as revenue]`
- **THEN** the parser produces a `PortableAgg` with two aggregation entries: `count(*)` aliased `total`, `sum(amount)` aliased `revenue`

#### Scenario: Group key with composite fields

- **WHEN** a `.strux` file contains `arg.key = country, city`
- **THEN** the parser produces a `PortableGroupKey` with fields `["country", "city"]`

#### Scenario: Group key with date function

- **WHEN** a `.strux` file contains `arg.key = country, year(created_at)`
- **THEN** the parser produces a `PortableGroupKey` with a field `country` and a `FnCallNode { fn: "year", args: [created_at] }`

#### Scenario: Join condition

- **WHEN** a `.strux` file contains `arg.on = left.user_id == right.id`
- **THEN** the parser produces a `PortableJoinCondition` with a comparison of `left.user_id` and `right.id`

#### Scenario: Sort with direction and nulls handling

- **WHEN** a `.strux` file contains `arg.order = score desc nulls last, id asc`
- **THEN** the parser produces a `PortableSort` with entries: `score DESC NULLS LAST` and `id ASC`

#### Scenario: Split routes

- **WHEN** a `.strux` file contains `arg.routes = { eu: country in ["ES", "FR"] \n us: country == "US" \n other: * }`
- **THEN** the parser produces a `PortableSplitRoutes` with named filter entries and a default `*` route

#### Scenario: Guard policy with collection method

- **WHEN** a `.strux` file contains `arg.policy = principal.roles.includesAny(["admin", "dpo"])`
- **THEN** the parser produces a `PortableGuardPolicy` with a MethodCallNode: receiver `principal.roles`, method `includesAny`, args `[["admin", "dpo"]]`

#### Scenario: Malformed expression produces diagnostic

- **WHEN** a `.strux` file contains `arg.predicate = country ==`
- **THEN** the parser produces a compile error with position info and expected token (e.g., "expected value after `==`")

#### Scenario: SQL synonym normalized with info diagnostic

- **WHEN** a `.strux` file contains `arg.predicate = country == "ES" AND active == true`
- **THEN** the parser normalizes to `country == "ES" && active == true`, produces the same AST as the canonical form, and emits an info diagnostic noting the normalization

#### Scenario: SQL IS NULL normalized

- **WHEN** a `.strux` file contains `arg.predicate = deleted_at IS NULL`
- **THEN** the parser normalizes to `deleted_at == null` and emits an info diagnostic

### Requirement: Expression AST node types on KnotValue

The AST package SHALL define expression node types as variants of the `KnotValue` discriminated union. These SHALL replace `{ kind: "raw-expr", text: "..." }` on rod arg values.

**Top-level expression kinds:** `portable-filter`, `portable-projection`, `portable-agg`, `portable-group-key`, `portable-join-condition`, `portable-sort`, `portable-split-routes`, `portable-guard-policy`, `fn-ref`, `source-specific-expr`

**Expression sub-nodes:**
- `CompareNode` — `{ field, op: eq|ne|gt|lt|gte|lte, value }`
- `BoolNode` — `{ op: and|or|not, children }`
- `MembershipNode` — `{ field, negated, values: [] }`
- `RangeNode` — `{ field, low, high, inclusive, halfOpen }`
- `TernaryNode` — `{ condition, then, else }`
- `NullCoalesceNode` — `{ left, right }`
- `OptionalChainNode` — `{ object, field }`
- `MethodCallNode` — `{ receiver, method, args }`
- `FnCallNode` — `{ fn, args }` — built-in function call
- `LambdaNode` — `{ param, body }` — for collection method predicates
- `ArithNode` — `{ op: add|sub|mul|div|mod, left, right }`
- `FieldRef` — `{ path: string[] }`
- `Literal` — `{ value: string|number|boolean|null }`
- `ArrayLit` — `{ elements: ExprNode[] }`

#### Scenario: FnRef node type

- **WHEN** a `.strux` file contains `arg.predicate = fn: policies/core.evaluate_custom`
- **THEN** the parser produces `{ kind: "fn-ref", module: "policies/core", function: "evaluate_custom" }`

#### Scenario: Source-specific expression node type

- **WHEN** a `.strux` file contains `arg.predicate = sql: age > 18 AND created_at > NOW()`
- **THEN** the parser produces `{ kind: "source-specific-expr", prefix: "sql", text: "age > 18 AND created_at > NOW()" }`

### Requirement: Generator lowers portable filter to TypeScript predicate

The Next.js adapter filter rod emitter SHALL lower `PortableFilter` AST nodes to TypeScript predicate functions. Operator mapping: `eq` → `===`, `ne` → `!==`, `and` → `&&`, `or` → `||`, `not` → `!`, membership → `.includes()`, negated membership → `!...includes()`, range → `>= low && <= high`, `== null` → `=== null`, `!= null` → `!== null`, method calls → direct method calls, optional chain → `?.`, null coalesce → `??`, ternary → `? :`.

#### Scenario: Simple comparison filter

- **WHEN** the generator processes `arg.predicate = country == "ES"`
- **THEN** it emits `(row) => row.country === "ES"`

#### Scenario: Boolean logic filter

- **WHEN** the generator processes `arg.predicate = country == "ES" && active == true`
- **THEN** it emits `(row) => row.country === "ES" && row.active === true`

#### Scenario: Membership filter

- **WHEN** the generator processes `arg.predicate = country in ["ES", "FR", "DE"]`
- **THEN** it emits `(row) => ["ES", "FR", "DE"].includes(row.country)`

#### Scenario: Range filter

- **WHEN** the generator processes `arg.predicate = age in 18..65`
- **THEN** it emits `(row) => row.age >= 18 && row.age <= 65`

#### Scenario: Null check filter

- **WHEN** the generator processes `arg.predicate = deleted_at == null`
- **THEN** it emits `(row) => row.deleted_at === null`

#### Scenario: Method call filter

- **WHEN** the generator processes `arg.predicate = email.endsWith("@example.es")`
- **THEN** it emits `(row) => row.email.endsWith("@example.es")`

#### Scenario: Optional chain filter

- **WHEN** the generator processes `arg.predicate = address?.country == "ES"`
- **THEN** it emits `(row) => row.address?.country === "ES"`

#### Scenario: Nested field access

- **WHEN** the generator processes `arg.predicate = address.country == "ES"`
- **THEN** it emits `(row) => row.address.country === "ES"`

### Requirement: Generator lowers portable projection to TypeScript field mapping

The Next.js adapter transform rod emitter SHALL lower `PortableProjection` AST nodes to TypeScript object mapping.

#### Scenario: Select fields

- **WHEN** the generator processes `arg.fields = [id, email, address.country]`
- **THEN** it emits `(input) => ({ id: input.id, email: input.email, country: input.address.country })`

#### Scenario: Rename fields

- **WHEN** the generator processes `arg.fields = [id, address.country as country]`
- **THEN** it emits `(input) => ({ id: input.id, country: input.address.country })`

#### Scenario: Computed fields

- **WHEN** the generator processes `arg.fields = [id, amount * 1.21 as total]`
- **THEN** it emits `(input) => ({ id: input.id, total: input.amount * 1.21 })`

#### Scenario: Ternary computed field

- **WHEN** the generator processes `arg.fields = [id, country == "ES" ? "domestic" : "international" as market]`
- **THEN** it emits `(input) => ({ id: input.id, market: input.country === "ES" ? "domestic" : "international" })`

#### Scenario: Null coalescing field

- **WHEN** the generator processes `arg.fields = [id, nickname ?? full_name as display_name]`
- **THEN** it emits `(input) => ({ id: input.id, display_name: input.nickname ?? input.full_name })`

### Requirement: Generator lowers guard policy to TypeScript access check

The Next.js adapter guard rod emitter SHALL lower `PortableGuardPolicy` AST nodes to TypeScript access-control checks. Method calls lower directly: `.includes()` → `.includes()`, `.includesAny()` → `.some(r => ...)`, `.includesAll()` → `.every(r => ...)`, context references (`principal.*`, `intent.*`, `element.*`) → parameter access.

#### Scenario: Role-based guard with includes

- **WHEN** the generator processes `arg.policy = principal.roles.includes("admin")`
- **THEN** it emits `principal.roles.includes("admin")`

#### Scenario: Guard with includesAny

- **WHEN** the generator processes `arg.policy = principal.roles.includesAny(["admin", "dpo"])`
- **THEN** it emits `["admin", "dpo"].some(r => principal.roles.includes(r))`

#### Scenario: Guard with includesAll

- **WHEN** the generator processes `arg.policy = principal.roles.includesAll(["viewer", "eu-region"])`
- **THEN** it emits `["viewer", "eu-region"].every(r => principal.roles.includes(r))`

#### Scenario: Combined guard with element-level check

- **WHEN** the generator processes `arg.policy = principal.roles.includes("analyst") && element.country in ["ES", "FR"]`
- **THEN** it emits `principal.roles.includes("analyst") && ["ES", "FR"].includes(element.country)`

### Requirement: Generator wires FnRef to TypeScript import and call

The Next.js adapter SHALL lower `FnRef` expressions to a file-level `import` statement plus a call site.

#### Scenario: FnRef in filter position

- **WHEN** the generator processes `arg.predicate = fn: policies/core.evaluate_custom`
- **THEN** it emits `import { evaluate_custom } from "policies/core"` at file level and `evaluate_custom(input)` at the call site

### Requirement: Source-specific expressions emit annotated stubs

The generator SHALL emit source-specific expressions as TypeScript comments preserving the original text, plus a throw statement.

#### Scenario: SQL expression pass-through

- **WHEN** the generator processes `arg.predicate = sql: age > 18 AND created_at > NOW()`
- **THEN** it emits `// Source-specific (sql): age > 18 AND created_at > NOW()` followed by `throw new Error("source-specific expression — manual implementation required")`

### Requirement: Synonym normalization emits info diagnostic

The parser SHALL normalize SQL/v0.5 synonyms to canonical C-family form and emit an info diagnostic (not error) noting the normalization.

#### Scenario: AND normalized to &&

- **WHEN** a `.strux` file contains `arg.predicate = country == "ES" AND active == true`
- **THEN** the parser produces the same AST as `country == "ES" && active == true` and emits an info diagnostic: `[INFO] Normalized: 'AND' → '&&' at line N, col M`

#### Scenario: IS NULL normalized

- **WHEN** a `.strux` file contains `arg.predicate = deleted_at IS NULL`
- **THEN** the parser produces the same AST as `deleted_at == null` and emits an info diagnostic

#### Scenario: Complex LIKE not normalized

- **WHEN** a `.strux` file contains `arg.predicate = name LIKE "test_%"`
- **THEN** the parser emits a compile error: "LIKE with mixed wildcards cannot be auto-normalized — use .matches() with glob or regex pattern"

### Requirement: Conformance fixtures for expression lowering

The conformance suite SHALL include golden fixtures, valid fixtures, and invalid fixtures for the v0.6.0 expression grammar.

#### Scenario: Golden fixture for filter lowering

- **WHEN** the conformance golden fixture `expression-filter-lowering.strux` is compiled
- **THEN** the generated TypeScript matches the expected output file exactly

#### Scenario: Valid fixture for all expression forms

- **WHEN** each valid conformance fixture is parsed
- **THEN** the parser produces zero errors and the correct AST node type

#### Scenario: Invalid fixture for malformed expression

- **WHEN** an invalid conformance fixture with a malformed expression is parsed
- **THEN** the parser produces a diagnostic with the expected error code and position
