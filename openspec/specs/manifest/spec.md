## Capability: `manifest`

### Requirements

- **MF-001**: Manifest is emitted only for a fully-valid, locked AST — null if validation errors exist
- **MF-002**: Content hash is SHA-256 of canonicalised source — stable across reformatting (same hash for reordered declarations, added comments, whitespace changes)
- **MF-003**: `@cert` blocks are excluded from canonical form to avoid circular dependency
- **MF-004**: Certification scope lists all type paths actually used in the validated AST
- **MF-005**: Manifest includes `lockRef` — content hash of the `snap.lock` used during build (null if no lock)
- **MF-006**: Manifest includes structured `audit` field (ADR-013) with per-rod explanation entries
- **MF-007**: Golden fixtures pin expected output for regression testing

### Acceptance Scenarios

**Scenario: Deterministic hash**
Given `p0-domain-model.strux` with declarations in order A-B-C
And the same file with declarations reordered to C-A-B
When manifest is generated for both
Then both produce identical `contentHash`

**Scenario: Validation failure**
Given a `.strux` file with an unresolved type reference
When the build pipeline runs
Then manifest is null (not generated)

**Scenario: Audit field populated**
Given a valid panel with 4 rods
When manifest is generated
Then `audit.entries` has 4 entries with step numbers, rod types, and source locations
