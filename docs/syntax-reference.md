# Openstrux 0.6.0 — Syntax Reference

Self-sufficient entry point — generate valid `.strux` from this document alone.
Normative spec lives in [openstrux-spec](https://github.com/openstrux/openstrux-spec);
this document is the user-facing copy, updated on each spec release.

Openstrux: AI-native language. Systems as typed graphs (panels of rods);
generate executable code from source. Goals: token-efficient, certified by
design, human-translatable, structure-first, trust built in.

---

## Type Forms

```
@type Name { field: Type, field2: Type }                    // record
@type Name = enum { val1, val2, val3 }                      // enum
@type Name = union { tag1: Type1, tag2: Type2 }             // union
@type Name @sealed { field: Type }                          // sealed record (standard types only)
```

Primitives: `string`, `number`, `bool`, `date`, `bytes`.
Containers: `Optional<T>`, `Batch<T>`, `Map<K,V>`, `Single<T>`, `Stream<T>`.
Generic built-in: `PrivateData<T>` — personal data wrapper (see §Privacy).
Constraint: `number [0..100]`, `string ["a","b","c"]`.

## Type Paths

Union narrowing via dot-path: `db.sql.postgres` resolves `DataSource → DbSource → SqlSource → PostgresConfig`.
Wildcards: `db.sql.*` (any SQL), `db.*` (any DB), `*` (any).

## Panel Structure

Shorthand (recommended for authoring):

```
@panel name {
  @dp { record }                                      // inherits controller etc. from strux.context
  @privacy { framework: gdpr }                         // optional: declare governing privacy framework
  @access { purpose, operation }                       // inherits basis, scope from context
  name = rod-type { key: val, key2: val2 }             // implicit chain: reads from previous rod
  name2 = rod-type { key: val, from: other.knot }      // explicit: reads from non-default output
}
```

Shorthand rules (verbose remains valid — both normalize to same AST):

1. `@rod` keyword optional inside `@panel` — every non-decorator statement is a rod.
   The `=` separator between name and type remains: `name = rod-type { ... }`.
2. `cfg.`/`arg.` prefixes optional — compiler resolves from rod type definition.
3. Implicit linear chain — each rod reads previous rod's default output (no snap needed).
4. `@access` intent fields can be flattened (drop the `intent:` wrapper).

Verbose and shorthand equivalence:

```
@rod f = filter { arg.predicate = ..., snap db.out.rows -> in.data }   // verbose
f = filter { predicate: ..., from: db.rows }                           // shorthand explicit
f = filter { predicate: ... }                                          // shorthand implicit chain
src = read-data { source: @production, mode: "scan", @ops { retry: 5, fallback: @backup } }  // rod-level @ops
```

## 18 Basic Rods

### I/O — Data

| Rod | cfg | arg | in | out | err |
|-----|-----|-----|----|-----|-----|
| `read-data` | source: DataSource, mode: ReadMode | predicate?, fields?, limit? | — | rows/elements, meta | failure |
| `write-data` | target: DataTarget | — | rows/elements | receipt, meta | failure, reject |

ReadMode: `scan`, `lookup`, `multi_lookup`, `query`, `stream`.
Table/collection selection via `arg.predicate` (e.g., `predicate: sql: SELECT * FROM users`).

### I/O — Service

| Rod | cfg | arg | in | out | err |
|-----|-----|-----|----|-----|-----|
| `receive` | trigger: Trigger | timeout? | — | request, context | invalid |
| `respond` | — | status?, headers? | data | sent | failure |
| `call` | target: ServiceTarget, method: CallMethod | path?, headers?, timeout? | request | response, metadata | failure, timeout |

Trigger: `http{method,path}`, `grpc{service,method}`, `event{source,topic}`, `schedule{cron?,interval?}`, `queue{source,queue}`, `manual{}`.
ServiceTarget: `http{base_url,auth?,tls}`, `grpc{host,port,proto,tls}`, `function{provider,name}`.
CallMethod: `get`, `post`, `put`, `patch`, `delete`, `unary`, `server_stream`, `invoke`.

### Computation

| Rod | Key knots |
|-----|-----------|
| `transform` | cfg.mode: map\|flat_map\|project, arg.fields/fn, in.data→out.data |
| `filter` | arg.predicate, in.data→out.match+out.reject |
| `group` | arg.key, in.data→out.grouped |
| `aggregate` | arg.fn, in.grouped→out.result |
| `merge` | in.left+in.right→out.merged |
| `join` | cfg.mode: inner\|left\|right\|outer\|cross\|lookup, arg.on, in.left+in.right→out.joined+out.unmatched |
| `window` | cfg.kind: fixed\|sliding\|session, cfg.size: duration, in.data→out.windowed |

### Control

| Rod | Key knots |
|-----|-----------|
| `guard` | cfg.policy: PolicyRef, arg.policy (shorthand), in.data→out.allowed+out.modified, err.denied |
| `store` | cfg.backend: StateBackend, cfg.mode: get\|put\|delete\|cas\|increment, in.key+in.value?→out.result |

### Compliance

| Rod | Key knots |
|-----|-----------|
| `validate` | cfg.schema: SchemaRef, in.data→out.valid, err.invalid |
| `pseudonymize` | cfg.algo, arg.fields, in.data→out.masked |
| `encrypt` | cfg.key_ref, arg.fields, in.data→out.encrypted |

SchemaRef: `@type` reference or named schema from context (e.g., `schema: UserPayload`).

### Topology

| Rod | Key knots |
|-----|-----------|
| `split` | arg.routes, in.data→out.{route_name}... |

### Default Knots (for implicit chaining)

| Rod | Default out | Default in |
|-----|------------|------------|
| read-data | rows (db) / elements (stream) | — (source) |
| filter | match | data |
| transform | data | data |
| group | grouped | data |
| aggregate | result | grouped |
| pseudonymize | masked | data |
| validate | valid | data |
| encrypt | encrypted | data |
| merge | merged | left (+ right) |
| join | joined | left (+ right) |
| split | (named routes — no default, explicit `from:` required downstream) | data |
| write-data | receipt | rows / elements |
| receive | request | — (trigger) |
| respond | sent | data |
| call | response | request |
| guard | allowed | data |
| store | result | key |
| window | windowed | data |
| **private-data** | **protected** | **data** |

`window → group → aggregate` chains without explicit wiring.

---

## Standard Rods (v0.6)

Standard rods compose basic rods. They ship with core, carry project certification, and expand
to a basic rod sub-graph during IR lowering. Rod authors cannot override them.

### `private-data` — Privacy-safe personal data processing

```
pd = private-data {
  framework:            gdpr { lawful_basis: contract, data_subject_categories: ["user"] }
  fields:               [{ field: "email", category: identifying, sensitivity: standard }, ...]
  purpose:              "grant application intake"
  retention:            { duration: "5y", basis: legal_obligation }
  encryption_required:  false          // true forced when special_category/highly_sensitive present
  predicate:            "deleted_at IS NULL"   // optional data-minimization filter (arg knot)
}
```

**Knots:** `in.data` → `out.protected` + `out.audit`. Errors: `err.denied`, `err.invalid`, `err.policy_violation`.

**Expands to:**

| Framework | Sub-graph |
|---|---|
| `gdpr`, `encryption_required: false` | `validate → pseudonymize → guard` |
| `gdpr`, `encryption_required: true` or special_category field | `validate → pseudonymize → encrypt → guard` |
| `gdpr.bdsg` | always `validate → pseudonymize(hmac) → encrypt → guard` |

**Framework type paths:**

| Path | Config type | Notes |
|---|---|---|
| `framework: gdpr` | `GdprBaseConfig` | Required: `lawful_basis`, `data_subject_categories` |
| `framework: gdpr.bdsg` | `BdsgConfig` | All GDPR fields + `employee_data`, `employee_category`, `betriebsrat_consent` |

**Lawful basis values (GdprBasis):** `consent`, `contract`, `legal_obligation`, `vital_interests`, `public_task`, `legitimate_interest`.

**GDPR compile-time rules:**
- `purpose` required (Art. 5(1)(b) — `E_GDPR_PURPOSE_REQUIRED`)
- `retention` required (Art. 5(1)(e) — `E_GDPR_RETENTION_REQUIRED`)
- `special_category` / `highly_sensitive` fields force `encryption_required: true` and restrict basis to `consent/legal_obligation/vital_interests` (Art. 9)
- `legitimate_interest` without `dpia_ref` → warning `W_GDPR_LI_DPIA_RECOMMENDED`

**BDSG additional rules:**
- `encryption_required: false` is a compile error (`E_BDSG_ENCRYPTION_REQUIRED`)
- `employee_data: true` requires `employee_category` (`E_BDSG_EMPLOYEE_CATEGORY_REQUIRED`)
- Pseudonymize uses HMAC (keyed); key_ref required (`E_BDSG_PSEUDONYMIZE_KEY_REQUIRED`)
- `@dp.dpo` required (`E_BDSG_DPO_REQUIRED`)
- Monitoring/performance purposes → warning `W_BDSG_BETRIEBSRAT_CONSENT_RECOMMENDED`

**`cfg.fields` optional** when input is `PrivateData<T>` — classifications derived from wrapper.

**Manifest:** Adds `privacyRecords` array (Art. 30 records) per rod instance. See [specs/modules/manifest.md](../openstrux-spec/specs/modules/manifest.md).

---

## `@privacy` Decorator

Declares the governing privacy framework at panel or context level.

```
@privacy { framework: gdpr, dpa_ref: "DPA-2026-001" }
```

When declared, all source→sink data flow paths must pass through `private-data` with a
compatible framework. Bypass → `E_PRIVACY_PATH_BYPASS`.

Inheritable from `strux.context`. Framework narrows (e.g., `gdpr` → `gdpr.bdsg`), never widens.

---

## `PrivateData<T>` Type

Marks a data value as personal data at the type level.

```
in.data: PrivateData<UserIdentity>    // rod knot declaration
```

`PrivateData<T>` flowing to `write-data` / `respond` without `private-data` rod → `E_PRIVATE_DATA_SINK_BYPASS`.

When `T` is a standard type, `classification` is auto-populated from built-in field classifications.

---

## Standard Personal Data Types

Available without import. Field classifications are built-in.

| Type | Key fields (category/sensitivity) | Encryption triggered |
|---|---|---|
| `PersonName` | `given_name`, `family_name`, `second_family_name`, `middle_name` → identifying/std; `prefix`, `suffix` → quasi/std | No |
| `PersonalContact` | `email`, `phone`, `mobile` → identifying/std; `preferred_channel` → non-personal | No |
| `PostalAddress` | `street` → identifying/std; `city`, `state`, `postal_code`, `country` → quasi/std | No |
| `UserIdentity` | PersonName + PersonalContact + `date_of_birth` (identifying) + `national_id` (**highly_sensitive**) | Yes — national_id |
| `EmployeeRecord` | UserIdentity + `employee_id` (identifying) + `department/position/hire_date/manager_id` (quasi) + `salary` (**financial/special_category**) | Yes — salary |
| `FinancialAccount` | `iban` (financial/identifying) + `account_holder` (identifying) + `bic/bank_name` (quasi) | No |

Sealed — cannot be redefined. Compose into custom types:

```
@type GrantApplicant { identity: UserIdentity, proposal_ref: string }
// proposal_ref: explicit cfg.fields entry needed if it contains personal data
```

---

## Full Panel Example with `private-data`

```
@context {
  @dp { controller: "Acme GmbH", controller_id: "DE-HRB123", dpo: "dpo@acme.de" }
  @privacy { framework: gdpr }
  @source production = db.sql.postgres { host: env("DB_HOST"), port: 5432, db_name: "users", tls: true }
}

@panel grant-intake {
  @dp { record: "RPA-2026-001" }
  @access { purpose: "grant_intake", operation: "write" }

  recv = receive { trigger: http { method: POST, path: "/grants/apply" } }
  pd = private-data {
    framework: gdpr {
      lawful_basis: contract,
      data_subject_categories: ["applicant"]
    }
    fields: [
      { field: "given_name",  category: identifying,       sensitivity: standard },
      { field: "family_name", category: identifying,       sensitivity: standard },
      { field: "email",       category: identifying,       sensitivity: standard },
      { field: "postal_code", category: quasi_identifying, sensitivity: standard }
    ]
    purpose:   "grant application intake"
    retention: { duration: "5y", basis: legal_obligation }
  }
  sink = write-data { target: @production { db_name: "grants" } }
  resp = respond { status: 201 }
}
```

---

## Data Union Trees

```
DataSource = stream (kafka, pubsub, kinesis) | db (sql: postgres/mysql/bigquery, nosql: mongodb/dynamodb/firestore)
PrivacyFramework = gdpr (base | bdsg | lopdgdd[future]) | ccpa[future] | lgpd[future]
```

DataTarget follows the same union tree as DataSource.

Config patterns:

```
db.sql.postgres { host, port, db_name, tls, credentials: secret_ref{provider,path} }
stream.kafka { brokers, topic, credentials }
stream.pubsub { project, topic }
stream.kinesis { region, stream_name, credentials }
gdpr { lawful_basis, data_subject_categories, dpia_ref?, cross_border_transfer? }
gdpr.bdsg { ...gdpr fields, employee_data, employee_category?, betriebsrat_consent? }
```

## Expression Shorthand

Expressions use SQL-like syntax. Source-specific prefixes: `sql:`, `mongo:`, `kafka:`, `fn:`, `opa:`, `cedar:`.

### Filter (arg.predicate)

```
field == "val"                              // compare (==, !=, >, >=, <, <=)
a AND b, a OR b, NOT a, (a OR b) AND c     // logic
field IN ("a","b","c"), field NOT IN (...)   // in-list
field BETWEEN 1 AND 100                     // range
field IS NULL, field IS NOT NULL            // null
field LIKE "pat%", field EXISTS             // pattern, existence
sql: id IN (SELECT ...)                     // SQL-specific
mongo: {"field": {"$gt": 1}}               // Mongo-specific
fn: mod/core.my_filter                      // function ref
```

### Projection (arg.fields)

```
[id, email, address.country AS country]                    // select + rename
[*, -password_hash, -internal_id]                          // exclude
[id, amount * 0.21 AS iva, COALESCE(nick, name) AS disp]  // computed
```

### Aggregation (arg.fn)

```
COUNT(*), SUM(amount), AVG(score), MIN(x), MAX(x)         // single
COUNT(DISTINCT country)                                     // distinct
[COUNT(*) AS total, AVG(age) AS avg_age]                   // multi
```

### Group Key (arg.key)

```
country, YEAR(created_at)                   // field + function
```

### Join (arg.on)

```
left.user_id == right.id AND left.tenant == right.tenant
```

### Sort (arg.order)

```
created_at DESC NULLS LAST, id ASC
```

### Split Routes (arg.routes)

```
{ eu: country IN ("ES","FR","DE"), us: country == "US", other: * }
```

### Guard Policy (arg.policy)

```
principal.roles HAS "admin"                                // role check
principal.roles HAS ANY ("admin","dpo")                    // any-of
element.owner_id == principal.id                           // row-level
opa: data.authz.allow                                      // external engine
```

Rod shorthand: `g = guard { policy: opa: data.authz.allow }`.

## Pushdown Rules

Portable expressions push to any source. Prefixed push only to matching source (`sql:` → SQL, `mongo:` → Mongo). Type mismatch = compile error. Sequential pushable rods fuse into single adapter call (logical plan preserved for audit).

## Decorators

```
@dp      { controller, controller_id, dpo, record, basis?, fields? }
@privacy { framework: gdpr | gdpr.bdsg, dpa_ref? }
@sec     { encryption?, classification?, audit? }
@ops     { retry?, timeout?, circuit_breaker?, rate_limit?, fallback? }
@cert    { scope: { source: "db.sql.postgres" }, hash, version }
@access  { intent: { purpose, basis, operation }, scope: policy("name") }
```

`@ops` field types:

```
retry: number                                // max attempts
timeout: duration                            // "30s", "5m"
fallback: @name | rod-name                   // named source or rod on exhaustion
circuit_breaker: { threshold: number, window: duration }
rate_limit: { max: number, window: duration }
```

## Context Inheritance

Shared config in `strux.context` files. Panels inherit and override.

```
project-root/
  strux.context              # project-wide: @dp, @privacy, named @source/@target, @ops, @sec
  domain-a/
    strux.context            # team overrides (narrower @access, domain sources, @privacy narrowing)
    pipelines/
      panel.strux            # only unique intent, logic, routing
```

### `strux.context` syntax

```
@context {
  @dp      { controller: "Acme", controller_id: "B-123", dpo: "dpo@acme.com" }
  @privacy { framework: gdpr }
  @access  { intent: { basis: "legitimate_interest" }, scope: policy("default-read") }
  @source production = db.sql.postgres { host: env("DB_HOST"), port: 5432, ... }
  @target analytics = db.sql.bigquery { project: "analytics", location: "EU", ... }
  @ops    { retry: 3, timeout: "30s" }
}
```

### Inheritance rules

| Block | Inheritable | Merge behavior |
|-------|------------|----------------|
| `@dp` | Yes | Field-level merge, panel wins |
| `@privacy` | Yes | Framework can **narrow** (e.g., `gdpr` → `gdpr.bdsg`); panel wins on `dpa_ref` |
| `@access` | Yes | Panel can **narrow** scope, never widen (compile error) |
| `@source` | Yes (by `@name`) | `cfg.source = @production` references named source; inline fields override |
| `@target` | Yes (by `@name`) | Same as @source |
| `@ops` | Yes | Field-level merge, nearest wins |
| `@sec` | Yes | Field-level merge |
| `@cert` | **No** | Per-component only, never inherited |

## Built-in References and Credentials

```
@name                                       // named @source/@target from strux.context
@name { field: override }                   // resolve + override fields inline
env("VAR_NAME")                             // environment variable
secret_ref { provider: vault, path: "..." } // secret reference
policy("name")                              // named policy (hub, OPA, or Cedar); compile-time ref
adc {}                                      // GCP Application Default Credentials
```

SecretRef providers: `gcp_secret_manager`, `aws_secrets_manager`, `vault`, `env`.

---

## Grammar Essentials

### Lexical

```
name          = letter { letter | digit | "_" | "-" }
string        = '"' { char | escape } '"'
escape        = '\"' | '\\' | '\n' | '\t' | '\r'
number        = digit { digit } [ "." digit { digit } ]
bool          = "true" | "false"
duration      = number ("s" | "m" | "h" | "d")               // "30s", "5m", "24h"
comment       = "//" (everything until end of line)
```

Whitespace ignored outside strings. Braces delimit blocks.

### Reserved Words

Keywords — cannot be used as `name`:

```
@type @panel @context @rod @dp @access @sec @ops @cert @source @target @privacy
@when @adapter @sealed
union enum record
read-data write-data receive respond call transform filter group aggregate
merge join window guard store validate pseudonymize encrypt split
private-data
AND OR NOT IN BETWEEN IS NULL LIKE EXISTS AS CASE WHEN THEN ELSE END
HAS ANY ALL DISTINCT NULLS FIRST LAST ASC DESC COALESCE
COUNT SUM AVG MIN MAX COLLECT
true false null
env secret_ref policy snap from
```

### Operator Precedence (highest to lowest)

| Precedence | Operators | Associativity |
|-----------|-----------|---------------|
| 1 | `()` grouping | — |
| 2 | unary `NOT`, unary `-` | right |
| 3 | `*` `/` `%` | left |
| 4 | `+` `-` | left |
| 5 | `==` `!=` `>` `>=` `<` `<=` | non-associative |
| 6 | `IN` `NOT IN` `BETWEEN` `IS` `LIKE` `EXISTS` `HAS` | non-associative |
| 7 | `AND` | left |
| 8 | `OR` | left |

### Normalization

Verbose and shorthand produce identical AST:

- `@rod name = type { cfg.field = val }` ≡ `name = type { field: val }`.
- Rods without `from:` → implicit snap edges via default knots.
- Flat `@access { purpose, operation }` → routes to `intent` sub-structure.

---

## Semantic Essentials

### Evaluation Order

Rods execute in **topological order** of the snap graph (not declaration order).
For linear chains these are equivalent. Branches from multi-output rods
(filter.match/reject, split routes) MAY run in parallel.

### Implicit Chaining Rules

1. First rod in a panel has no implicit input (it is a source).
2. Each subsequent rod without `from:` reads the previous rod's **default output**.
3. `from: rod.knot` overrides implicit chain (reads named output knot).
4. `from: [rod1, rod2]` for multi-input rods — first = left, second = right.
5. Implicit chain follows the **default** output only.
6. After normalization, all chains are explicit in the IR.
7. Source rods (`read-data`, `receive`) always start a new chain regardless of position.
8. A rod with explicit `from:` does not advance the implicit chain.

### AccessContext

- `@access` evaluated implicitly for every rod — no explicit wiring needed.
- Empty AccessContext → **deny** (fail-closed).
- Scope narrows downstream, never widens. Enforced at compile time.
- `guard` rod is the explicit business-policy evaluation point.

### Privacy Enforcement (v0.6)

- `@privacy` on a panel → all source→sink paths must include `private-data` rod.
- `PrivateData<T>` flowing to sink without `private-data` → compile error.
- `private-data` rod expands to `validate → pseudonymize → [encrypt] → guard` at IR lowering.
- Privacy records written to manifest `privacyRecords` array (Art. 30 / BDSG).

### Error Propagation

1. If `err` knot is wired to a downstream rod → error data flows there.
2. If unwired → apply `@ops { retry }` first, then `@ops { fallback }` on exhaustion.
3. If neither → panel fails with unhandled error. Errors **never** silently discarded.

### Determinism

**Same source + same `snap.lock` = same compiled output.** Applies to compiled artifacts,
not runtime behavior. Privacy records are stable across compilations.

---

## Specification Map

| Document | When to load |
|----------|-------------|
| [openstrux-spec/specs/core/grammar.md](../openstrux-spec/specs/core/grammar.md) | Full EBNF, all productions, edge cases |
| [openstrux-spec/specs/core/semantics.md](../openstrux-spec/specs/core/semantics.md) | Formal evaluation model, standard rod expansion |
| [openstrux-spec/specs/core/type-system.md](../openstrux-spec/specs/core/type-system.md) | Union nesting, PrivateData<T>, standard types, field classification |
| [openstrux-spec/specs/modules/rods/standard/private-data.strux](../openstrux-spec/specs/modules/rods/standard/private-data.strux) | private-data rod knot signature |
| [openstrux-spec/specs/modules/rods/standard/private-data-gdpr.md](../openstrux-spec/specs/modules/rods/standard/private-data-gdpr.md) | GDPR Art. 5/6/9/25/30 enforcement rules |
| [openstrux-spec/specs/modules/rods/standard/private-data-bdsg.md](../openstrux-spec/specs/modules/rods/standard/private-data-bdsg.md) | BDSG §26/§38 employee data rules |
| [openstrux-spec/specs/modules/manifest.md](../openstrux-spec/specs/modules/manifest.md) | Manifest schema, privacyRecords, Art. 30 derivation |
| [openstrux-spec/specs/core/config-inheritance.md](../openstrux-spec/specs/core/config-inheritance.md) | @privacy inheritance, context cascade |
| [openstrux-spec/specs/modules/types/standard/personal-data/](../openstrux-spec/specs/modules/types/standard/personal-data/) | Standard personal data types |
