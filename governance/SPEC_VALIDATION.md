# Spec Validation Policy

Spec validation is split into two automated levels and one mandatory human gate. Automated checks live in `openstrux-spec`. Level 2 conformance requires `openstrux-core`.

---

## Level 1 — Static (no parser required)

Runs on every PR and locally via the pre-push hook in `openstrux-spec`.

| Check | Tool | Failure mode |
|---|---|---|
| Markdown lint | `markdownlint` | Hard fail |
| Broken internal links | `lychee` | Hard fail |
| Required frontmatter per spec file (status, version) | Custom script | Hard fail |
| Stub sections remaining in `specs/` | `grep "Status: stub"` | Hard fail |
| Change package completeness | Script: all of `proposal.md`, `design.md`, `tasks.md`, `acceptance.md` must exist | Hard fail |
| Benchmark coverage | Every benchmark case ID (B001–B030+) has a corresponding fixture in `conformance/` | Hard fail |

---

## Level 2 — Conformance (requires openstrux-core)

Runs as a merge gate on `openstrux-spec` PRs when `openstrux-core` is available.

| Fixture set | Expected result |
|---|---|
| `conformance/valid/*.strux` | Parses and typechecks with zero diagnostics |
| `conformance/invalid/*.strux` | Fails with the exact expected diagnostic message |
| `conformance/golden/*.strux` | Generated output matches the golden file byte-for-byte |

Level 2 is the binding contract between the spec and the implementation. A failing Level 2 check is a spec defect or an implementation defect — both block merge.

---

## Human validation gate

Every PR that touches `specs/` requires:

1. **A human reviewer** — enforced via `CODEOWNERS` on `specs/` paths
2. **Explicit author attestation** — a checklist tick in the PR template:
   > "I have read the full spec delta and validated it against the affected manifesto objectives"

This is the spec-level equivalent of `Defined and Reviewed by author` in the commit format. It must be checked by the PR author, not the reviewer.

---

## Where checks live

| Location | What |
|---|---|
| `openstrux-spec/.githooks/pre-push` | Level 1 — runs locally before push |
| `openstrux-spec/.github/workflows/ci.yml` | Level 1 — runs on every PR |
| `openstrux-spec/.github/workflows/conformance.yml` | Level 2 — runs on every PR (when core is available) |
| `openstrux-spec/.github/PULL_REQUEST_TEMPLATE.md` | Human validation checklist |
| `openstrux-spec/CODEOWNERS` | Enforces human reviewer on `specs/` |

---

## References

- [AIDEVSECOPS.md](AIDEVSECOPS.md) — security review gates
- [TESTING.md](TESTING.md) — full testing strategy
- [COMMIT_FORMAT.md](COMMIT_FORMAT.md) — author attestation in commits
