# Capability: grant-workflow-strux-sources

## Purpose

Defines the `.strux` source files for the grant-workflow use case. Covers the P0 domain model, P1 intake panel, P2 eligibility panel, and the token-efficient authoring pattern using context cascade and shorthand syntax.

## Requirements

### Requirement: P0 domain model is expressed as @type definitions
`openstrux-uc-grant-workflow/specs/p0-domain-model.strux` SHALL define all types needed for the grant-workflow domain using `@type` keyword: `Proposal`, `Reviewer`, `EligibilityRecord`, `ReviewStatus`, `ProposalStatus`. Each type SHALL use the appropriate form (record, enum, or union).

#### Scenario: P0 file parses and validates with zero errors
- **WHEN** the toolchain processes `specs/p0-domain-model.strux`
- **THEN** parse and validate SHALL each return zero error-severity diagnostics

#### Scenario: P0 file generates Prisma models and TypeScript types
- **WHEN** the generator processes the validated P0 AST
- **THEN** `output/openstrux/` SHALL contain `schema.prisma` with all five types and TypeScript files in `types/`

### Requirement: P1 intake panel is expressed as a shorthand @panel
`openstrux-uc-grant-workflow/specs/p1-intake.strux` SHALL define `@panel Intake` in shorthand form with rods: `Receive`, `Validate`, `Store`, `Respond`. The panel SHALL include an `@access` block specifying the `applicant` principal.

#### Scenario: P1 file parses and validates with zero errors
- **WHEN** the toolchain processes `specs/p1-intake.strux`
- **THEN** parse and validate SHALL each return zero error-severity diagnostics

#### Scenario: P1 file generates a Next.js route and Zod schema
- **WHEN** the generator processes the validated P1 AST
- **THEN** `output/openstrux/` SHALL contain `app/api/intake/route.ts` and `lib/schemas/ProposalSchema.ts`

### Requirement: P2 eligibility panel is expressed as a shorthand @panel
`openstrux-uc-grant-workflow/specs/p2-eligibility.strux` SHALL define `@panel Eligibility` in shorthand form with rods: `Guard`, `ReadData`, `Transform`, `Respond`. The panel SHALL include an `@access` block specifying the `admin` principal.

#### Scenario: P2 file parses and validates with zero errors
- **WHEN** the toolchain processes `specs/p2-eligibility.strux`
- **THEN** parse and validate SHALL each return zero error-severity diagnostics

#### Scenario: P2 file generates a guarded route with Prisma query stub
- **WHEN** the generator processes the validated P2 AST
- **THEN** `output/openstrux/` SHALL contain `app/api/eligibility/route.ts` and `middleware/eligibility.ts`

### Requirement: Strux source files follow token-efficient authoring pattern
The `.strux` source files SHALL use context cascade (root `strux.context` + domain `strux.context` + small delta panels), named references, and shorthand syntax with implicit chaining. Panels SHALL declare only the delta from their inherited context.

#### Scenario: Panel inherits defaults from context
- **WHEN** the P1 panel is resolved
- **THEN** `@dp` and named source/target values SHALL come from the context cascade, not repeated inline in the panel
