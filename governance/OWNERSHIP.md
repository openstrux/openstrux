# Ownership

This document defines who owns what across the Openstrux repos. For early-stage OSS with a small team, one person may hold multiple roles. The goal is clarity — every area has a named human, not a committee.

---

## Roles

| Role | Description |
|---|---|
| **Maintainer** | Approves PRs, calls FCP on RFCs, tags releases. Must be a human contributor with commit history. |
| **Security owner** | Default triage assignee for all security findings. Owns the exceptions log. |
| **Release manager** | Coordinates cross-repo release order, runs benchmark gate, tags and publishes releases. |
| **Spec steward** | Owns normative decisions in `openstrux-spec`. Calls FCP on spec RFCs. |
| **Benchmark owner** | Maintains benchmark case definitions, validates scorecard submissions from use-case repos. |

In a small team, one person typically holds Maintainer + one other role. That is fine — what matters is that each role is named and not vacant.

---

## RACI

R = Responsible (does the work) · A = Accountable (final say) · C = Consulted · I = Informed

| Area | Maintainer | Security owner | Release manager | Spec steward | Benchmark owner |
|---|---|---|---|---|---|
| Spec language change (RFC) | C/A | I | I | R/A | I |
| Parser / core PR review | R/A | I | I | C | I |
| Security finding triage | I | R/A | I | I | I |
| Dependency incident | C | R/A | I | I | I |
| Security exception approval | A | R | I | I | I |
| Release tagging (spec) | I | I | R | A | I |
| Release tagging (core) | I | I | R/A | C | I |
| Benchmark scorecard review | I | I | I | I | R/A |
| RFC FCP call (spec) | C | I | I | R/A | I |
| RFC FCP call (cross-repo) | R/A | C | C | C | I |
| Admin bypass approval | A | C | I | I | I |
| Exception log entry | C | R/A | I | I | I |

---

## Current assignments

_Update this table when roles change. Keep it current — a stale ownership table is worse than none._

| Role | Person | Contact |
|---|---|---|
| Maintainer | _(to be named)_ | — |
| Security owner | _(to be named)_ | — |
| Release manager | _(to be named)_ | — |
| Spec steward | _(to be named)_ | — |
| Benchmark owner | _(to be named)_ | — |

---

## Escalation

When the named owner is unavailable (illness, leave, unresponsive after 48h for Critical/High findings):

1. Any maintainer may act in their place for time-sensitive decisions.
2. The acting maintainer records the action in the relevant issue with a note that they acted as substitute.
3. The named owner reviews and confirms or corrects on return.

There is no formal escalation hierarchy beyond this. If no maintainer is available, the project waits — for early-stage OSS, that is acceptable. Critical security findings with no available maintainer should be disclosed publicly after 7 days with no response (following responsible disclosure norms).

---

## Role changes

- Adding or removing a maintainer: PR to this file + announcement in the project's GitHub Discussions.
- Security owner change: update this file + notify any active security advisories of the new contact.
- Role handover: outgoing owner documents any in-flight issues in a handover comment before stepping down.

---

## Repo-level CODEOWNERS

Each repo maintains a `CODEOWNERS` file that enforces the above at the PR level. CODEOWNERS is the machine-readable enforcement of this document. When OWNERSHIP.md and CODEOWNERS diverge, CODEOWNERS is wrong — fix it.
