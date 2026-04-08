## ADDED Requirements

### Requirement: audit-log rod type defined in the standard rod library

The specification SHALL define `audit-log` as a standard rod that expands to a compliance-annotated `write-data` during IR lowering. The rod SHALL enforce an `AuditEvent` input envelope with required fields. The compiler SHALL emit an error if any required field is absent from the input type. The rod SHALL be append-only: the compiler SHALL emit a `W_AUDIT_MUTABLE_TARGET` warning if any other rod in the same panel writes to the same target with a non-audit rod.

**Knot schema:**

| Knot | Direction | Type | Notes |
|---|---|---|---|
| `target` | cfg | `DataTarget` | Audit log storage target |
| `data` | in | `Single<AuditEvent>` or `Stream<AuditEvent>` | Structured event envelope (required fields enforced) |
| `data` | out | `Single<AuditEvent>` or `Stream<AuditEvent>` | Pass-through of input — original data continues down the chain |
| `logged` | out | `AuditReceipt` | Write confirmation with generated `event_id` (explicit side-channel knot) |
| `failure` | err | `ErrorKnot` | Write failed (non-retryable) |

**Required type definitions:**

```
@type AuditEvent {
  event_type:  string        // e.g., "state_transition", "access_decision"
  principal:   string        // identity of the acting principal
  resource:    string        // resource identifier (table, entity, endpoint)
  action:      string        // action taken (e.g., "submit", "assign", "deny")
  outcome:     AuditOutcome  // allow | deny | error
  timestamp:   date          // event time (not write time)
}

@type AuditOutcome = enum { allow, deny, error }

@type AuditReceipt {
  event_id:    string        // generated UUID for the written record
  target:      string        // resolved target identifier
  ts:          date          // write time
}
```

Additional fields beyond the required envelope are permitted. The compiler SHALL NOT emit an error for extra fields.

**Implicit chain:** default input knot is `in.data`; default output knot is `out.data` (pass-through). The original pipeline data continues to the next rod unchanged. `out.logged` is an explicit side-channel knot — available via `from: audit.logged` when the receipt needs to be inspected, but ignored by default.

**Manifest entry:** every `audit-log` rod instance SHALL produce a `auditRods` entry in the compiled manifest recording `target`, `event_type` values observed in the source, and the panel name.

**Expansion:** expands to `write-data` with `mode: append` and the `AuditEvent` schema enforced. The Next.js adapter emitter SHALL generate a `writeAuditEvent(event: AuditEvent): Promise<AuditReceipt>` helper function and call it from the handler. The helper SHALL be non-blocking with respect to the main response path (fire-and-await before respond, not fire-and-forget).

#### Scenario: Valid audit-log rod compiles without error

- **WHEN** a `.strux` panel contains `audit = audit-log { target: @audit_db, from: transition.out }` and the upstream rod emits an `AuditEvent`-compatible type
- **THEN** the compiler produces zero errors and emits a `writeAuditEvent` call in the generated handler

#### Scenario: Missing required AuditEvent field produces compile error

- **WHEN** a `.strux` panel contains `audit = audit-log { target: @audit_db }` and the upstream rod emits a type missing the `outcome` field
- **THEN** the compiler emits `E_AUDIT_MISSING_FIELD` naming the missing field

#### Scenario: Mutable write to same audit target produces warning

- **WHEN** a `.strux` panel contains both `audit = audit-log { target: @audit_db }` and `update = write-data { target: @audit_db, mode: update }`
- **THEN** the compiler emits `W_AUDIT_MUTABLE_TARGET` on the `write-data` rod

#### Scenario: audit-log manifest entry is generated

- **WHEN** a `.strux` file containing an `audit-log` rod is compiled
- **THEN** the compiled manifest contains an `auditRods` section with the panel name and target

#### Scenario: Next.js adapter emits writeAuditEvent helper

- **WHEN** a panel with an `audit-log` rod is compiled targeting Next.js
- **THEN** the generated handler file contains a `writeAuditEvent` async function and calls it before `respond`

#### Scenario: audit-log is the default rod for AuditEvent-typed pipeline outputs

- **WHEN** a panel produces an `AuditEvent` value and connects it to an `audit-log` rod via the implicit chain
- **THEN** no explicit `from:` is required and the compiler resolves the connection correctly
