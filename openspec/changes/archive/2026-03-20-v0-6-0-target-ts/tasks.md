## 1. Generator specification (openstrux-spec)

- [x] 1.1 Write `openstrux-spec/specs/modules/target-ts/generator.md` — normative mapping rules: `@type` record -> Prisma model + TypeScript interface; `@type` enum -> Prisma enum + TypeScript enum; `@type` union -> TypeScript discriminated union; rod-to-code mappings for receive, respond, validate, guard, store, read-data; raw-expr fallback rules
- [x] 1.2 Include normative examples for each mapping rule
- [x] 1.3 Define output file structure: `types/`, `lib/schemas/`, `app/api/<panel>/route.ts`, `middleware/`

## 2. RFC-0001 draft

- [x] 2.1 Write `openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md` using the RFC template — cover adapter contract, `GeneratedFile` type, registry, target selection, adapter lifecycle
- [x] 2.2 Write RFC-0001 Annex A: Canonical Source Form for Content Hashing — define the exact canonicalization algorithm with test vectors
- [x] 2.3 Set RFC status to `Draft`; record proposer as Olivier Fabre; mark `AI-assisted: true`
- [x] 2.4 Self-accept RFC (bootstrap phase, sole maintainer) — update status to `Accepted`

## 3. Generator engine (openstrux-core/packages/generator)

- [x] 3.1 Add `packages/generator/` to `pnpm-workspace.yaml` and `turbo.json`
- [x] 3.2 Define `GeneratedFile`, `GenerateOptions`, `Adapter`, `UnknownTargetError` in `packages/generator/src/types.ts`
- [x] 3.3 Implement adapter registry (`registerAdapter`, `getAdapter`) in `packages/generator/src/registry.ts`
- [x] 3.4 Implement `generate()` top-level function wiring registry + adapter dispatch
- [x] 3.5 Write unit tests for registry (register, get, unknown target error)

## 4. TypeScript target adapter

- [x] 4.1 Scaffold `packages/generator/src/adapters/typescript/index.ts` implementing `Adapter` interface
- [x] 4.2 Implement record emitter -> TypeScript `interface` + Prisma `model` block (per generator.md spec)
- [x] 4.3 Implement enum emitter -> TypeScript `enum` + Prisma `enum` block
- [x] 4.4 Implement union emitter -> TypeScript discriminated union type
- [x] 4.5 Implement Prisma schema accumulator — collects all models/enums, emits single `schema.prisma`
- [x] 4.6 Implement `receive` rod emitter -> Next.js App Router `route.ts` stub
- [x] 4.7 Implement `respond` rod emitter -> add response type to route stub
- [x] 4.8 Implement `validate` rod emitter -> Zod schema from referenced `@type` record
- [x] 4.9 Implement `guard` rod emitter -> access middleware stub using panel AccessContext
- [x] 4.10 Implement `store` rod emitter -> Prisma client call stub
- [x] 4.11 Implement `read-data` rod emitter -> Prisma query stub
- [x] 4.12 Implement raw-expr fallback -> `// TODO: implement expression: <text>` comment

## 5. Golden fixtures and conformance

- [x] 5.1 Run generator on `conformance/valid/p0-domain-model.strux` -> capture output files
- [x] 5.2 Verify all output files compile (`tsc --noEmit`)
- [x] 5.3 Write golden files to `openstrux-spec/conformance/golden/target-ts/p0-*`
- [x] 5.4 Mirror golden fixtures into `openstrux-core/tests/fixtures/golden/target-ts/`
- [x] 5.5 Write conformance test that diffs actual output vs golden (normalised whitespace + sorted imports)
- [x] 5.6 Run `pnpm test` from repo root — all packages pass
