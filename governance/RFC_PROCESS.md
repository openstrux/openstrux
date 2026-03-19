# RFC Process

This document defines when an RFC is required, how the lifecycle works, and how decisions are made. It is normative for all contributors and maintainers.

---

## When an RFC is required

An RFC is required for:

- New syntax or semantics in the Openstrux language
- Breaking changes to any normative spec behavior
- New benchmark categories or changes to scoring methodology
- Changes to any governance document (except editorial fixes)
- Cross-repo architectural decisions affecting more than one repo

A plain PR (no RFC) is sufficient for:

- Editorial fixes (typos, clarifications that don't change meaning)
- Bug fixes to spec behavior that already has fixture coverage
- New benchmark cases within existing categories
- Tooling, CI, or dependency changes

---

## Where RFCs live

All RFCs — spec-language and architectural — live in `openstrux-spec/rfcs/` as numbered markdown files:

```
openstrux-spec/rfcs/RFC-0001-slug.md
openstrux-spec/rfcs/TEMPLATE.md
```

Cross-repo architectural RFCs live there too. `openstrux-spec` is the canonical decision record for the project.

---

## Lifecycle

```
Exploration → Draft → Review → FCP → Accepted / Rejected → Implemented
```

| Stage | What it means | Minimum duration |
|---|---|---|
| **Exploration** | Informal discussion — GitHub Discussion or issue. No RFC document yet. | None |
| **Draft** | RFC document written; `rfc/<id>-<slug>` branch opened in `openstrux-spec`; PR opened. | None |
| **Review** | PR open for community comment. No maintainer has signalled intent. | 14 days |
| **FCP** | A maintainer posts an FCP comment stating intent to accept or reject. Final window for objections. | 7 days |
| **Accepted / Rejected** | PR merged (accepted) or closed with explanation (rejected). RFC document updated with decision and date. | — |
| **Implemented** | All spec PR(s) merged; RFC updated with links to spec changes and implementation PRs. | — |

---

## RFC numbering

Numbers are assigned sequentially (RFC-0001, RFC-0002, …). The number is taken when the Draft PR is opened — use the next available number from the `openstrux-spec/rfcs/` directory.

---

## Decision authority: lazy consensus

Openstrux uses **lazy consensus** for RFC decisions:

- Any contributor may open an RFC and participate in review.
- FCP is called by any maintainer who has reviewed the RFC and is ready to signal intent.
- During FCP, the RFC passes if **no maintainer raises a substantive objection** within 7 days.
- A substantive objection must identify a specific technical, normative, or governance problem. Style preferences do not qualify.
- A maintainer who objects is **obligated to engage** — a block is not a veto, it is a commitment to help resolve the issue.
- If an objection is raised, FCP is paused. The proposer and objecting maintainer must reach resolution (revised RFC, withdrawal, or escalation to all maintainers). Once resolved, FCP restarts for the remaining duration or a fresh 7-day window, whichever is longer.
- If all maintainers explicitly approve before FCP expires, the RFC may be accepted immediately without waiting for the full period.

---

## AI-generated RFCs

- AI may draft RFC text. A human must be named as proposer and must own the content.
- The `AI-assisted` field in the RFC header is mandatory when AI was used in drafting.
- The human proposer is responsible for the correctness of all normative claims.
- AI must not open RFC PRs autonomously — RFC PRs are always human-initiated.
- AI-assisted RFC commits follow `governance/COMMIT_FORMAT.md` (co-author trailer mandatory).

---

## From accepted RFC to spec change

1. RFC status updated to `Accepted` in the merged document.
2. Spec PR(s) opened in `openstrux-spec` referencing the RFC number in the PR description.
3. Conformance fixtures added — required before the spec PR merges (see `governance/SPEC_VALIDATION.md`).
4. `openstrux-core` implementation PR(s) opened referencing the spec PR.
5. RFC status updated to `Implemented` with links to all merged PRs and the spec tag that includes the change.

---

## RFC document format

See `openstrux-spec/rfcs/TEMPLATE.md` for the canonical template.
