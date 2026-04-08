## Context

The current rod taxonomy (`specs/modules/rods/overview.md`) classifies `notify` as a **convenience rod** — decomposable to `call(target = webhook/email/slack)` — and has no `audit-log` rod at all. Audit writes are implicitly expected to use `write-data` to an audit table.

The grant-workflow use case exposes two compliance gaps with this approach:

1. **Audit**: every state transition and every access decision must produce a tamper-evident, append-only record (see `access-policies.md`: "All access control decisions are logged as `AuditEvent`"). A `write-data` to an audit table has no append-only constraint, no required schema, and no compliance mapping in the manifest — the compiler cannot distinguish an audit write from any other persistence operation.

2. **Notification**: reviewer assignment, eligibility result, clarification requests, and final decisions all trigger participant notifications. A `call` to an email/webhook API has no channel abstraction, no template reference, and no recipient-resolution semantics — the LLM must hand-write routing logic that strux cannot validate or optimise.

Standard rods expand to basic rod sub-graphs during IR lowering (see `private-data` precedent). They carry project-level certification and appear in the manifest as first-class compliance evidence.

## Goals / Non-Goals

**Goals:**
- Define `audit-log` as a standard rod that expands to a compliance-annotated `write-data` with an enforced schema, append-only constraint, and manifest entry.
- Define `notify` as a standard rod that expands to a `call` with a channel abstraction, template reference, and recipient expression.
- Add both rods to the rod overview table and the panel-shorthand implicit chain table.
- Define the Next.js adapter contract for each: what generated TypeScript the emitter must produce.
- Enable grant-workflow panels to use `audit-log` and `notify` directly, eliminating the corresponding gap-fill.

**Non-Goals:**
- Delivery guarantees / at-least-once / exactly-once semantics for `notify` — these are adapter and infrastructure concerns, not rod-level semantics for v0.6.0.
- Template rendering engine — template references point to user-authored template files; the rod does not own rendering.
- Multi-channel fan-out within a single `notify` rod — one rod, one channel per invocation.
- Email/push provider SDKs — the adapter emits a `fetch`-based webhook call or a provider call stub; provider integration is gap-fill or a future hub rod.
- Audit log querying / reporting — `audit-log` is write-only; reading audit records uses `read-data`.

## Decisions

### D1: audit-log is a standard rod, not a basic rod

**Decision:** `audit-log` expands to a compliance-annotated `write-data` during IR lowering. It is not added to the 18 basic rods.

**Rationale:** The overview.md makes a strong case that 18 basic rods are the irreducible set. `audit-log` is semantically a `write-data` with enforced constraints (append-only, required schema, compliance annotation). Adding it as basic would violate the completeness argument. Making it standard follows the `private-data` precedent exactly: standard rods add certification semantics and constrained expansion rules on top of basic rods.

**Alternatives considered:** Basic rod with a new `AuditTarget` type. Rejected — the knot schema and data model are identical to `write-data`; the difference is constraints and manifest metadata, not data flow.

### D2: notify is promoted from convenience to standard rod

**Decision:** `notify` is promoted from the "convenience rod" list in `overview.md` to a standard rod with a defined knot schema. It expands to a `call` with channel-specific cfg.

**Rationale:** The overview already acknowledges `notify` as a recognisable pattern (`call(target = webhook/email/slack)`). The grant-workflow requires notification at multiple pipeline points. Without a standard rod, LLMs must choose between: (a) a `call` with no semantic or (b) gap-filling a notification utility. A standard rod makes intent explicit, allows the compiler to validate recipient expressions and template references, and produces a manifest entry that compliance reviewers can inspect.

**Alternatives considered:** Keep as convenience rod; document a canonical `call` pattern. Rejected — forces the LLM to reconstruct the pattern at every use site; channel abstraction cannot be validated by the compiler without a rod-level construct.

### D3: audit-log knot schema enforces a required event envelope

**Decision:** The `audit-log` rod requires a structured `AuditEvent` input knot with fields: `event_type`, `principal`, `resource`, `action`, `outcome`, `timestamp`. These are required — the compiler emits an error if any are missing. Additional fields are allowed.

**Rationale:** The grant-workflow access-policies spec names these fields explicitly. Enforcing them at the rod level means the compiler — not the LLM or a human reviewer — guarantees compliance evidence is complete. This is the same rationale as `validate` enforcing schema constraints.

**Alternatives considered:** Free-form payload with no required schema. Rejected — defeats the purpose of having a compliance rod; a `write-data` already does this.

### D4: notify uses a channel union type, not a free-form URL

**Decision:** The `channel` cfg is typed as `NotifyChannel = union { email: EmailChannel, webhook: WebhookChannel, push: PushChannel }`. The recipient is an expression evaluated against the pipeline data (e.g., `element.applicant_email`).

**Rationale:** A union type lets the adapter generate channel-appropriate code (email headers vs. POST body vs. push payload) without the rod author specifying transport details. The recipient expression means the rod can be parameterised over pipeline data rather than hardcoded addresses — critical for the grant-workflow where the recipient varies per proposal.

**Alternatives considered:** `target: ServiceTarget` (reuse `call`'s type). Rejected — `ServiceTarget` is a service locator (base URL, auth, TLS); it has no concept of recipient address, template, or notification-specific metadata. Reusing it would require the rod author to manually construct the notification payload, defeating the abstraction.

### D5: Next.js adapter emits a typed async helper, not inline fetch

**Decision:** Both `audit-log` and `notify` emitters generate a call to a helper function (`writeAuditEvent(event)`, `sendNotification(channel, payload)`) that is emitted alongside the handler. The helper is a complete, non-stub implementation for the default case (Prisma for audit, fetch/POST for webhook notify).

**Rationale:** Following ADR-019 (no stubs), the emitter must produce working code. The helper pattern keeps the handler body readable and the compliance logic testable in isolation. For `notify`, the helper is also where delivery-failure handling (try/catch, non-blocking) is isolated.

## Risks / Trade-offs

**[audit-log append-only constraint is advisory in v0.6.0]** → The compiler enforces the schema and emits a manifest entry, but the underlying Prisma model does not enforce append-only at the database level (no trigger, no immutable flag). Mitigation: document that audit table should use a `CREATE` only permission at the DB user level; add a WARN diagnostic if `write-data` to the same target also appears in the panel.

**[notify is fire-and-forget in the Next.js adapter]** → The emitted helper does not await delivery confirmation. Failed notifications are logged but do not fail the handler. Mitigation: document this explicitly in the rod spec; teams requiring guaranteed delivery should add a `store` rod to queue the notification for retry.

**[AuditEvent schema is grant-workflow-derived, may need extension]** → The required fields (`event_type`, `principal`, `resource`, `action`, `outcome`, `timestamp`) are sufficient for the grant-workflow but may not cover all use cases. Mitigation: mark additional fields as allowed (open schema); revisit after a second use case.
