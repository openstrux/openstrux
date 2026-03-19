## Context

The spec mentions adapters and targets throughout but never defines the adapter contract concretely. This change establishes that contract as RFC-0001 and provides the first implementation (TypeScript target). The design must be general enough to accommodate a future Beam Python target without requiring changes to the generator engine.

The grant-workflow use case is TypeScript/Next.js/Prisma/Zod/Keycloak. The generator output must be compilable TypeScript — not pseudocode or templates, actual `.ts` and `.prisma` files.

A normative generator specification (`specs/modules/target-ts/generator.md`) defines the mapping rules. This spec is the reference for both the adapter implementation and golden fixture validation, ensuring the adapter contract is stabilized before too much target-specific surface area is baked in.

## Goals / Non-Goals

**Goals:**
- Define the adapter contract (RFC-0001): `Adapter.generate(ast, manifest, options): GeneratedFile[]`
- Generator specification in `openstrux-spec` defining normative mappings:
  - `@type` record -> Prisma model + TypeScript interface
  - `@type` enum -> Prisma enum + TypeScript enum
  - `@type` union -> TypeScript discriminated union type
  - `receive` rod -> Next.js App Router `route.ts` stub
  - `respond` rod -> adds response type to route stub
  - `validate` rod -> Zod schema derived from the referenced `@type` record
  - `guard` rod -> Next.js middleware stub using AccessContext
  - `store` rod -> Prisma client call stub
  - `read-data` rod -> Prisma query stub
- Golden fixtures pin expected output for regression testing

**Non-Goals:**
- Beam Python target (post-0.6.0)
- Full Keycloak integration code (stub only)
- Expression shorthand fully compiled to Prisma `where` clauses (raw-expr nodes emit TODO comments)
- Multi-file panel composition

## Decisions

**Adapter registry: static map, not plugin discovery**
For v0.6.0 the registry is `{ "typescript": TypeScriptAdapter }` hardcoded. Plugin discovery is post-0.6.0. The registry interface is defined now for future extension.

**GeneratedFile type: `{ path: string, content: string, lang: string }`**
Simple and serialisable. `path` is relative to the output root.

**One file per `@type`, one route file per `@panel`**
Each `@type` record/enum/union generates a file in `types/`. Each `@panel` generates a route file. Zod schemas in `lib/schemas/`. Access middleware in `middleware/`.

**Prisma schema accumulated across all `@type` definitions, emitted as single `schema.prisma`**
All models and enums accumulated and written as one file. Prisma doesn't support one file per model.

**raw-expr nodes emit TODO comments**
`// TODO: implement expression: <text>` — keeps output compilable while flagging the gap.

**Generator spec stabilizes the contract before implementation**
`openstrux-spec/specs/modules/target-ts/generator.md` defines the normative rules. The adapter implementation follows the spec. Golden fixtures validate the spec. This prevents the adapter from diverging from the intended contract.

**RFC-0001 includes normative Annex A: Canonical Source Form for Content Hashing**
Defines the exact canonicalization algorithm with test vectors.

## Risks / Trade-offs

**[Risk] Generated Prisma schema may not be valid for complex union types**
-> Mitigation: Unions are TypeScript discriminated union types only — not Prisma models. Documented in RFC.

**[Risk] Next.js App Router conventions change between versions**
-> Mitigation: Target adapter accepts `nextVersion` option; defaults to `"14"`.

**[Risk] Golden fixture content is brittle**
-> Mitigation: Golden comparison normalises whitespace and sorts imports before diffing.

## Open Questions

- Should the generator emit `package.json` / `tsconfig.json` for output? Decision: no for v0.6.0.
- Should `guard` rod generate global middleware or per-route wrapper? Decision: per-route wrapper.
