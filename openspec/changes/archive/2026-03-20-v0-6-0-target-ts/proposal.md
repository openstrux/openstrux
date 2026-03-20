## Why

The toolchain can parse and validate `.strux` sources but produces nothing runnable. Target generation is what makes Openstrux useful: from a validated, manifest-stamped AST the generator emits real TypeScript artifacts (Prisma schema, Next.js API routes, Zod validators, access middleware stubs). This is the core of the v0.6.0 demo. An RFC (RFC-0001) accompanies this change because the TypeScript target adapter contract is normative — it sets the pattern for all future targets.

A generator specification (`specs/modules/target-ts/generator.md`) will be added to `openstrux-spec` defining the normative mapping from AST nodes to TypeScript constructs. This spec is the reference for the adapter implementation and for golden fixture validation.

## What Changes

- Implement `packages/generator/` in openstrux-core (new package, justified by RFC-0001)
- TypeScript target adapter: `@type` records/enums/unions -> Prisma schema; `receive`/`respond` rods -> Next.js API route stubs; `validate` rod -> Zod schema; `guard` rod -> access middleware stub
- RFC-0001 draft: defines the target adapter contract (input: validated AST + manifest; output: `GeneratedFile[]`; adapter registry; target selection). Includes Annex A: Canonical Source Form for Content Hashing
- `openstrux-spec/specs/modules/target-ts/generator.md`: normative generator mapping specification — defines what each AST node type produces as TypeScript output
- Golden fixtures in `openstrux-spec/conformance/golden/` for generated TypeScript output

## Capabilities

### New Capabilities

- `generator`: Adapter-based code generation engine — takes validated AST + manifest, selects target adapter, returns `GeneratedFile[]`
- `target-adapter-ts`: TypeScript/Prisma/Next.js/Zod adapter implementing the RFC-0001 contract
- `generator-spec`: Normative mapping specification in `openstrux-spec` defining AST -> TypeScript rules
- `conformance-fixtures-golden-ts`: Golden `.ts` and `.prisma` output files

### Modified Capabilities

_(none — RFC-0001 introduces new normative contract)_

## Impact

- **openstrux-core**: New `packages/generator/` package
- **openstrux-spec**: New golden fixtures; RFC-0001 in `rfcs/`; generator spec in `specs/modules/target-ts/`
- **openstrux-uc-grant-workflow**: Consumes the generator output — this change enables the demo
- **No breaking changes**
