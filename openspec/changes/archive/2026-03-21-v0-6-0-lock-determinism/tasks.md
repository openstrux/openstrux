## 1. Lock schema and types

- [x] 1.1 Define `LockFile` interface in `packages/lock/src/types.ts` — `lockVersion`, `specVersion`, `generatedAt`, `entries: LockEntry[]`
- [x] 1.2 Define `LockEntry` interface — `key: string`, `kind: "adapter" | "config" | "type" | "hub-artifact"`, `version: string`, `hash: string`
- [x] 1.3 Define `LockDiagnostic` codes: `W_NO_LOCK`, `E_LOCK_MISMATCH`, `I_LOCK_CREATED`, `E_LOCK_STALE`
- [x] 1.4 Implement `snap.lock` JSON serialisation/deserialisation with schema validation

## 2. Lock generation

- [x] 2.1 Implement `generateLock(resolvedAST, config, adapterVersions): LockFile` — collects all resolved dependencies into lock entries
- [x] 2.2 Implement config fingerprinting — hash each resolved named source/target configuration
- [x] 2.3 Implement adapter version pinning — record the adapter version used for each target
- [x] 2.4 Implement type registration pinning — record the hash of each `@type` definition
- [x] 2.5 Write `snap.lock` to disk with deterministic JSON serialisation (sorted keys, consistent formatting)
- [x] 2.6 Wire lock generation into build pipeline with `--lock-update` flag

## 3. Lock consumption

- [x] 3.1 Implement `readLock(lockPath): LockFile` — parse and validate existing `snap.lock`
- [x] 3.2 Implement `verifyLock(currentState, lock): LockDiagnostic[]` — compare resolved state against lock entries, emit `E_LOCK_MISMATCH` on any difference
- [x] 3.3 Implement `E_LOCK_STALE` — emitted when lock exists but references a different spec version
- [x] 3.4 Wire lock consumption into build pipeline: fail-fast if lock exists and resolution differs (unless `--lock-update`)

## 4. Determinism tests

- [x] 4.1 Write determinism test: build P0 domain model twice with same source + same lock, assert byte-identical `mf.strux.json` `contentHash`
- [x] 4.2 Write determinism test: build P1 intake panel twice, assert same generated TypeScript (normalised comparison)
- [x] 4.3 Write golden fixture: `conformance/golden/lock/p0-domain-model.snap.lock` — expected lock output for P0
- [x] 4.4 Mirror golden fixtures into `openstrux-core/tests/fixtures/golden/lock/`
- [x] 4.5 Write test: modify one field in source, rebuild — assert `E_LOCK_MISMATCH` without `--lock-update`
- [x] 4.6 Write test: build without lock file — assert `W_NO_LOCK` warning and lock auto-generated

## 5. Integration

- [x] 5.1 Wire lock package into build pipeline between validator-config and manifest-explain
- [x] 5.2 Run `pnpm test --filter packages/lock` — all tests pass
- [x] 5.3 Run full test suite from repo root — all packages pass
