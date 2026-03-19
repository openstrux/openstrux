## 1. Generator specification (openstrux-spec)

- [ ] 1.1 Write `openstrux-spec/specs/modules/target-ts/generator.md` — normative mapping rules: `@type` record -> Prisma model + TypeScript interface; `@type` enum -> Prisma enum + TypeScript enum; `@type` union -> TypeScript discriminated union; rod-to-code mappings for receive, respond, validate, guard, store, read-data; raw-expr fallback rules
- [ ] 1.2 Include normative examples for each mapping rule
- [ ] 1.3 Define output file structure: `types/`, `lib/schemas/`, `app/api/<panel>/route.ts`, `middleware/`

## 2. RFC-0001 draft

- [ ] 2.1 Write `openstrux-spec/rfcs/RFC-0001-typescript-target-adapter.md` using the RFC template — cover adapter contract, `GeneratedFile` type, registry, target selection, adapter lifecycle
- [ ] 2.2 Write RFC-0001 Annex A: Canonical Source Form for Content Hashing — define the exact canonicalization algorithm with test vectors
- [ ] 2.3 Set RFC status to `Draft`; record proposer as Olivier Fabre; mark `AI-assisted: true`
- [ ] 2.4 Self-accept RFC (bootstrap phase, sole maintainer) — update status to `Accepted`

## 3. Generator engine (openstrux-core/packages/generator)

- [ ] 3.1 Add `packages/generator/` to `pnpm-workspace.yaml` and `turbo.json`
- [ ] 3.2 Define `GeneratedFile`, `GenerateOptions`, `Adapter`, `UnknownTargetError` in `packages/generator/src/types.ts`
- [ ] 3.3 Implement adapter registry (`registerAdapter`, `getAdapter`) in `packages/generator/src/registry.ts`
- [ ] 3.4 Implement `generate()` top-level function wiring registry + adapter dispatch
- [ ] 3.5 Write unit tests for registry (register, get, unknown target error)

## 4. TypeScript target adapter

- [ ] 4.1 Scaffold `packages/generator/src/adapters/typescript/index.ts` implementing `Adapter` interface
- [ ] 4.2 Implement record emitter -> TypeScript `interface` + Prisma `model` block (per generator.md spec)
- [ ] 4.3 Implement enum emitter -> TypeScript `enum` + Prisma `enum` block
- [ ] 4.4 Implement union emitter -> TypeScript discriminated union type
- [ ] 4.5 Implement Prisma schema accumulator — collects all models/enums, emits single `schema.prisma`
- [ ] 4.6 Implement `receive` rod emitter -> Next.js App Router `route.ts` stub
- [ ] 4.7 Implement `respond` rod emitter -> add response type to route stub
- [ ] 4.8 Implement `validate` rod emitter -> Zod schema from referenced `@type` record
- [ ] 4.9 Implement `guard` rod emitter -> access middleware stub using panel AccessContext
- [ ] 4.10 Implement `store` rod emitter -> Prisma client call stub
- [ ] 4.11 Implement `read-data` rod emitter -> Prisma query stub
- [ ] 4.12 Implement raw-expr fallback -> `// TODO: implement expression: <text>` comment

## 5. Golden fixtures and conformance

- [ ] 5.1 Run generator on `conformance/valid/p0-domain-model.strux` -> capture output files
- [ ] 5.2 Verify all output files compile (`tsc --noEmit`)
- [ ] 5.3 Write golden files to `openstrux-spec/conformance/golden/target-ts/p0-*`
- [ ] 5.4 Mirror golden fixtures into `openstrux-core/tests/fixtures/golden/target-ts/`
- [ ] 5.5 Write conformance test that diffs actual output vs golden (normalised whitespace + sorted imports)
- [ ] 5.6 Run `pnpm test` from repo root — all packages pass
