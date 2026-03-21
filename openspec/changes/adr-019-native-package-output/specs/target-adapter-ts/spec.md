## MODIFIED Requirements

### Requirement: @type record generates a Prisma model and TypeScript interface
For each `@type` record node, the adapter SHALL emit a Prisma `model` block in `prisma/schema.prisma` and a TypeScript `interface` in `types/<RecordName>.ts`. Output paths SHALL be relative to the package output directory (`.openstrux/build/`).

#### Scenario: Record produces compilable TypeScript interface
- **WHEN** the adapter processes `@type Proposal { id: UUID, title: String, status: ReviewStatus }`
- **THEN** `types/Proposal.ts` SHALL contain `export interface Proposal { id: string; title: string; status: ReviewStatus; }`

#### Scenario: Record produces valid Prisma model
- **WHEN** the adapter processes the same `@type Proposal` record
- **THEN** `prisma/schema.prisma` SHALL contain a `model Proposal { ... }` block with all fields mapped to Prisma scalar types

### Requirement: receive rod generates a complete Next.js App Router route handler
For each `receive` rod in a panel, the adapter SHALL emit a complete route handler that chains all rods in the panel's pipeline into a working implementation. The handler SHALL NOT contain TODO stubs.

#### Scenario: Linear pipeline produces complete handler
- **WHEN** a panel contains `receive (http POST) → validate → write-data → respond` with typed connections
- **THEN** `handlers/<panel-name>.ts` SHALL export an async handler function that parses the request body, validates with the Zod schema, writes to the database via Prisma, and returns a JSON response

#### Scenario: Handler imports are complete
- **WHEN** a complete handler is generated
- **THEN** all necessary imports (NextRequest, NextResponse, Zod schema, Prisma client) SHALL be included at the top of the file

#### Scenario: Handler has no TODO comments
- **WHEN** a panel's pipeline is fully specified with typed rods
- **THEN** the generated handler SHALL NOT contain any `// TODO` comments

### Requirement: validate rod generates a Zod schema
For each `validate` rod referencing a `@type` record, the adapter SHALL emit a Zod schema.

#### Scenario: Validate rod produces Zod schema
- **WHEN** a panel contains `Validate(ProposalSchema)` and `@type ProposalSchema` is defined
- **THEN** `schemas/ProposalSchema.schema.ts` SHALL export a `z.object({...})` schema

### Requirement: guard rod generates an access middleware
For each `guard` rod, the adapter SHALL emit a guard function that checks the AccessContext.

#### Scenario: Guard produces access check
- **WHEN** a panel contains a `guard` rod with access rules
- **THEN** `guards/<panel-name>.guard.ts` SHALL export a guard function that checks AccessContext and throws on unauthorized access

## ADDED Requirements

### Requirement: Rod emitters produce chain steps, not standalone snippets
Each rod emitter SHALL produce a `ChainStep` containing imports, a code statement, and output variable/type information. The route handler emitter SHALL compose chain steps into a complete function body.

#### Scenario: Transform rod produces a chain step
- **WHEN** a `transform` rod is emitted with input type `Proposal` and output type `EligibilityRecord`
- **THEN** the chain step SHALL contain a typed function call statement and declare its output variable and type

#### Scenario: Chain steps compose into a handler
- **WHEN** a panel has 4 rods producing 4 chain steps
- **THEN** the handler emitter SHALL combine all steps' imports (deduplicated) and statements (in order) into a single async function

### Requirement: Adapter is registered as framework-specific
The adapter SHALL be registered under its framework name (e.g., `nextjs`) rather than the generic `typescript` name. The adapter name SHALL reflect the specific framework it targets.

#### Scenario: Next.js adapter registration
- **WHEN** the generator package is imported
- **THEN** `listTargets()` SHALL include `nextjs` and SHALL NOT include `typescript`

### Requirement: Shared TypeScript utilities are factored into ts-base
Type mappers (`tsType`, `prismaType`, `zodType`), schema emitters, and Prisma emitters SHALL be in a shared `ts-base` module used by all TypeScript-targeting adapters.

#### Scenario: ts-base utilities used by Next.js adapter
- **WHEN** the Next.js adapter emits a TypeScript interface
- **THEN** it SHALL use `tsType()` from the `ts-base` module, not a duplicate implementation

### Requirement: Package output includes barrel exports
The adapter's `package()` method SHALL produce barrel export files that re-export all generated types, schemas, and handlers.

#### Scenario: Root index.ts re-exports types
- **WHEN** the package is built with types `Proposal` and `ReviewStatus`
- **THEN** `index.ts` SHALL contain `export { Proposal } from "./types/Proposal.js"` and `export { ReviewStatus } from "./types/ReviewStatus.js"`

#### Scenario: Schemas sub-path export
- **WHEN** the package contains schemas
- **THEN** `schemas/index.ts` SHALL re-export all schema objects
