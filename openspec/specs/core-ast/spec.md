## ADDED Requirements

### Requirement: AST node types mirror the spec type system
The `packages/ast/` module SHALL export a TypeScript interface for every structural form defined in `openstrux-spec/specs/core/type-system.md`. Every node SHALL carry a `kind` discriminant field with a literal string value.

#### Scenario: Record node is representable
- **WHEN** a `.strux` source defines `@type Proposal { id: UUID, title: String }`
- **THEN** the AST SHALL represent it as `{ kind: "TypeRecord", name: "Proposal", fields: [...] }`

#### Scenario: Enum node is representable
- **WHEN** a `.strux` source defines `@type Status = enum { draft | submitted | approved }`
- **THEN** the AST SHALL represent it as `{ kind: "TypeEnum", name: "Status", variants: [...] }`

#### Scenario: Union node is representable
- **WHEN** a `.strux` source defines `@type DataSource = union { stream: StreamSource, db: DbSource }`
- **THEN** the AST SHALL represent it as `{ kind: "TypeUnion", name: "DataSource", variants: [...] }`

#### Scenario: Panel node contains rods and access block
- **WHEN** a `.strux` source defines `@panel Intake { @access { ... } Receive(...) Validate(...) }`
- **THEN** the AST SHALL represent it as `{ kind: "Panel", name: "Intake", access: AccessContext, rods: [...] }`

#### Scenario: Rod node carries knots
- **WHEN** a rod `validate = Validate(ProposalSchema)` is parsed
- **THEN** the AST SHALL represent it as `{ kind: "Rod", rodType: "validate", binding: "validate", knots: { cfg: {...}, in: {...}, out: {...} } }`

### Requirement: AST is export-only — no runtime logic
The `packages/ast/` module SHALL contain only type declarations (interfaces, type aliases, enums). It SHALL NOT contain classes, functions, or runtime logic.

#### Scenario: Package has no runtime output
- **WHEN** `packages/ast/` is built
- **THEN** the compiled output SHALL contain only `.d.ts` declaration files and no `.js` files with runtime code

### Requirement: Existing AST implementation is reviewed against v0.5.0 spec
The existing v0.5.0-alpha.0 AST implementation SHALL be reviewed against the current `openstrux-spec@0.5.0` and updated where drift is found. Review covers all source files: `common.ts`, `types.ts`, `values.ts`, `expressions.ts`, `access.ts`, `panel.ts`, `index.ts`.

#### Scenario: AST matches current spec
- **WHEN** `packages/ast/` is diffed against `openstrux-spec/specs/core/type-system.md` and `openstrux-spec/specs/core/ir.md`
- **THEN** all structural forms SHALL have corresponding AST node types with no missing fields

### Requirement: AST exports are stable and versioned
The public exports of `packages/ast/` SHALL not change shape between patch releases.

#### Scenario: Downstream package imports remain valid after patch
- **WHEN** `packages/ast/` receives a patch release
- **THEN** all existing import statements in downstream packages SHALL continue to compile
