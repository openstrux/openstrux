# Security Operations

This document defines how security findings are triaged, owned, and resolved. It is intentionally lean for early-stage OSS — the goal is a routine that a small team can actually follow, not a full SOC playbook.

---

## Severity model

| Severity | Definition | Example |
|---|---|---|
| **Critical** | Exploitable in a default configuration; confidentiality, integrity, or availability directly at risk | RCE in parser, auth bypass, secret exposure in release artifact |
| **High** | Significant risk but requires non-default conditions or chained steps | Dependency with known exploit, CVSS ≥ 7.0 with plausible attack path |
| **Medium** | Limited blast radius or requires authenticated access | CVSS 4.0–6.9, no known exploit |
| **Low** | Informational; unlikely to be exploited alone | Outdated dep with no public exploit, minor config hardening |

CVSS is a starting point, not the verdict. A maintainer may promote or demote severity based on actual attack surface.

---

## Response SLAs

| Severity | Patch or mitigate by | Production release allowed? |
|---|---|---|
| Critical | 48 hours | No — blocked until resolved or formally excepted |
| High | 7 days | No new release until resolved or excepted |
| Medium | 30 days | Yes — include fix in next planned release |
| Low | Next release cycle | Yes |

SLA clock starts when the finding is triaged and assigned, not when the scanner first reports it.

---

## Vulnerability status flow

Every finding moves through these states. The current state is tracked as a label on the GitHub issue.

```
new → triaged → fix-in-progress → fixed → verified → disclosed
                      ↓
               accepted-risk (if no fix; requires exception)
```

| State | Meaning |
|---|---|
| `new` | Finding reported; not yet reviewed |
| `triaged` | Severity assigned; owner assigned; SLA clock started |
| `fix-in-progress` | Fix PR open or owner actively working |
| `accepted-risk` | No fix available; exception filed; mitigating control in place |
| `fixed` | Fix merged; scans re-run |
| `verified` | Fix confirmed by security owner; scans clean |
| `disclosed` | Advisory published (for findings that were privately reported) |

`accepted-risk` is not a terminal state — it must have an expiry date matching its exception.

---

## Triage flow

```
Scanner / reporter → Triage → Assign → Fix PR → Re-scan → Close / Disclose
```

1. **Intake**: finding arrives via Dependabot, OSV-Scanner, CodeQL alert, or private report. State: `new`.
2. **Triage** (within 24h of intake): a maintainer reviews severity, confirms it applies to the project, and sets the severity label (`sec:critical`, `sec:high`, `sec:medium`, `sec:low`) and state label `triaged`.
3. **Assign**: named owner recorded on the GitHub issue. For a small team, the triaging maintainer is the default owner. SLA clock starts on assignment.
4. **Fix**: owner opens a patch PR referencing the issue; state moves to `fix-in-progress`. Scans re-run before merge.
5. **Verify**: security owner confirms fix is effective; state moves to `verified`.
6. **Close / Disclose**: issue closed. If the finding was privately reported, advisory published; state moves to `disclosed`. If no fix was possible, state is `accepted-risk` with an active exception.

---

## CVE / dependency incident flow

1. Dependabot or OSV-Scanner opens an alert or issue.
2. Maintainer triages within 24h: severity label + owner assigned.
3. SLA clock starts.
4. Owner opens a dependency update PR or opens a tracking issue if no upstream fix exists.
5. If no upstream fix exists and SLA will be breached: file an exception with a mitigating control (e.g. feature flag off, runtime check, or remove the dependency).
6. PR merged → alert closed → re-scan confirms clean.

---

## Private disclosure path

Security issues that should not be disclosed publicly (e.g. exploitable bugs, secret exposure) must be reported privately before any public discussion.

- **Report to**: GitHub Security Advisories for the affected repo (Settings → Security → Advisories → New draft advisory)
- **Who receives it**: repository admins only
- **Response**: acknowledgement within 48h; triage within 72h
- **Embargo**: maintainers will coordinate a fix and agree a disclosure date with the reporter before publishing the advisory
- **Public disclosure**: after patch is merged and a release is tagged, or after 90 days from report if no fix is possible

Do not open public issues for unpatched security vulnerabilities.

---

## Ownership

Security ownership is defined in `governance/OWNERSHIP.md`. At minimum one named maintainer is the security owner per repo. That person is the default triage assignee for all incoming findings.
