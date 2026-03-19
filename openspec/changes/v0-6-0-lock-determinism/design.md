## Context

ADR-014 defines the lock file contract: `snap.lock` is a deterministic lock pinning versions, hashes, and cert snapshots. The contract is: same source + same lock = same output. The lock file sits between validation/config resolution and manifest/target generation in the pipeline.

For v0.6.0, the dependency graph is simple — no hub artifacts, no remote adapters. But the lock infrastructure must exist because: (1) manifest content hashes are only reproducible when the inputs are frozen, (2) golden fixture tests for generated code require determinism, and (3) the grant-workflow demo must demonstrate reproducible builds.

## Goals / Non-Goals

**Goals:**
- `snap.lock` JSON schema: adapter versions, config fingerprints, hub artifact hashes (empty for v0.6.0), resolution timestamps
- Lock generation from validated + config-resolved AST
- Locked-build mode: read lock, constrain resolution, verify output matches
- Determinism assertion: two builds from same source + same lock produce byte-identical `mf.strux.json`
- Golden fixtures for lock-determinism

**Non-Goals:**
- Hub artifact resolution (no hub in v0.6.0 — fields are present but empty)
- Lock file merge/conflict resolution (post-0.6.0)
- Lock file migration between spec versions (post-0.6.0)
- Lock file signing or integrity verification beyond content hash (post-0.6.0)

## Decisions

**Lock file format: JSON (`snap.lock`)**
JSON for machine readability and diff-ability. The schema mirrors ADR-014 with fields: `lockVersion`, `specVersion`, `generatedAt`, `entries[]` where each entry pins a resolved dependency (adapter, config value, type registration). JSON rather than YAML to avoid parser ambiguity.

**Lock entries are keyed by type path + dependency kind**
Each lock entry: `{ key: string, kind: "adapter" | "config" | "type" | "hub-artifact", version: string, hash: string }`. For v0.6.0, `kind: "hub-artifact"` entries are absent (no hub). Config entries pin the resolved named source/target configurations.

**Lock generation is a side effect of build, not a separate command**
`strux panel build` generates or updates `snap.lock` when `--lock-update` is passed. Without the flag, it reads the existing lock and fails if resolution would differ. This matches the npm/pnpm install vs install-frozen pattern.

**Determinism verification: byte-identical artifact hash**
Two builds with identical source + identical `snap.lock` must produce the same `artifactHash` in `mf.strux.json`. The lock pins `sourceHash` (identity of canonicalised source) and the manifest computes `artifactHash` (identity of compiled output). Generated TypeScript is "semantically identical" (same AST after normalisation) — exact whitespace may vary between platforms. The `lockRef` in the manifest references the `sourceHash` from the lock, creating a verifiable chain.

**Lock is consumed before manifest generation**
Pipeline order: parse -> resolve config -> validate -> freeze lock -> generate manifest -> generate targets. The lock freezes state between validation and output generation.

## Risks / Trade-offs

**[Risk] Lock file adds a new file to every project — overhead for simple cases**
-> Mitigation: Lock is optional for v0.6.0. If no `snap.lock` exists, the build proceeds without determinism guarantees and emits `W_NO_LOCK` warning.

**[Risk] Lock entries for v0.6.0 are mostly empty (no hub, single adapter)**
-> Mitigation: The lock still pins config resolution and spec version. Even a minimal lock demonstrates the determinism contract and enables golden fixture tests.

**[Risk] Platform-dependent floating-point or timestamp differences break byte-identical assertion**
-> Mitigation: Timestamps in lock use ISO 8601 with UTC. Manifest `generatedAt` is excluded from content hash (only source canonical form is hashed). Golden fixture comparison masks `generatedAt`.

## Open Questions

- Should `snap.lock` be committed to version control? Decision: yes — same as `package-lock.json`. It is part of the reproducibility contract.
- Should lock generation run automatically on first build? Decision: yes for v0.6.0 — if no lock exists, generate one and emit `I_LOCK_CREATED` info diagnostic.
