## ADDED Requirements

### Requirement: @privacy block declared on panels
The `@privacy { framework, dpa_ref? }` block SHALL be recognised as a panel-level decorator. The parser SHALL store parsed key-value pairs in `PanelNode.privacy`. `framework` is required; `dpa_ref` is optional. `@privacy` MAY be inherited from `strux.context` (v0.7+; panel-level only in v0.6).

#### Scenario: @privacy block accepted in panel body
- **WHEN** a panel declares `@privacy { framework: gdpr }`
- **THEN** no parse error is emitted and `PanelNode.privacy` is set

#### Scenario: @privacy with dpa_ref
- **WHEN** a panel declares `@privacy { framework: gdpr, dpa_ref: "DPA-2026-001" }`
- **THEN** `PanelNode.privacy` contains both `framework` and `dpa_ref` fields
