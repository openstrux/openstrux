## Capability: `explain`

### Requirements

- **EX-001**: `strux panel build --explain` produces human-readable output following ADR-013 template
- **EX-002**: Output includes numbered steps, each with: rod type, description, source location (file:line:col)
- **EX-003**: Output includes access context summary: principal, intent, scope
- **EX-004**: Output includes pushdown status count: how many rods have pushdown annotations
- **EX-005**: Output includes policy verification summary: inline/hub/external counts, opaque policy warnings
- **EX-006**: `--explain` text and `manifest.audit` field are generated from the same IR traversal — no divergence possible
- **EX-007**: `--explain-output <path>` writes to file instead of stdout

### Acceptance Scenarios

**Scenario: Basic panel explanation**
Given a valid P1 intake panel with Receive, Validate, Store, Respond rods
When `strux panel build --explain` is run
Then stdout contains 4 numbered steps with rod types and source locations
And an access context summary for the applicant principal

**Scenario: File output**
Given a valid panel
When `strux panel build --explain --explain-output /tmp/explain.txt` is run
Then `/tmp/explain.txt` contains the explanation text
And stdout does not contain explanation text
