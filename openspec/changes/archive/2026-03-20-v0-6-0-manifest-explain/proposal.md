## Why

Validation and config resolution produce a clean, resolved AST. Lock-determinism freezes the dependency state. The next step is to emit the compiled manifest (`mf.strux.json`) and human-readable explanation output (`--explain`). These are compiled-output concerns tied to traceability and deterministic artifacts — they sit on top of the validated, locked model, not alongside the semantic validation layer.

The manifest is the compiled, fully resolved artifact — not a source-level convenience view. It contains the content hash, certification scope, and structured audit metadata (ADR-013). The `--explain` flag is the near-term answer for human traceability, replacing deferred reverse translation (ADR-013).

## What Changes

- Implement `packages/manifest/` — takes a validated, locked AST and emits `mf.strux.json` with version, `artifactHash` (SHA-256 of the compiled manifest content), certification scope, timestamp, `lockRef` (referencing `sourceHash` from `snap.lock`), and structured audit/explanation metadata (ADR-013)
- Implement `--explain` output on `strux panel build` — human-readable panel explanation from the IR with source location tracing (ADR-013)
- Add `conformance/golden/` fixtures in `openstrux-spec` for expected manifest output

## Capabilities

### New Capabilities

- `manifest`: Generates `mf.strux.json` from a validated, locked AST — includes `schemaVersion`, `version`, `artifactHash` (SHA-256 of compiled manifest), `certificationScope`, `timestamp`, `lockRef` (linking to `sourceHash` in snap.lock), and structured `audit` field (ADR-013)
- `explain`: `strux panel build --explain` generates human-readable panel explanation from the IR — traces every step to source location, includes access context, pushdown status, and policy verification (ADR-013)
- `conformance-fixtures-golden`: Expected `mf.strux.json` outputs for P0 domain model fixtures

### Modified Capabilities

_(none)_

## Impact

- **openstrux-core**: `packages/manifest/` goes from stub to implementation; `--explain` flag added to CLI
- **openstrux-spec**: New golden fixtures under `conformance/golden/`
- **Downstream**: Target generators require a manifest-stamped AST as input — this change unblocks target generation
- **No breaking changes**
