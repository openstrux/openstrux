## 1. AST Node Types

- [ ] 1.1 Add `AuditEvent`, `AuditOutcome`, `AuditReceipt` type definitions to `packages/ast/src/expressions.ts` or a new `packages/ast/src/standard-rods.ts`
- [ ] 1.2 Add `NotifyChannel`, `EmailChannel`, `WebhookChannel`, `PushChannel`, `PushProvider`, `NotifyReceipt` type definitions
- [ ] 1.3 Register `audit-log` and `notify` as valid rod types in the parser's rod-type registry

## 2. Parser

- [ ] 2.1 Add `audit-log` rod parsing: recognise `target` cfg knot, `data` in knot, `data` and `logged` out knots, `failure` err knot; default in = `data`, default out = `data`
- [ ] 2.2 Add `notify` rod parsing: recognise `channel` cfg knot, `template` cfg knot, `recipient` and `payload` arg knots, `data` in knot, `data` and `sent` out knots, `failure` err knot; default in = `data`, default out = `data`
- [ ] 2.3 Update `write-data` implicit chain default: change default out from `receipt` to `data`

## 3. Validator

- [ ] 3.1 Enforce `audit-log` required envelope fields: emit `E_AUDIT_MISSING_FIELD` if upstream type is missing any of `event_type`, `principal`, `resource`, `action`, `outcome`, `timestamp`
- [ ] 3.2 Emit `W_AUDIT_MUTABLE_TARGET` when another rod in the same panel writes to the same target as an `audit-log` rod using a non-audit rod type
- [ ] 3.3 Validate `notify` recipient expression resolves to a string field in the upstream data type; emit `E_NOTIFY_UNRESOLVED_RECIPIENT` on failure

## 4. Generator — Next.js Adapter (audit-log and notify)

- [ ] 4.1 Create `packages/generator/src/adapters/nextjs/rods/audit-log.ts`: emit `writeAuditEvent(event: AuditEvent): Promise<AuditReceipt>` helper using Prisma `create` on the configured target; call it awaited; pass input data through to `out.data`
- [ ] 4.2 Create `packages/generator/src/adapters/nextjs/rods/notify.ts`: emit `sendNotification(channel, recipient, payload): Promise<NotifyReceipt>` helper; implement `fetch`-based body for `webhook` channel; emit `// TODO: wire provider SDK` stub for `email` and `push` channels; pass input data through to `out.data`
- [ ] 4.3 Implement non-blocking failure semantics for `notify`: wrap helper call in try/catch; log and continue unless `err.failure` is wired; propagate if wired
- [ ] 4.4 Add `audit-log` and `notify` to the rod emitter dispatch table in the generator

## 5. Generator — Next.js Adapter (write-data pass-through)

- [ ] 5.1 Update `write-data` emitter: emit `out.data` as pass-through of input records after write completes; `out.receipt` remains available as an explicit side-channel knot

## 6. Manifest

- [ ] 6.1 Add `auditRods` manifest section: for each `audit-log` rod instance record `panelName`, `target`, and observed `event_type` values from source

## 7. Spec Updates (openstrux-spec)

- [ ] 7.1 Add `audit-log` rod spec file at `specs/modules/rods/standard/audit-log.md` with knot schema, expansion rules, compiler constraints, and Next.js adapter contract
- [ ] 7.2 Add `notify` rod spec file at `specs/modules/rods/standard/notify.md` with knot schema, channel union type, expansion rules, and adapter contract
- [ ] 7.3 Update `specs/modules/rods/overview.md`: add `audit-log` and `notify` to standard rod table; remove `notify` from convenience rod table
- [ ] 7.4 Update `specs/core/panel-shorthand.md` Rule 3 implicit chain table: update `write-data` default out to `data`; add `audit-log` (in: `data`, out: `data`) and `notify` (in: `data`, out: `data`)

## 8. Conformance Fixtures

- [ ] 8.1 Add valid fixture `v060-audit-log.strux`: panel with `audit-log` rod connected to a well-formed `AuditEvent` upstream type
- [ ] 8.2 Add valid fixture `v060-notify-webhook.strux`: panel with `notify` rod using a `webhook` channel and a recipient expression
- [ ] 8.3 Add invalid fixture `i060-audit-missing-field.strux` + expected diagnostic: `E_AUDIT_MISSING_FIELD` when upstream type is missing `outcome`
- [ ] 8.4 Add invalid fixture `i060-notify-unresolved-recipient.strux` + expected diagnostic: `E_NOTIFY_UNRESOLVED_RECIPIENT` for a non-existent field path
- [ ] 8.5 Add golden fixture `v060-audit-log-golden.strux` + expected Next.js output: verify `writeAuditEvent` helper is emitted, called, and input data passed through
- [ ] 8.6 Add golden fixture `v060-notify-webhook-golden.strux` + expected Next.js output: verify `sendNotification` helper uses `fetch` and input data passes through
- [ ] 8.7 Add golden fixture `v060-write-data-passthrough-golden.strux` + expected Next.js output: verify `write-data` followed by `respond` chains without explicit `from:`
- [ ] 8.8 Add valid fixture confirming `from: db.receipt` resolves correctly as an explicit side-channel on `write-data`

## 9. Grant-Workflow Use Case Update

- [ ] 9.1 Replace `write-data` (audit table) rods in grant-workflow `.strux` panels with `audit-log` rods where applicable
- [ ] 9.2 Replace `call` (notification webhook) rods in grant-workflow `.strux` panels with `notify` rods where applicable
- [ ] 9.3 Update `benchmarks/prompts/openstrux/generate.md` in the UC repo: mention `audit-log` and `notify` in the Step 3 panel list so the LLM knows to use them
