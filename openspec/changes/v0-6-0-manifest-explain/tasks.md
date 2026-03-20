## 1. Manifest schema and types

- [x] 1.1 Define `Manifest` interface in `packages/manifest/src/types.ts` with `schemaVersion`, `version`, `contentHash`, `certificationScope`, `timestamp`, `lockRef`, and `audit` object (ADR-013)
- [x] 1.2 Define `AuditEntry` interface — `{ step: number, rod: string, description: string, loc: { file, line, col }, pushdownStatus?: string, accessContext?: object, policyVerification?: string }`
- [x] 1.3 Define `ManifestDiagnostic` codes: `I_MANIFEST_GENERATED`, `E_MANIFEST_HASH_CHANGED`

## 2. Content hash and canonical form

- [x] 2.1 Implement source canonicaliser — sorts top-level declarations alphabetically, normalises whitespace, strips comments, excludes `@cert` blocks from hash input
- [x] 2.2 Implement SHA-256 content hash using Node.js `crypto` module
- [x] 2.3 Write test: same content in different declaration order -> same hash
- [x] 2.4 Write test: comment changes -> same hash
- [x] 2.5 Write test: `@cert` block presence/absence -> same hash

## 3. Certification scope and audit

- [x] 3.1 Implement certification scope extractor — collects all type paths from the validated AST
- [x] 3.2 Implement audit metadata generator — walks validated IR, produces per-rod `AuditEntry[]` with source locations, access context, pushdown status, policy verification
- [x] 3.3 Wire `lockRef` from lock package — include lock content hash in manifest
- [x] 3.4 Wire manifest emission into build pipeline — after lock freeze, before target generation
- [x] 3.5 Write unit tests: audit field populated, scope non-empty, lockRef present

## 4. Explanation generation (`--explain`)

- [x] 4.1 Implement `explain()` function in `packages/manifest/src/explain.ts` — takes validated IR + manifest audit data, returns formatted text following ADR-013 template
- [x] 4.2 Format: numbered steps with source locations, access context summary, pushdown count, escape hatch count, policy verification summary
- [x] 4.3 Wire `--explain` flag into CLI — output to stdout by default, `--explain-output <path>` for file
- [x] 4.4 Write unit test: P0 domain model explain output matches expected snapshot
- [x] 4.5 Verify `--explain` text and manifest `audit` field are generated from the same data (single IR traversal)

## 5. Golden fixtures and conformance

- [x] 5.1 Run manifest generation on `conformance/valid/p0-domain-model.strux` and capture output
- [x] 5.2 Write `openstrux-spec/conformance/golden/p0-domain-model.mf.strux.json` with `timestamp` replaced by `"__TIMESTAMP__"` and `lockRef` by `"__LOCK_REF__"` — verify `audit` field is present
- [x] 5.3 Mirror golden fixture into `openstrux-core/tests/fixtures/golden/`
- [x] 5.4 Write conformance test in `packages/manifest/src/__tests__/conformance.test.ts` that diffs actual vs golden (masking timestamp and lockRef)
- [x] 5.5 Run full test suite from repo root — all packages pass
