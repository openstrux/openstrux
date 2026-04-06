## MODIFIED Requirements

### Requirement: Parser converts source text to a typed AST
The parser SHALL convert `.strux` source text to a typed AST. `PanelNode` SHALL carry a `privacy?: Record<string, KnotValue>` field populated when an `@privacy { ... }` block is present in the panel body. When `@privacy` is absent, `privacy` SHALL be `undefined`.

#### Scenario: @privacy block is parsed into PanelNode.privacy
- **WHEN** a panel body contains `@privacy { framework: gdpr, dpa_ref: "DPA-2026-001" }`
- **THEN** `PanelNode.privacy` is a record with keys `framework` and `dpa_ref`

#### Scenario: PanelNode.privacy is undefined when @privacy is absent
- **WHEN** a panel body does not contain `@privacy`
- **THEN** `PanelNode.privacy` is `undefined`

#### Scenario: Parser handles all grant-workflow P0–P2 constructs
- **WHEN** valid grant-workflow `.strux` source files are parsed
- **THEN** zero parse errors are emitted and all nodes are present in the AST

#### Scenario: Diagnostics carry location and error code
- **WHEN** a parse error occurs
- **THEN** the diagnostic includes the source location (line, col) and an error code

#### Scenario: Expression shorthand is captured as raw text for v0.6.0
- **WHEN** a rod knot contains an expression shorthand
- **THEN** the parser captures it as raw text without evaluating it
