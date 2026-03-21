## Capability: `lock-determinism`

### Requirements

- **LD-001**: `snap.lock` is a JSON file with `lockVersion`, `specVersion`, `generatedAt`, and `entries[]`
- **LD-002**: Each lock entry pins a resolved dependency: `key`, `kind` (adapter/config/type/hub-artifact), `version`, `hash`
- **LD-003**: Lock generation captures all resolved state: adapter versions, config fingerprints, type registration hashes
- **LD-004**: Lock consumption verifies current resolution matches lock entries — emits `E_LOCK_MISMATCH` on divergence
- **LD-005**: Determinism contract: same source + same `snap.lock` = byte-identical `mf.strux.json` `contentHash`
- **LD-006**: Build without lock file emits `W_NO_LOCK` and auto-generates lock
- **LD-007**: Lock referencing a different spec version emits `E_LOCK_STALE`
- **LD-008**: `snap.lock` JSON is serialised with sorted keys and consistent formatting for diff-ability

### Acceptance Scenarios

**Scenario: Deterministic build**
Given source file `p0-domain-model.strux` and a valid `snap.lock`
When `strux panel build` is run twice
Then both runs produce identical `mf.strux.json` `contentHash`

**Scenario: Lock mismatch on source change**
Given a valid `snap.lock` generated for source v1
When source is modified (field added) and `strux panel build` is run without `--lock-update`
Then `E_LOCK_MISMATCH` is emitted and build fails

**Scenario: No lock file**
Given a project with no `snap.lock`
When `strux panel build` is run
Then `W_NO_LOCK` is emitted and `snap.lock` is auto-generated

**Scenario: Stale lock**
Given a `snap.lock` with `specVersion: "0.5.0"` and current spec is `0.6.0`
When `strux panel build` is run
Then `E_LOCK_STALE` is emitted
