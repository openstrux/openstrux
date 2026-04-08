## MODIFIED Requirements

### Requirement: Implicit chain default knots table includes audit-log, notify, and write-data pass-through

The panel-shorthand implicit chain table (Rule 3) SHALL include `audit-log` and `notify` with their default input and output knots. The existing `write-data` entry SHALL be updated to reflect `data` as its default output knot (replacing `receipt`), so that all three rods participate in the implicit linear chain as pass-throughs without requiring explicit `from:` wiring.

**Updated default knots table (rows to add or update — full table in panel-shorthand.md §Rule 3):**

| Rod | Default out | Default in |
|---|---|---|
| `write-data` | `data` *(updated from `receipt`)* | `rows` / `elements` |
| `audit-log` | `data` | `data` |
| `notify` | `data` | `data` |

#### Scenario: audit-log participates in implicit chain as a pass-through

- **WHEN** a panel declares any rod followed by `audit = audit-log { target: @audit_db }` followed by another rod, with no explicit `from:` wiring
- **THEN** the compiler implicitly connects the preceding rod's default output to `audit.in.data` and `audit.out.data` to the following rod's default input, producing zero errors

#### Scenario: audit-log out.logged is accessible as an explicit side-channel

- **WHEN** a panel declares `audit = audit-log { target: @audit_db }` and a later rod uses `from: audit.logged`
- **THEN** the compiler resolves `audit.out.logged` to `AuditReceipt` and produces zero errors

#### Scenario: notify participates in implicit chain as a pass-through after any rod type

- **WHEN** a panel declares any rod (read-data, filter, transform, guard, etc.) followed by `note = notify { channel: webhook { ... }, recipient: element.email }` followed by `resp = respond { ... }`, with no explicit `from:` wiring
- **THEN** the compiler implicitly connects the preceding rod's default output to `note.in.data` and `note.out.data` to `resp.in.data`, producing zero errors

#### Scenario: write-data participates in implicit chain as a pass-through

- **WHEN** a panel declares `db = write-data { target: @proposals }` followed by `resp = respond { }` with no explicit `from:` wiring
- **THEN** the compiler implicitly connects `db.out.data → resp.in.data` and produces zero errors

#### Scenario: notify out.sent is accessible as an explicit side-channel

- **WHEN** a panel declares `note = notify { channel: webhook { ... }, recipient: element.email }` and a later rod uses `from: note.sent`
- **THEN** the compiler resolves `note.out.sent` to `NotifyReceipt` and produces zero errors
