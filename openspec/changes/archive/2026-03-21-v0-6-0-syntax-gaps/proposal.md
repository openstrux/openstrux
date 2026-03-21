## Why

Six LLMs were given the v0.6.0 syntax reference and asked to generate `.strux` for six use cases. The synthesis ([SYNTHESIS.md](../../../openstrux-spec/tmp/review/SYNTHESIS.md)) found that all six guessed different shapes for `@ops` fields, `validate.schema`, `window.size` duration values, and stream config fields — because these types are listed but never defined. The parser also has no support for rod-level `@ops` or the `duration` literal that the spec now references.

These are not new features — they fill gaps where the spec says "this field exists" but never says what its value looks like. The v0.6.0 grant-workflow demo and benchmarks don't exercise these features directly (no streaming, no duration-based windows, no rod-level @ops), but closing them before the demo ensures the syntax reference is authoritative: any `.strux` an LLM generates from it will parse and validate, not just the grant-workflow subset.

The synthesis also identified three implicit-chaining rules that are correct by convention but unstated. These are documentation-only (no code change) but must be formalized in the spec to prevent LLM generation errors.

## What Changes

### Parser (packages/parser)

- Add `duration` lexical production: `number + ("s" | "m" | "h" | "d")` → `DurationLiteral` token
- Support rod-level `@ops { ... }` inside rod blocks (nested decorator)

### Validator (packages/validator)

- Add `@ops` field type validation: `retry: number`, `timeout: duration`, `fallback: @name | rod-name`, `circuit_breaker: { threshold: number, window: duration }`, `rate_limit: { max: number, window: duration }`
- Add `SchemaRef` resolution for `validate.cfg.schema` — must resolve to a declared `@type` or named schema from context
- Add `DataTarget` type mirroring `DataSource` union tree
- Add stream config field validation: `kafka { brokers, topic, credentials }`, `pubsub { project, topic }`, `kinesis { region, stream_name, credentials }`

### Spec (openstrux-spec)

- Add `duration` production to `grammar.md` EBNF
- Formalize implicit chaining rules 7-8 in `semantics.md` and `panel-shorthand.md`
- Add `from:` namespace resolution rule to `panel-shorthand.md`
- Add `DataTarget` definition to `datasource-hierarchy.strux`

### Conformance fixtures

- Valid: duration literals, rod-level @ops, validate with SchemaRef, write-data with DataTarget, stream configs
- Invalid: malformed duration, @ops with wrong field types, SchemaRef pointing to undeclared type

## Capabilities

### New Capabilities

- `duration` literal: lexer tokenizes `"30s"`, `"5m"`, `"24h"` as `DurationLiteral` AST nodes
- Rod-level `@ops`: parser accepts `@ops { ... }` inside rod blocks, attaches to rod AST node
- `@ops` field validation: validator checks field names and value types against defined schema
- `SchemaRef` resolution: validator resolves `validate.cfg.schema` against declared `@type` names
- `DataTarget` type: validator accepts DataTarget with same union tree as DataSource

### Modified Capabilities

- Lexer: new `DURATION` token type
- Rod parser: `parseRod()` handles nested `@ops` blocks alongside `key: value` pairs
- Rod signature table: `validate` row updated with `SchemaRef` type, `window` row updated with `duration` type
- Config resolver: rod-level @ops merge added to cascade (context → panel → rod)

## Impact

- **openstrux-core**: Parser and validator changes — lexer, rod parser, rod-signatures, new validation rules
- **openstrux-spec**: Grammar EBNF updated, semantics formalized, new conformance fixtures, DataTarget added to datasource-hierarchy
- **Downstream**: Not a hard dependency for v0.6.0 deliverables — the grant-workflow demo and benchmarks use only basic rods, db sources, and panel-level @ops. However, closing these gaps makes the syntax reference fully authoritative for any LLM-generated `.strux`, not just the grant-workflow subset.
- **No breaking changes** — all additions are backwards-compatible (new token type, new validation rules emit errors only for previously-undefined constructs)

## Ordering

This package depends on:
- `v0-6-0-parser` (completed) — parser infrastructure exists
- `v0-6-0-validator-config` (completed) — validator and config resolver exist
- `v0-6-0-target-ts` (in progress) — generator and adapter foundation in place
- `v0-6-0-rods-target-ts` — all 18 rod emitters available before adding new validation rules

This package must complete before:
- `v0-6-0-grant-workflow-demo` — syntax reference should be fully authoritative before the demo generates .strux from it
- `v0-6-0-benchmarks` — benchmark scoring may include generation of streaming/resilience patterns beyond grant-workflow

Execution order:
```
toolchain-bootstrap  ✓
parser               ✓
validator-config     ✓
manifest-explain     ✓
lock-determinism     (pending)
target-ts            (in progress)
rods-target-ts       (pending)
syntax-gaps          ← THIS
grant-workflow-demo  (pending)
benchmarks           (pending)
```
