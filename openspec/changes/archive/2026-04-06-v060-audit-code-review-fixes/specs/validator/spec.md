## ADDED Requirements

### Requirement: Validator enforces @privacy path coverage
When a panel has `PanelNode.privacy` set (i.e., `@privacy` is declared), the validator SHALL emit `E_PRIVACY_BYPASS` (severity: error) if the panel contains no `private-data` rod. The validator SHALL NOT emit `E_PRIVACY_BYPASS` when `@privacy` is absent.

#### Scenario: @privacy without private-data rod
- **WHEN** a panel declares `@privacy { framework: gdpr }` and has no `private-data` rod
- **THEN** the validator emits `E_PRIVACY_BYPASS` with severity `error`

#### Scenario: @privacy with private-data rod present
- **WHEN** a panel declares `@privacy { framework: gdpr }` and has at least one `private-data` rod
- **THEN** the validator does NOT emit `E_PRIVACY_BYPASS`

#### Scenario: No @privacy — bypass rule silent
- **WHEN** a panel does not declare `@privacy`
- **THEN** the validator does NOT emit `E_PRIVACY_BYPASS`
