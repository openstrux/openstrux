## Why

ADR-014 makes `snap.lock` a first-class input to compilation and states that identical source plus identical lock must yield byte-identical `mf.strux.json` and semantically identical emitted code. Without lock generation and consumption in the same release train, manifest work and generator goldens sit on weaker ground — there is no mechanism to freeze dependency state and verify deterministic builds.

The architecture treats the lock as part of the trust boundary. Manifest content hashes and certification scope are only meaningful if the dependency versions they reflect are pinned. Lock-determinism is the bridge between "validated model" and "reproducible compiled output."

## What Changes

- Implement `packages/lock/` in openstrux-core — `snap.lock` schema, generation, consumption, and determinism verification
- Lock generation: after config resolution and validation, the lock captures resolved adapter versions, type registrations, hub artifact hashes, and named source/target configurations
- Locked-build verification: given source + lock, the build must produce byte-identical manifest and semantically identical generated code
- Determinism tests: golden fixtures asserting same source + same lock = same output

## Capabilities

### New Capabilities

- `lock-generation`: Generates `snap.lock` from a validated, config-resolved AST — pins adapter versions, hub artifact hashes, and resolved config values
- `lock-consumption`: Reads `snap.lock` during build and constrains resolution to pinned versions
- `lock-determinism`: Verifies that source + lock produces byte-identical `mf.strux.json` content hash and semantically identical generated files

### Modified Capabilities

_(none)_

## Impact

- **openstrux-core**: `packages/lock/` goes from stub to implementation
- **openstrux-spec**: Lock schema formalised per ADR-014; determinism test vectors added to `conformance/golden/`
- **Downstream**: Manifest-explain consumes the lock state to produce a fully-deterministic manifest; target generators consume lock to ensure reproducible output
- **No breaking changes**
