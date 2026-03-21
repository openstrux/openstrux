## Context

The v0.6.0 syntax reference documents types and patterns that have no implementation in the parser or validator. This was discovered during a multi-LLM review where all six models guessed different shapes for `@ops` fields, `validate.schema`, duration values, and stream config — because the spec lists these fields without defining their value types.

The parser, validator, and codegen foundation (target-ts, rods-target-ts) are complete or in progress. None of them exercise these gaps — the v0.6.0 grant-workflow uses only basic rods, db sources, and panel-level @ops. But the syntax reference is the canonical LLM system prompt: if it documents a feature, the toolchain should parse and validate it. This package closes the gap between what the spec documents and what the toolchain enforces, before the demo and benchmarks make the syntax reference's authority public.

## Goals / Non-Goals

**Goals:**
- Duration literal: lexer recognizes `30s`, `5m`, `24h`, `7d` as typed tokens (not raw strings)
- Rod-level `@ops`: parser accepts `@ops { ... }` inside rod blocks, not just at panel/context level
- `@ops` field schema: validator checks field names (`retry`, `timeout`, `fallback`, `circuit_breaker`, `rate_limit`) and value types
- `SchemaRef` type: validator resolves `validate.cfg.schema` to a declared `@type`
- `DataTarget` type: mirrors DataSource union tree for `write-data.cfg.target`
- Stream config fields: validator knows the expected fields for kafka/pubsub/kinesis adapters
- Spec formalization: implicit chaining rules 7-8, `from:` namespace resolution, `duration` in grammar EBNF

**Non-Goals:**
- Runtime duration parsing or arithmetic (post-v0.6.0)
- Full adapter config validation beyond field names (adapter packages own deep validation)
- Cross-panel @ops inheritance changes (already handled by config resolver)
- New rod types or knot changes

## Decisions

**Duration is a lexer token, not a parser construct**
The lexer emits `DURATION` tokens for `number + suffix` patterns. The parser treats them as value literals alongside `STRING`, `NUMBER`, `BOOL`. This keeps the grammar simple — no new expression rules needed.

Rationale: Duration values appear only in config positions (`cfg.size`, `@ops.timeout`, `@ops.circuit_breaker.window`). They don't participate in expressions (no `5m + 30s`). A lexer token is sufficient.

**Rod-level @ops is syntactic sugar for rod-scoped decorator**
When the parser encounters `@ops` inside a rod block, it attaches it as a `decorators.ops` field on the `RodNode` AST. This mirrors how panel-level decorators work. The config resolver already handles @ops merge (nearest wins) — rod-level wins over panel-level wins over context-level.

Rationale: The alternative (requiring @ops only at panel/context level) would force users to create separate panels for per-rod resilience — too verbose for the common case.

**@ops field schema is a static table in the validator, not a type definition**
The validator checks @ops fields against a hardcoded schema in `rod-signatures.ts` (or a new `ops-schema.ts`). We do not define `@type OpsConfig { ... }` in the language because @ops is a decorator, not a user-defined type.

Rationale: Decorator field schemas are fixed by the language spec. Users cannot define custom decorators in v0.6.0.

**SchemaRef resolves to @type names only (not arbitrary strings)**
`validate { schema: UserPayload }` requires `@type UserPayload` to be declared. String values like `schema: "UserPayload"` are not valid — the identifier must resolve in the symbol table.

Rationale: This is consistent with how `cfg.source` and `cfg.target` resolve to typed references. Opaque strings would defeat compile-time checking.

**DataTarget reuses DataSource union tree by declaration, not by alias**
We add a separate `@type DataTarget = union { ... }` in the datasource-hierarchy that mirrors DataSource. This avoids a language-level type alias feature (not in v0.6.0).

Rationale: DataTarget may diverge from DataSource in the future (e.g., append-only targets, CDC sinks). A separate declaration keeps this door open.

**Stream config fields are validated by name only, not by value type**
The validator checks that `stream.kafka` includes `brokers`, `topic`, and `credentials`, but does not validate their value types beyond basic string/number/record checks. Deep adapter validation is the adapter package's responsibility.

Rationale: Adapter config evolves independently of the core language. The validator ensures structural completeness; the adapter ensures semantic correctness.

## Risks / Trade-offs

**[Risk] Duration token conflicts with number-then-identifier sequences**
`5m` could be parsed as number `5` followed by identifier `m`. The lexer must be greedy: if a digit sequence is immediately followed by `s|m|h|d` with no whitespace, emit `DURATION`.
-> Mitigation: Whitespace is already required between tokens. `5 m` is number + identifier. `5m` is duration. Add lexer tests for edge cases.

**[Risk] Rod-level @ops may confuse users about merge precedence**
Rod @ops wins over panel @ops wins over context @ops. This is consistent but not obvious.
-> Mitigation: Document merge order in syntax-reference.md. Add a conformance fixture showing rod-level override.

**[Risk] SchemaRef as identifier-only rejects string-based schema references**
Some users may expect `schema: "UserPayload"` (string) to work.
-> Mitigation: Emit a helpful diagnostic: `E_SCHEMA_STRING: use schema: UserPayload (identifier), not "UserPayload" (string)`.

**[Risk] DataTarget mirroring DataSource creates maintenance burden**
If DataSource changes, DataTarget must change too.
-> Mitigation: Both are in the same file (`datasource-hierarchy.strux`). Add a comment linking them. Consider type alias in v0.7.0.

## Open Questions

- Should `duration` support compound values like `1h30m`? Decision: no for v0.6.0 — single unit only.
- Should `@ops.fallback` accept inline rod definitions or only references? Decision: references only (`@name` or `rod-name`).
- Should stream config fields be required or optional? Decision: `brokers`/`topic` required for kafka, `project`/`topic` required for pubsub, `region`/`stream_name` required for kinesis. `credentials` optional (may use ambient auth like `adc {}`).
