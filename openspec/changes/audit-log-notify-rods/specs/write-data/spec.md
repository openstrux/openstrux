## MODIFIED Requirements

### Requirement: write-data passes input data through as default output knot

The `write-data` rod SHALL expose an `out.data` pass-through knot that carries the original input records unchanged after the write completes. `out.data` SHALL be the default output knot for implicit chain purposes, replacing `out.receipt`. `out.receipt` SHALL remain available as an explicit side-channel knot via `from: rod.receipt` when the write confirmation is needed downstream.

**Updated knot schema (changed rows only):**

| Knot | Direction | Type | Notes |
|---|---|---|---|
| `data` | out | `Stream<T>` or `Single<T>` | Pass-through of input — original records continue down the chain (default out) |
| `receipt` | out | `WriteReceipt` | Write confirmation (explicit side-channel knot) |

All other knots (`rows`/`elements` in, `target` cfg, `err` knots) are unchanged.

**Motivation:** in request/response panels the record written to the database is typically the same record returned to the caller. Without pass-through the author must re-wire explicitly (`from: transform.data` or similar), breaking the implicit linear chain. The pattern is identical to `audit-log` and `notify` introduced in this change.

#### Scenario: write-data participates in implicit chain as a pass-through

- **WHEN** a panel declares `db = write-data { target: @proposals }` followed by `resp = respond { }` with no explicit `from:` on `respond`
- **THEN** the compiler implicitly connects `db.out.data → resp.in.data` and produces zero errors

#### Scenario: write-data out.receipt is accessible as an explicit side-channel

- **WHEN** a panel declares `db = write-data { target: @proposals }` and a later rod uses `from: db.receipt`
- **THEN** the compiler resolves `db.out.receipt` to `WriteReceipt` and produces zero errors

#### Scenario: write-data pass-through preserves input record type

- **WHEN** a panel writes a `Proposal` record via `write-data` and the downstream `respond` rod expects a `Proposal` type
- **THEN** the compiler resolves `db.out.data` as `Proposal` with no type error
