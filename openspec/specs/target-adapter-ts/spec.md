### Requirement: @type record generates a Prisma model and TypeScript interface
For each `@type` record node, the TypeScript adapter SHALL emit a Prisma `model` block in `schema.prisma` and a TypeScript `interface` in `types/<RecordName>.ts`, per `specs/modules/target-ts/generator.md`.

#### Scenario: Record produces compilable TypeScript interface
- **WHEN** the adapter processes `@type Proposal { id: UUID, title: String, status: ReviewStatus }`
- **THEN** `types/Proposal.ts` SHALL contain `export interface Proposal { id: string; title: string; status: ReviewStatus; }`

#### Scenario: Record produces valid Prisma model
- **WHEN** the adapter processes the same `@type Proposal` record
- **THEN** `schema.prisma` SHALL contain a `model Proposal { ... }` block with all fields mapped to Prisma scalar types

### Requirement: @type enum generates a Prisma enum and TypeScript enum
For each `@type` enum node, the TypeScript adapter SHALL emit a Prisma `enum` block and a TypeScript `enum` declaration.

#### Scenario: Enum produces TypeScript and Prisma enum
- **WHEN** the adapter processes `@type ReviewStatus = enum { draft | submitted | approved | rejected }`
- **THEN** `types/ReviewStatus.ts` SHALL export a TypeScript `enum ReviewStatus` and `schema.prisma` SHALL contain `enum ReviewStatus { draft submitted approved rejected }`

### Requirement: @type union generates a TypeScript discriminated union
For each `@type` union node, the TypeScript adapter SHALL emit a discriminated union type (no Prisma equivalent — unions are TypeScript-only).

#### Scenario: Union produces discriminated union type
- **WHEN** the adapter processes `@type DataSource = union { stream: StreamSource, db: DbSource }`
- **THEN** `types/DataSource.ts` SHALL export a discriminated union type

### Requirement: receive rod generates a Next.js App Router route stub
For each `receive` rod in a panel, the TypeScript adapter SHALL emit a `route.ts` file under `app/api/<panel-name>/`.

#### Scenario: Receive rod with HTTP method produces route handler
- **WHEN** a panel contains `Receive (http POST /proposals)`
- **THEN** `app/api/<panel-name>/route.ts` SHALL export a `POST` async function with typed `Request`

### Requirement: validate rod generates a Zod schema
For each `validate` rod referencing a `@type` record, the adapter SHALL emit a Zod schema.

#### Scenario: Validate rod produces Zod schema
- **WHEN** a panel contains `Validate(ProposalSchema)` and `@type ProposalSchema` is defined
- **THEN** `lib/schemas/ProposalSchema.ts` SHALL export a `z.object({...})` schema

### Requirement: guard rod generates an access middleware stub
For each `guard` rod, the adapter SHALL emit a middleware function using the panel's AccessContext.

#### Scenario: Guard rod produces middleware with principal check
- **WHEN** a panel has `@access { principal: { roles: ["reviewer"] } }` and a `Guard` rod
- **THEN** `middleware/<panel-name>.ts` SHALL export a function that checks `roles`

### Requirement: raw-expr nodes emit TODO comments
Where a rod knot contains a `raw-expr` node, the adapter SHALL emit `// TODO: implement expression: <text>`, keeping surrounding code compilable.

#### Scenario: Filter expression becomes a TODO comment
- **WHEN** a rod knot contains `{ kind: "raw-expr", text: "status == \"submitted\"" }`
- **THEN** the generated file SHALL contain the TODO comment and remain valid TypeScript
