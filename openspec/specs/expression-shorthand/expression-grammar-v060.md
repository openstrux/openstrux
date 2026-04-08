# OpenStrux Expression Grammar v0.6.0

## Design Principle

One grammar. C-family operators (JS/TS/Python intersection), method-call
syntax for operations on values, function-call syntax for transforms.
The same expression grammar works in every context — filter, projection,
guard, aggregation. Context determines what the expression *returns*,
not what syntax is available.

**Why C-family, not SQL:**

1. `.strux` block structure is already language-like, not query-like
2. Expressions must cover business logic (conditionals, string ops, math), not just data predicates
3. C-family operators are the universal intersection: JS, TS, Python, Java, Go, C#, Rust all share `==`, `!=`, `&&`, `||`, `!`, `? :`
4. LLMs know both SQL and C-family — no learning-curve difference
5. Eliminates the hybrid problem (mixing `==` with `IS NULL`, `AND` with `BETWEEN ... AND`)

**Token efficiency:** Strictly better or equal. `&&` = `AND` (1 token each),
but `== null` < `IS NULL` (reuses existing operator), `? a : b` < `CASE WHEN ... THEN ... ELSE ... END` (3 tokens vs 5 keywords).

---

## Casing & Tolerance

### Canonical form: camelCase

Everything is camelCase. Single-word names are naturally lowercase.

```
count(*)                         // not COUNT(*)
sum(amount)                      // not SUM(amount)
dateDiff("days", a, b)           // not DateDiff, DATEDIFF
name.startsWith("x")            // not StartsWith, STARTSWITH
asc / desc / nulls last          // not ASC, DESC, NULLS LAST
as                               // not AS
distinct                         // not DISTINCT
```

This matches the rest of `.strux` (`@panel`, `@rod`, `arg.predicate`, `cfg.source` — all lowercase/camelCase).

### Case-tolerant parsing

The parser/validator SHALL accept **any casing** of known identifiers and
normalize to camelCase without error. All of these parse identically:

```
COUNT(*)   Count(*)   count(*)   cOuNt(*)   →  count(*)
SUM(x)     Sum(x)     sum(x)                →  sum(x)
DISTINCT   Distinct   distinct               →  distinct
ASC        Asc        asc                    →  asc
DESC       Desc       desc                   →  desc
AS         As         as                     →  as
```

This applies to: all built-in functions, aggregation names, keywords (`as`,
`asc`, `desc`, `nulls`, `first`, `last`, `distinct`, `in`), and method names.

Field names and string literals remain case-sensitive (they reference schema fields).

### Common-synonym normalization

The parser SHALL recognize common equivalent forms from SQL and other
languages, normalize them to the canonical C-family form, and emit an
**info diagnostic** (not error, not warning) noting the normalization:

| Written (synonym) | Normalized to | Note |
|---|---|---|
| `AND` / `and` | `&&` | SQL boolean |
| `OR` / `or` | `\|\|` | SQL boolean |
| `NOT x` / `not x` | `!x` | SQL negation |
| `IS NULL` / `is null` | `== null` | SQL null check |
| `IS NOT NULL` | `!= null` | SQL null check |
| `BETWEEN x AND y` | `in x..y` | SQL range |
| `x NOT IN (...)` | `x !in [...]` | SQL negated membership |
| `LIKE "%foo"` | `.endsWith("foo")` | SQL pattern (simple suffix) |
| `LIKE "foo%"` | `.startsWith("foo")` | SQL pattern (simple prefix) |
| `LIKE "%foo%"` | `.contains("foo")` | SQL pattern (simple contains) |
| `COALESCE(a, b)` | `a ?? b` | SQL coalesce (2-arg) |
| `COALESCE(a, b, c)` | `coalesce(a, b, c)` | SQL coalesce (3+ arg, kept as function) |
| `EXISTS field` | `field != null` | SQL existence |
| `HAS "x"` | `.includes("x")` | v1 guard syntax |
| `HAS ANY (...)` | `.includesAny([...])` | v1 guard syntax |
| `HAS ALL (...)` | `.includesAll([...])` | v1 guard syntax |
| `CASE WHEN c THEN a ELSE b END` | `c ? a : b` | SQL conditional (simple) |

**Rules:**
- Only unambiguous, mechanical translations — if the synonym has multiple
  possible interpretations, emit a compile error instead
- `LIKE` with complex patterns (multiple `%`, `_` wildcards) → not normalized,
  suggest `.matches()` with glob/regex instead
- `CASE` with multiple `WHEN` branches → not normalized, suggest nested ternary
- Info diagnostic includes the original form for traceability
- This makes migration from v1 (SQL-hybrid) to v2 seamless — existing `.strux`
  files keep working, just get normalized

---

## Core Operators

### Comparison

```
==   !=   >   <   >=   <=
```

All types. Null-safe: `x == null`, `x != null`. No special `IS NULL` form.

### Boolean

```
&&   ||   !
```

Standard precedence: `!` > `&&` > `||`. Parentheses override.

### Arithmetic

```
+   -   *   /   %
```

Numeric types. `+` also concatenates strings (like JS/Python).

### Ternary

```
condition ? value_if_true : value_if_false
```

Replaces `CASE WHEN ... THEN ... ELSE ... END`. Nestable:

```
score >= 90 ? "A" : score >= 70 ? "B" : "C"
```

### Null coalescing

```
??
```

`nickname ?? full_name` — returns left side if non-null, else right side.
Replaces `COALESCE(a, b)`.

### Optional chaining

```
?.
```

`address?.country` — returns `null` if `address` is null instead of erroring.

---

## Membership & Range

### `in` operator

```
country in ["ES", "FR", "DE"]          // membership in list
status !in ["deleted", "suspended"]     // negated membership
age in 18..65                           // inclusive range
score in 0.0..<1.0                     // half-open range [0, 1)
```

- `in [...]` — list membership (replaces SQL `IN (...)`)
- `!in [...]` — negated (replaces SQL `NOT IN (...)`)
- `in x..y` — inclusive range (replaces SQL `BETWEEN x AND y`)
- `in x..<y` — half-open range (bonus — common in pagination/bucketing)

No ambiguity: `AND` is never overloaded as a range keyword.

---

## Field Access

```
country                         // simple field
address.country                 // nested field (dot notation)
address?.country                // null-safe nested field
metadata.tags[0]                // array index
metadata.tags[-1]               // last element
```

---

## Literals

```
"hello"                         // string
42                              // integer
3.14                            // float
true / false                    // boolean
null                            // null
[1, 2, 3]                      // array
```

---

## Method Syntax

Methods on values. Chainable. This is the core extension mechanism.

### String methods

```
name.upper()                    // "HELLO"
name.lower()                    // "hello"
name.trim()                     // strip whitespace
name.startsWith("test_")       // boolean
name.endsWith("@example.es")   // boolean
name.contains("foo")           // boolean
name.replace("old", "new")     // substitution
name.substring(0, 5)           // slice
name.len()                     // length
name.matches("*@example.es")   // glob pattern match
name.matches(/^test_\d+$/)     // regex pattern match
```

Replaces `LIKE "%@example.es"` with `email.endsWith("@example.es")` (more precise)
or `email.matches("*@example.es")` (glob).

### Collection methods

```
tags.includes("urgent")              // single membership
tags.includesAny(["admin", "dpo"])   // at least one
tags.includesAll(["viewer", "eu"])   // all present
tags.count()                         // length
tags.any(t => t.priority > 3)        // any element matches predicate
tags.all(t => t.active == true)      // all elements match predicate
items.sum(i => i.amount)             // sum over field
items.min(i => i.price)              // min over field
items.max(i => i.price)              // max over field
items.map(i => i.name)               // project to array of field
items.filter(i => i.active)          // filter array
items.flatMap(i => i.tags)           // flatten nested arrays
```

Replaces `HAS` / `HAS ANY` / `HAS ALL` with consistent method syntax.
Also covers nested array operations (gap #5 from review).

### Existence

```
address.postal != null               // field is non-null
address.postal != undefined          // field exists at all (schema-level)
```

No special `EXISTS` keyword. Consistent with comparison operators.

---

## Built-in Functions

Free functions for transforms that don't belong on a specific value.

### Date/Time

```
now()                                // current timestamp
year(created_at)                     // extract year
month(created_at)                    // extract month  
day(created_at)                      // extract day
hour(created_at)                     // extract hour
dateDiff("days", start, end)         // difference in units
dateAdd("months", 3, created_at)     // add duration
dateTrunc("month", created_at)       // truncate to unit
```

### Math

```
abs(delta)                           // absolute value
round(score, 2)                      // round to N decimals
floor(price)                         // round down
ceil(price)                          // round up
pow(base, exp)                       // power
sqrt(value)                          // square root
```

### Type casting

```
int(amount_str)                      // to integer
float(count)                         // to float
str(code)                            // to string
bool(flag_int)                       // to boolean
```

### Utility

```
env("DEFAULT_REGION")                // environment variable
coalesce(a, b, c)                    // first non-null (variadic form)
len(name)                            // string/array length (also available as .len())
```

---

## Expression Forms by Context

The grammar is the same everywhere. Context determines the return type.

### 1. Filter (`arg.predicate`)

A boolean expression over the input row.

```
// Comparison + boolean
arg.predicate = country == "ES" && active == true

// Membership
arg.predicate = country in ["ES", "FR", "DE"] && deleted_at == null

// Range
arg.predicate = age in 18..65

// Pattern
arg.predicate = email.endsWith("@miempresa.es")

// Nested + null-safe
arg.predicate = address?.country == "ES"

// Arithmetic in predicate
arg.predicate = price * quantity > 1000

// Complex boolean
arg.predicate = (country == "ES" || country == "FR") && active == true && !archived

// Environment variable
arg.predicate = region == env("DEFAULT_REGION")
```

### 2. Projection (`arg.fields`)

Field list in `[...]`. Each entry is a field reference, optionally renamed or computed.

```
// Select
arg.fields = [id, email, address.country]

// Exclude (wildcard minus)
arg.fields = [*, -password_hash, -internal_id]

// Rename — `as` keyword (lowercase, it's the one SQL-ism worth keeping)
arg.fields = [id, address.country as country, full_name as name]

// Computed
arg.fields = [id, amount * 0.21 as iva, amount * 1.21 as total]

// Conditional (ternary)
arg.fields = [id, country == "ES" ? "domestic" : "international" as market]

// Null coalescing
arg.fields = [id, nickname ?? full_name as display_name]

// String transform
arg.fields = [id, email.lower() as email_normalized]

// Date extract
arg.fields = [id, year(created_at) as signup_year]
```

### 3. Aggregation (`arg.fn`)

Aggregation function calls. Same camelCase as everything else — they're
just functions. The parser recognizes them from context (`arg.fn`) not casing.

```
// Single
arg.fn = count(*)
arg.fn = sum(amount)
arg.fn = avg(score)
arg.fn = min(created_at)
arg.fn = max(price)
arg.fn = first(name)
arg.fn = last(event_type)
arg.fn = collect(tags)

// Distinct
arg.fn = count(distinct country)

// Multiple — array syntax with `as`
arg.fn = [count(*) as total, sum(amount) as revenue, avg(amount) as avg_order]
```

Aggregation functions are a closed set: `count`, `sum`, `avg`, `min`, `max`,
`first`, `last`, `collect`. `distinct` is a modifier, not a function.
Writing `COUNT(*)` or `Sum(amount)` works fine — case-tolerant parsing
normalizes to `count(*)` / `sum(amount)`.

### 4. Group Key (`arg.key`)

Field references, optionally computed.

```
arg.key = country
arg.key = country, city
arg.key = country, year(created_at)
```

### 5. Join Condition (`arg.on`)

Boolean expression comparing left/right fields.

```
arg.on = left.user_id == right.id
arg.on = left.user_id == right.id && left.tenant == right.tenant
```

### 6. Sort (`arg.order`)

Field + direction. `asc`/`desc` lowercase. Optional `nulls first`/`nulls last`.

```
arg.order = created_at desc
arg.order = country asc, created_at desc
arg.order = score desc nulls last, id asc
```

### 7. Split Routes (`arg.routes`)

Named predicates. `*` is default. Route predicates use the same expression grammar.

```
arg.routes = {
  eu:    country in ["ES", "FR", "DE", "IT", "PT", "NL", "BE", "AT", "IE"]
  us:    country == "US"
  latam: country in ["MX", "AR", "CO", "CL", "BR"]
  other: *
}
```

### 8. Guard Policy (`arg.policy`)

Boolean expression over context references (`principal`, `intent`, `element`, `scope`).
Uses the same operators as filter — no special `HAS` keywords.

```
// Role-based
arg.policy = principal.roles.includes("admin")
arg.policy = principal.roles.includesAny(["admin", "dpo", "data-engineer"])
arg.policy = principal.roles.includesAll(["viewer", "eu-region"])

// Intent-based
arg.policy = intent.operation == "read"
arg.policy = intent.basis in ["consent", "contract"]

// Data-level (row-level security)
arg.policy = element.owner_id == principal.id
arg.policy = element.tenant == principal.attrs.tenant

// Combined
arg.policy = principal.roles.includes("analyst") && element.country in ["ES", "FR"]
arg.policy = intent.operation == "export" && principal.roles.includes("dpo")
```

---

## Escape Hatches

When the portable grammar isn't enough:

### `fn:` — Function reference

```
arg.predicate = fn: policies/core.evaluate_custom
arg.fields    = fn: rods/my-transform/core.project_fields
```

User-written function. Generator emits `import + call`. No change from v1.

### `sql:` / `mongo:` / `kafka:` — Source-specific

```
arg.predicate = sql: id IN (SELECT user_id FROM premium_users WHERE active)
arg.predicate = mongo: {"$text": {"$search": "openstrux"}}
arg.fn        = sql: PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency) as p95
```

Pass-through. Not lowered in v0.6.0. No change from v1.

### `opa:` / `cedar:` — External policy engine

```
arg.policy = opa: data.authz.allow
arg.policy = cedar: Action::"read", Resource::"users"
```

No change from v1.

---

## Side-by-Side: v0.5 (SQL-hybrid) vs v0.6.0 (C-family)

| Expression | v1 (SQL-hybrid) | v2 (C-family) | Tokens saved |
|---|---|---|---|
| Null check | `deleted_at IS NULL` | `deleted_at == null` | 0 (but consistent) |
| Not null | `email IS NOT NULL` | `email != null` | -1 keyword |
| Range | `age BETWEEN 18 AND 65` | `age in 18..65` | -2 keywords |
| Boolean | `x AND y OR z` | `x && y \|\| z` | 0 (same token count) |
| Negation | `NOT archived` | `!archived` | 0 |
| Membership | `country IN ("ES", "FR")` | `country in ["ES", "FR"]` | 0 |
| Neg. member | `status NOT IN ("x", "y")` | `status !in ["x", "y"]` | -1 keyword |
| Pattern | `email LIKE "%@ex.es"` | `email.endsWith("@ex.es")` | 0 (more precise) |
| Conditional | `CASE WHEN x THEN a ELSE b END` | `x ? a : b` | -3 keywords |
| Coalesce | `COALESCE(a, b)` | `a ?? b` | -1 (or `coalesce(a,b)` same) |
| Role check | `principal.roles HAS "admin"` | `principal.roles.includes("admin")` | 0 (consistent) |
| Any role | `roles HAS ANY ("a","b")` | `roles.includesAny(["a","b"])` | 0 (consistent) |
| String op | *(no portable syntax)* | `name.upper()` | *new capability* |
| Date op | *(no portable syntax)* | `year(created_at)` | *new capability* |
| Type cast | *(no portable syntax)* | `int(amount_str)` | *new capability* |
| Null safe | *(no portable syntax)* | `address?.country` | *new capability* |
| Null coal. | *(no portable syntax)* | `nickname ?? full_name` | *new capability* |

**Net: 4-7 fewer tokens on common patterns. 6 new capabilities. Zero hybrid inconsistencies.**

---

## Grammar (EBNF sketch)

```ebnf
expr          = ternary ;
ternary       = or_expr ( "?" expr ":" expr )? ;
or_expr       = and_expr ( "||" and_expr )* ;
and_expr      = null_coal ( "&&" null_coal )* ;
null_coal     = equality ( "??" equality )* ;
equality      = comparison ( ( "==" | "!=" ) comparison )? ;
comparison    = membership ( ( ">" | "<" | ">=" | "<=" ) membership )? ;
membership    = addition ( ( "in" | "!in" ) ( array_lit | range_lit ) )? ;
addition      = multiply ( ( "+" | "-" ) multiply )* ;
multiply      = unary ( ( "*" | "/" | "%" ) unary )* ;
unary         = ( "!" | "-" ) unary | postfix ;
postfix       = primary ( "." ident ( "(" args? ")" )? | "?." ident | "[" expr "]" )* ;
primary       = ident | literal | "(" expr ")" | fn_call | lambda ;
fn_call       = ident "(" args? ")" ;
lambda        = ident "=>" expr ;
args          = expr ( "," expr )* ;
literal       = string | number | bool | null | array_lit ;
array_lit     = "[" ( expr ( "," expr )* )? "]" ;
range_lit     = number ( ".." | "..<" ) number ;
```

Precedence (low to high): `? :` → `||` → `&&` → `??` → `== !=` → `> < >= <=` → `in !in` → `+ -` → `* / %` → `! -` (unary) → `.` `?.` `[]`

---

## What This Covers (the 99% checklist)

| Category | Covered | Examples |
|---|---|---|
| Comparison | yes | `==`, `!=`, `>`, `<`, `>=`, `<=` |
| Boolean logic | yes | `&&`, `\|\|`, `!`, parentheses |
| Null handling | yes | `== null`, `!= null`, `??`, `?.` |
| Membership | yes | `in [...]`, `!in [...]` |
| Ranges | yes | `in 18..65`, `in 0..<100` |
| Pattern matching | yes | `.matches()`, `.startsWith()`, `.endsWith()`, `.contains()` |
| String operations | yes | `.upper()`, `.lower()`, `.trim()`, `.replace()`, `.substring()`, `.len()` |
| Date/time | yes | `now()`, `year()`, `month()`, `dateDiff()`, `dateAdd()`, `dateTrunc()` |
| Math | yes | `abs()`, `round()`, `floor()`, `ceil()`, `+`, `-`, `*`, `/`, `%` |
| Type casting | yes | `int()`, `float()`, `str()`, `bool()` |
| Conditionals | yes | `? :` ternary, nestable |
| Null coalescing | yes | `??` |
| Field access | yes | dot notation, `?.` optional chaining, `[]` index |
| Collection ops | yes | `.includes()`, `.includesAny()`, `.includesAll()`, `.any()`, `.all()` |
| Array operations | yes | `.map()`, `.filter()`, `.sum()`, `.count()`, `.flatMap()` |
| Aggregation | yes | `count`, `sum`, `avg`, `min`, `max`, `first`, `last`, `collect`, `distinct` |
| Computed fields | yes | arithmetic + functions in projection |
| Escape hatches | yes | `fn:`, `sql:`, `mongo:`, `kafka:`, `opa:`, `cedar:` |
