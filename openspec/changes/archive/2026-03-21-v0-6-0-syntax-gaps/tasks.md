## 1. Duration literal

- [x] 1.1 Add `DURATION` token type to lexer token enum in `packages/parser/src/lexer.ts`
- [x] 1.2 Implement greedy duration tokenization: `digit+ ("s"|"m"|"h"|"d")` → `DURATION` token with numeric value and unit
- [x] 1.3 Add `DurationLiteral` AST node to `packages/ast/src/types.ts` — `{ value: number, unit: "s"|"m"|"h"|"d" }`
- [x] 1.4 Update parser value literal handling to accept `DURATION` tokens alongside `STRING`, `NUMBER`, `BOOL`
- [x] 1.5 Write lexer tests: `5m`, `30s`, `24h`, `7d`, edge cases (`5 m` = two tokens, `5x` = error, `0s` = valid)
- [x] 1.6 Write parser tests: duration in cfg position (`cfg.size = 5m`), duration in @ops (`timeout: 30s`)
- [x] 1.7 Add `duration` production to `openstrux-spec/specs/core/grammar.md` EBNF

## 2. Rod-level @ops

- [x] 2.1 Update `parseRod()` in `packages/parser/src/parser.ts` to detect `@ops` token inside rod block
- [x] 2.2 Parse nested `@ops { ... }` as decorator block, attach as `rod.decorators.ops` on `RodNode`
- [x] 2.3 Update config resolver to include rod-level @ops in merge cascade: context → panel → rod (rod wins)
- [x] 2.4 Write parser tests: rod with inline @ops, rod with @ops + regular fields, rod with @ops only
- [x] 2.5 Write config resolver tests: rod @ops overrides panel @ops, rod @ops merges with context @ops

## 3. @ops field type validation

- [x] 3.1 Define @ops field schema in `packages/validator/src/ops-schema.ts`:
  - `retry: number`
  - `timeout: DurationLiteral`
  - `fallback: NameRef | string` (rod name or @name reference)
  - `circuit_breaker: { threshold: number, window: DurationLiteral }`
  - `rate_limit: { max: number, window: DurationLiteral }`
- [x] 3.2 Implement @ops field validator — check field names against schema, emit `E_OPS_UNKNOWN_FIELD` for unrecognized fields
- [x] 3.3 Implement @ops value type checker — emit `E_OPS_TYPE_MISMATCH` when value type doesn't match schema (e.g., `retry: "five"`)
- [x] 3.4 Wire @ops validation into validator pipeline (runs on panel decorators and rod decorators)
- [x] 3.5 Write validator tests: valid @ops, unknown field, wrong type, nested record fields (circuit_breaker.threshold)

## 4. SchemaRef resolution

- [x] 4.1 Add `SchemaRef` handling to validator type resolver — when `validate.cfg.schema` is encountered, resolve identifier against SymbolTable
- [x] 4.2 Emit `E_SCHEMA_UNRESOLVED` when schema identifier is not a declared `@type`
- [x] 4.3 Emit `E_SCHEMA_STRING` with fix suggestion when schema value is a string literal instead of an identifier
- [x] 4.4 Update rod signature table: `validate` row schema field typed as `SchemaRef`
- [x] 4.5 Write validator tests: valid schema ref, unresolved ref, string-instead-of-identifier

## 5. DataTarget and stream config

- [x] 5.1 Add `@type DataTarget` definition to `openstrux-spec/specs/modules/datasource-hierarchy.strux` — mirror DataSource union tree
- [x] 5.2 Add stream config field definitions: kafka `{ brokers, topic, credentials? }`, pubsub `{ project, topic }`, kinesis `{ region, stream_name, credentials? }`
- [x] 5.3 Update validator type resolver to recognize DataTarget type paths (`stream.kafka`, `db.sql.postgres`, etc.)
- [x] 5.4 Implement stream config field validation — check required fields present, emit `E_STREAM_MISSING_FIELD`
- [x] 5.5 Write validator tests: valid kafka/pubsub/kinesis configs, missing required field, unknown adapter type

## 6. Spec formalization

- [x] 6.1 Add implicit chaining rules 7-8 to `openstrux-spec/specs/core/semantics.md`
- [x] 6.2 Add `from:` namespace resolution rule to `openstrux-spec/specs/core/panel-shorthand.md`
- [x] 6.3 Add `duration` production to `openstrux-spec/specs/core/grammar.md` formal EBNF
- [x] 6.4 Add `DataTarget` cross-reference to `openstrux-spec/specs/core/type-system.md`
- [x] 6.5 Verify syntax-reference.md is consistent with all spec changes (already updated — confirm no drift)

## 7. Conformance fixtures

- [x] 7.1 Write valid fixtures in `openstrux-spec/conformance/valid/`:
  - `v020-duration-literal.strux` — duration values in window.size and @ops.timeout
  - `v020-rod-level-ops.strux` — rod with inline @ops overriding panel @ops
  - `v020-validate-schema-ref.strux` — validate rod with SchemaRef to declared @type
  - `v020-write-data-target.strux` — write-data with DataTarget (stream.kafka, db.sql)
  - `v020-stream-configs.strux` — all three stream adapter configs (kafka, pubsub, kinesis)
- [x] 7.2 Write invalid fixtures in `openstrux-spec/conformance/invalid/`:
  - `i020-malformed-duration.strux` — `"30s"` as string in @ops.timeout
  - `i020-ops-wrong-type.strux` — `retry: "five"`, `timeout: 30` (number, not duration)
  - `i020-schema-unresolved.strux` — `validate { schema: NonExistentType }`
  - `i020-schema-string.strux` — `validate { schema: "UserPayload" }` (string, not identifier)
  - `i020-stream-missing-field.strux` — `stream.kafka { topic: "t" }` (missing brokers)
- [x] 7.3 Mirror fixtures to `openstrux-core/tests/fixtures/`
- [x] 7.4 Write conformance test suite asserting parser and validator diagnostics match expected codes

## 8. Integration

- [x] 8.1 Run `pnpm test --filter packages/parser` — all tests pass (including new duration and rod-level @ops tests)
- [x] 8.2 Run `pnpm test --filter packages/validator` — all tests pass (including @ops schema, SchemaRef, DataTarget, stream config tests)
- [x] 8.3 Run `pnpm test --filter packages/config` — all tests pass (including rod-level @ops merge tests)
- [x] 8.4 Run full test suite from repo root — all packages pass
