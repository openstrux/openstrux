# Exceptions

An exception is a documented, time-bounded, approved waiver from a normative governance rule. Exceptions exist so that early-stage OSS can move without being blocked by process — but every waiver is visible, owned, and expires.

**No permanent exceptions.** If a rule is wrong for this project, change the rule via RFC. If the rule is right but temporarily impractical, file an exception.

---

## What qualifies as an exception

Any intentional deviation from a normative rule in:

- `governance/TESTING.md` (e.g. coverage threshold not yet met)
- `governance/CICD.md` (e.g. required check bypassed)
- `governance/BRANCHING.md` (e.g. direct push to main)
- `governance/AIDEVSECOPS.md` (e.g. dependency outside the license allowlist)
- `governance/SECURITY_OPERATIONS.md` (e.g. SLA will be missed)
- `governance/SUPPLY_CHAIN.md` (e.g. action not yet pinned to SHA)

Routine judgment calls within a rule are not exceptions. An exception is needed only when a rule would be knowingly violated.

---

## Exception request

File an exception as a GitHub issue in the affected repo with the label `exception` and the following fields in the body:

```
**Rule being waived:** <document + section>
**What will be different:** <specific deviation>
**Why:** <reason — must be substantive, not "it's inconvenient">
**Compensating control:** <concrete action that reduces the risk while the waiver is active>
**Expiry:** <specific date or milestone — required, no open-ended waivers, maximum 90 days>
**Approver:** <see approval authority below>
```

Both `Compensating control` and `Expiry` are required fields. An exception request missing either is incomplete and will not be approved.

---

## Approval authority

| Exception type | Required approver |
|---|---|
| Coverage threshold, lint rule, advisory check | Any maintainer (comment on the issue) |
| Required CI check bypass, SLA extension | All active maintainers |
| Security control waiver, license allowlist deviation | All active maintainers + recorded in exceptions log |

Approval is a comment on the GitHub issue from the required approver(s). No approval = no exception; the rule stands.

---

## Exceptions log

All approved exceptions are recorded in `governance/exceptions-log.md` in this format:

```markdown
| ID | Rule | Repo | Compensating control | Expiry | Approver(s) | Issue | Status |
```

The log is append-only. Expired exceptions are marked `closed`, not deleted. This is the audit trail.

---

## Expiry and renewal

- Every exception has an expiry date or a milestone (e.g. "until v0.5.0 tags").
- Expired exceptions are not automatically renewed — a new request is required.
- If the underlying problem is not fixed by expiry, a new exception must be filed. Two consecutive renewals of the same exception require an RFC to change the rule or a commitment to fix.

---

## Unplanned bypass

When a PR block is bypassed by an admin without a pre-filed exception (emergency), the admin must:

1. Leave a PR comment before merging: what was bypassed, why, and what follow-up issue tracks the gap.
2. File a retrospective exception issue within 24h.

Bypass without documentation within 24h is a governance violation, recorded in the exceptions log.
