## Context

The manifest is a lightweight artefact — essentially a fingerprint of the source with its certification scope. It enables downstream tooling (CI, audit trails, dependency locks) to verify that what was generated corresponds to a specific, reviewed source file. The manifest consumes a validated AST with frozen lock state — both prerequisites must be met before manifest generation.

Explanation generation (ADR-013) is the near-term alternative to reverse translation. It produces a human-readable trace from the IR, not from generated code, which makes it independent of the target adapter.

## Goals / Non-Goals

**Goals:**
- Manifest schema: `schemaVersion`, `version`, `artifactHash`, `certificationScope`, `timestamp`, `audit`, `lockRef`
- Two distinct hashes with separate identities:
  - `sourceHash` (in `snap.lock`): SHA-256 of canonicalised source — identity of the input (sort declarations, normalise whitespace, strip comments, exclude `@cert` blocks)
  - `artifactHash` (in `mf.strux.json`): SHA-256 of the compiled manifest content — identity of the output
  - `lockRef` in the manifest references the `snap.lock` `sourceHash`, linking output back to input
- Certification scope: list of fully-qualified type paths used in the validated AST
- Structured audit field (ADR-013): per-rod explanation entries with source locations, access context, pushdown status, policy verification
- `--explain` CLI flag: human-readable formatted output from the same audit data
- Golden fixtures for manifest output

**Non-Goals:**
- Manifest -> `.strux` decompilation (deferred to v0.7.0 — ADR-013)
- Full reverse translation from generated code
- Manifest signing (post-0.6.0)

## Decisions

**Two hash identities: `sourceHash` in lock, `artifactHash` in manifest**
`sourceHash` (in `snap.lock`): SHA-256 of canonicalised source. Canonical form: sort top-level declarations alphabetically by name, normalise whitespace to single spaces and single newlines, strip all comments, exclude `@cert` blocks from hash input, encode as UTF-8. The hash is stable across reformatting. The exact canonical form is specified in RFC-0001 Annex A with test vectors.
`artifactHash` (in `mf.strux.json`): SHA-256 of the compiled manifest JSON (excluding the `artifactHash` field itself). This is the identity of the output artifact. `lockRef` in the manifest references the `snap.lock` `sourceHash`, creating a verifiable chain from source through lock to compiled output.

**Certification scope: derived from validated AST, not from declarations**
The scope reflects what was actually used, not what was declared. Example: `["db.sql.postgres", "grant-workflow.Proposal", "grant-workflow.ReviewStatus"]`.

**Manifest includes `lockRef` field**
References the `snap.lock` `sourceHash` used during build, tying the compiled artifact back to the exact source identity and dependency state. If no lock exists, `lockRef` is null and `W_NO_LOCK` was emitted during build.

**Manifest includes structured audit field (ADR-013)**
The `audit` object contains: per-rod explanation entries (step number, rod type, description, source location, pushdown status), access context summary, and policy verification status. This is the machine-readable counterpart of `--explain` output.

**Manifest is emitted as a side effect of the build pipeline, not a separate pass**
After validation + lock freeze, the manifest is generated in the same pipeline. If validation failed, manifest is null.

**`--explain` and `manifest.audit` are generated from the same IR traversal**
Both are produced from a single pass over the validated IR. The `--explain` text is a formatted rendering of the same data structure serialised into `manifest.audit`. No divergence is possible.

**Explanation output: stdout by default, `--explain-output <path>` for file**
The manifest `audit` field is always written regardless of `--explain` flag.

## Risks / Trade-offs

**[Risk] Canonical source normalisation is under-specified — different implementations may produce different hashes**
-> Mitigation: RFC-0001 Annex A defines the exact algorithm with test vectors. Golden fixtures pin the expected hash.

**[Risk] Explanation output may be verbose for large panels**
-> Mitigation: `--explain` output is structured with collapsible sections. The full detail is in `manifest.audit`; the CLI output shows a summary by default, `--explain --verbose` for full detail.

## Open Questions

- Should `mf.strux.json` include a schema version field? Decision: yes — `"schemaVersion": "0.6"`.
- Should `--explain` output be emitted to stdout or to a file? Decision: stdout by default, `--explain-output <path>` for file.
