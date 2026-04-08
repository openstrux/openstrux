## Why

The grant-workflow use case requires every state transition and access decision to produce a tamper-evident audit record, and requires out-of-band notifications to participants at key workflow moments. Both concerns are currently forced through `write-data` and `call` respectively — rods with no semantic awareness of audit or notification intent, preventing compiler validation, adapter optimisation, and privacy-compliance enforcement at the rod level.

## What Changes

- Add `audit-log` as a standard rod type: append-only, purpose-bound event emission with a required structured schema (`event_type`, `principal`, `resource`, `action`, `outcome`, `timestamp`). The compiler enforces append-only semantics and flags any downstream rod that attempts to mutate audit output.
- Add `notify` as a standard rod type: channel-abstracted notification dispatch (email, webhook, push) with a template reference and recipient expression. The compiler resolves the channel from adapter configuration; the rod author declares intent, not transport.
- Add both rods to the rod overview table (`specs/modules/rods/overview.md`) with their default knot schemas.
- Add both rods to the implicit chain table in `specs/core/panel-shorthand.md`.
- Define the Next.js adapter contract for each: what generated TypeScript the emitter must produce.

## Capabilities

### New Capabilities

- `audit-log-rod`: Specification for the `audit-log` rod type — knot schema, required fields, append-only constraint, default chain position, and adapter contract.
- `notify-rod`: Specification for the `notify` rod type — knot schema, channel abstraction, template reference, recipient resolution, and adapter contract.

### Modified Capabilities

- `rod-overview`: Add `audit-log` and `notify` to the rod taxonomy table and knot default table.
- `panel-shorthand`: Add `audit-log`, `notify`, and `write-data` to the implicit chain default knots table (Rule 3).
- `write-data`: Add `out.data` pass-through knot (same pattern as `audit-log` and `notify`); `out.receipt` becomes an explicit side-channel.

## Impact

- `openstrux-spec`: new rod specs in `specs/modules/rods/`; updates to `overview.md` and `panel-shorthand.md`.
- `openstrux-core`: new rod emitters in `packages/generator/src/adapters/nextjs/rods/`; parser must recognise `audit-log` and `notify` as valid rod types; validator must enforce append-only constraint on `audit-log` output; `write-data` emitter updated to pass `out.data` through.
- `openstrux-uc-grant-workflow`: grant-workflow panels can replace `write-data` (audit table) and `call` (notification webhook) with the new rods, reducing gap-fill and making compliance intent explicit.
- No breaking changes to existing `.strux` files — new rod types are additive.
