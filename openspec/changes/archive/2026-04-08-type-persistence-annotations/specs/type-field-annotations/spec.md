## ADDED Requirements

### Requirement: @type records support field-level persistence annotations
The language SHALL allow field declarations inside a `@type` record body to carry one or more inline annotations after the field type. The following annotations are supported: `@pk`, `@pk(default: cuid|uuid|ulid|autoincrement)`, `@default(expr)`, `@unique`, `@relation(field: f, ref: Model.f)`, `@relation(field: f, ref: Model.f, onDelete: Cascade|SetNull|Restrict|NoAction, onUpdate: Cascade|SetNull|Restrict|NoAction)`, `@updatedAt`, `@column("name")`, `@ignore`.

#### Scenario: Record with @pk annotation parses cleanly
- **WHEN** `@type Proposal { id: string @pk, title: string }` is parsed
- **THEN** the AST TypeRecord node for `Proposal` SHALL contain a `FieldAnnotation { kind: "pk" }` on the `id` field

#### Scenario: @pk with explicit default parses cleanly
- **WHEN** `@type Proposal { id: string @pk(default: uuid) }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "pk", default: "uuid" }` on `id`

#### Scenario: @default with now parses cleanly
- **WHEN** `@type Proposal { createdAt: date @default(now) }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "default", value: "now" }` on `createdAt`

#### Scenario: @default with scalar literal parses cleanly
- **WHEN** `@type Proposal { archived: bool @default(false) }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "default", value: false }` on `archived`

#### Scenario: @unique parses cleanly
- **WHEN** `@type User { email: string @unique }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "unique" }` on `email`

#### Scenario: @relation parses cleanly
- **WHEN** `@type Post { author: User @relation(field: authorId, ref: User.id) }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "relation", field: "authorId", ref: { model: "User", field: "id" } }` on `author`

#### Scenario: @relation with referential action parses cleanly
- **WHEN** `@type Post { author: User @relation(field: authorId, ref: User.id, onDelete: Cascade) }` is parsed
- **THEN** the AST relation annotation SHALL include `onDelete: "Cascade"`

#### Scenario: @updatedAt parses cleanly
- **WHEN** `@type Post { updatedAt: date @updatedAt }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "updatedAt" }` on `updatedAt`

#### Scenario: @column parses cleanly
- **WHEN** `@type Post { submittedAt: date @column("submitted_at") }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "column", name: "submitted_at" }` on `submittedAt`

#### Scenario: @ignore parses cleanly
- **WHEN** `@type Post { internalNote: string @ignore }` is parsed
- **THEN** the AST SHALL contain `FieldAnnotation { kind: "ignore" }` on `internalNote`

#### Scenario: Multiple annotations on one field parse cleanly
- **WHEN** `@type User { id: string @pk @column("user_id") }` is parsed
- **THEN** the `id` field SHALL carry both a `pk` and a `column` annotation

---

### Requirement: @type records support block-level persistence annotations
The language SHALL allow `@@index`, `@@unique`, and `@@table` as block-level statements inside a `@type` record body (not attached to any single field).

#### Scenario: @@index parses cleanly
- **WHEN** `@type Proposal { id: string @pk, status: string, @@index([status]) }` is parsed
- **THEN** the AST TypeRecord node SHALL contain a `TypeBlockAnnotation { kind: "index", fields: ["status"] }`

#### Scenario: @@unique parses cleanly
- **WHEN** `@type User { firstName: string, lastName: string, @@unique([firstName, lastName]) }` is parsed
- **THEN** the AST TypeRecord node SHALL contain `TypeBlockAnnotation { kind: "unique", fields: ["firstName", "lastName"] }`

#### Scenario: @@table parses cleanly
- **WHEN** `@type Proposal @table("proposals") { id: string @pk }` is parsed (or `@@table("proposals")` inside the body)
- **THEN** the AST TypeRecord node SHALL contain `TypeBlockAnnotation { kind: "table", name: "proposals" }`

---

### Requirement: @timestamps decorator auto-injects createdAt and updatedAt
A `@timestamps` decorator on a `@type` declaration SHALL cause the compiler to inject `createdAt: date @default(now)` and `updatedAt: date @updatedAt` into the type body as if the author had declared them explicitly.

#### Scenario: @timestamps injects fields
- **WHEN** `@type Proposal @timestamps { id: string @pk, title: string }` is compiled
- **THEN** the resolved TypeRecord SHALL contain `createdAt` with `@default(now)` and `updatedAt` with `@updatedAt`, in addition to the declared fields

#### Scenario: @timestamps does not duplicate if fields already declared
- **WHEN** `@type Proposal @timestamps { id: string @pk, createdAt: date @default(now) }` is compiled
- **THEN** the validator SHALL emit `E_TIMESTAMPS_DUPLICATE` and fail — authors must not declare `createdAt`/`updatedAt` manually when `@timestamps` is present

---

### Requirement: Validator accepts common Prisma-familiar aliases with a helpful warning
To lower the barrier for developers migrating from Prisma, the validator SHALL recognise common aliases for Openstrux annotation names, emit a `W_ANNOTATION_ALIAS` warning with the canonical name, and continue processing as if the canonical annotation was used. The build SHALL NOT fail on alias usage alone.

Recognised aliases:

| Alias | Canonical | Notes |
|---|---|---|
| `@id` | `@pk` | Direct Prisma name for primary key |
| `@id(default: cuid())` | `@pk(default: cuid)` | Prisma function-call style |
| `@map("col")` | `@column("col")` | Prisma column-rename attribute |
| `@@map("tbl")` | `@@table("tbl")` | Prisma table-rename block attribute |

#### Scenario: @id is accepted and emits W_ANNOTATION_ALIAS
- **WHEN** `@type Proposal { id: string @id }` is parsed
- **THEN** the validator SHALL emit `W_ANNOTATION_ALIAS: @id is an alias for @pk — use @pk for canonical Openstrux syntax`
- **AND** the AST SHALL contain `FieldAnnotation { kind: "pk" }` on `id` (alias resolved)

#### Scenario: @map is accepted and emits W_ANNOTATION_ALIAS
- **WHEN** `@type Post { submittedAt: date @map("submitted_at") }` is parsed
- **THEN** the validator SHALL emit `W_ANNOTATION_ALIAS: @map is an alias for @column — use @column("submitted_at")`
- **AND** the AST SHALL contain `FieldAnnotation { kind: "column", name: "submitted_at" }` (alias resolved)

#### Scenario: Unknown annotation is a hard error, not an alias
- **WHEN** `@type Post { title: string @nonexistent }` is parsed
- **THEN** the validator SHALL emit `E_UNKNOWN_ANNOTATION` and fail — only documented aliases are treated leniently

---

### Requirement: Validator enforces annotation consistency
The validator SHALL enforce structural rules on field annotations.

#### Scenario: More than one @pk on a record is an error
- **WHEN** a `@type` record contains two fields with `@pk`
- **THEN** the validator SHALL emit `E_DUPLICATE_PK` and fail

#### Scenario: @pk on a union type is an error
- **WHEN** `@pk` is applied to a field in a `@type union { ... }` declaration
- **THEN** the validator SHALL emit `E_PK_ON_UNION` and fail

#### Scenario: @relation ref must resolve to an existing @type
- **WHEN** `@type Post { author: Person @relation(field: authorId, ref: Person.id) }` is parsed and no `@type Person` exists in scope
- **THEN** the validator SHALL emit `E_UNRESOLVED_RELATION_REF` and fail

#### Scenario: @relation field must exist on the owning type
- **WHEN** `@type Post { author: User @relation(field: nonExistentId, ref: User.id) }` is parsed
- **THEN** the validator SHALL emit `E_MISSING_RELATION_FIELD` and fail

#### Scenario: @updatedAt on a non-date field is an error
- **WHEN** `@type Post { title: string @updatedAt }` is parsed
- **THEN** the validator SHALL emit `E_UPDATEDAT_TYPE_MISMATCH` and fail

---

### Requirement: @external type modifier marks non-owned types
The language SHALL support `@external type Name { ... }` to declare a type that exists in the database but is not owned by this Openstrux project. External types participate in the type system but generate no DDL.

#### Scenario: @external type is valid in @relation refs
- **WHEN** `@external type LegacyUser { id: string }` is declared and an owned type has `@relation(field: userId, ref: LegacyUser.id)`
- **THEN** the validator SHALL accept the relation and emit no error

#### Scenario: @external type with @pk is an error
- **WHEN** `@external type LegacyUser { id: string @pk }` is parsed
- **THEN** the validator SHALL emit `E_EXTERNAL_PK` and fail (external types must not carry ownership annotations)

---

### Requirement: @opaque preserves unmodelled DB features
The language SHALL support `@opaque <content>` as a block-level statement inside a `@type` body. The compiler SHALL parse and preserve opaque content but SHALL NOT interpret it.

#### Scenario: @opaque survives parse → IR round-trip
- **WHEN** `@type Proposal { id: string @pk, @opaque index("idx_status", [status]) }` is parsed and emitted
- **THEN** the emitted output SHALL contain the opaque annotation content unchanged

#### Scenario: @opaque does not affect TypeScript output
- **WHEN** a `@type` with `@opaque` is processed
- **THEN** the generated TypeScript interface SHALL NOT include any content from the opaque annotation
