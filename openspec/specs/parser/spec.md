## ADDED Requirements

### Requirement: Parser converts source text to a typed AST
The parser SHALL accept a UTF-8 string of `.strux` source and return a `ParseResult` containing an array of `StruxNode` and an array of `Diagnostic`. It SHALL NOT throw exceptions. `PanelNode` SHALL carry a `privacy?: Record<string, KnotValue>` field populated when an `@privacy { ... }` block is present in the panel body. When `@privacy` is absent, `privacy` SHALL be `undefined`.

#### Scenario: Valid source produces AST with no diagnostics
- **WHEN** the parser receives a valid `.strux` file matching a `conformance/valid/` fixture
- **THEN** `result.diagnostics` SHALL be empty and `result.ast` SHALL contain at least one node

#### Scenario: Invalid source produces diagnostics with no throw
- **WHEN** the parser receives a `.strux` file with a known syntax error
- **THEN** `result.diagnostics` SHALL contain at least one entry with a non-empty `code` and valid `line`/`col` values, and no exception SHALL be thrown

#### Scenario: @privacy block is parsed into PanelNode.privacy
- **WHEN** a panel body contains `@privacy { framework: gdpr, dpa_ref: "DPA-2026-001" }`
- **THEN** `PanelNode.privacy` is a record with keys `framework` and `dpa_ref`

#### Scenario: PanelNode.privacy is undefined when @privacy is absent
- **WHEN** a panel body does not contain `@privacy`
- **THEN** `PanelNode.privacy` is `undefined`

### Requirement: Parser handles all grant-workflow P0–P2 constructs
The parser SHALL correctly parse `@strux` record, enum, and union definitions; `@panel` blocks in shorthand form; all 18 rod types; `@access` blocks; and expression shorthand for filter, projection, and aggregation.

#### Scenario: Record definition is parsed
- **WHEN** source contains `@strux Proposal { id: UUID, title: String }`
- **THEN** `result.ast` SHALL contain a node with `kind: "record"` and `name: "Proposal"`

#### Scenario: Panel shorthand is parsed
- **WHEN** source contains a `@panel` block with rod lines in shorthand form
- **THEN** each rod line SHALL produce a `RodNode` child in the panel's `rods` array

#### Scenario: @access block is parsed
- **WHEN** a `@panel` contains an `@access { principal: ..., intent: ..., scope: ... }` block
- **THEN** the panel node's `access` field SHALL be a non-null `PanelAccessNode`

### Requirement: Diagnostics carry location and error code
Every `Diagnostic` SHALL include `line` (1-based), `col` (1-based), `length`, `severity` (`"error" | "warning"`), `code` (string, e.g. `"E001"`), and `message`.

#### Scenario: Missing closing brace produces located diagnostic
- **WHEN** source contains an unclosed `@panel` block
- **THEN** the diagnostic `code` SHALL be `"E001"` and `line`/`col` SHALL point to the last valid token before the missing brace

### Requirement: Expression shorthand is captured as raw text for v0.6.0
Filter, projection, and aggregation expressions inside rod knots SHALL be stored as `{ kind: "raw-expr", text: string }` nodes. Full expression AST parsing is deferred to v0.7.0.

#### Scenario: Filter expression is preserved
- **WHEN** a rod knot contains `filter: status == "submitted"`
- **THEN** the corresponding knot value SHALL be `{ kind: "raw-expr", text: "status == \"submitted\"" }`
