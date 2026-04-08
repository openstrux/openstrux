## ADDED Requirements

### Requirement: notify rod type defined in the standard rod library

The specification SHALL define `notify` as a standard rod promoted from the convenience-rod list to the standard rod library. It SHALL expand to a `call` with channel-specific configuration during IR lowering. The rod SHALL accept a channel union type, a template reference, and a recipient expression. The compiler SHALL validate that the recipient expression resolves to a string field in the upstream data type.

**Knot schema:**

| Knot | Direction | Type | Notes |
|---|---|---|---|
| `channel` | cfg | `NotifyChannel` | Delivery channel and target configuration |
| `template` | cfg | `Optional<string>` | Template file path (relative to project root) |
| `recipient` | arg | `string` | Expression resolving to recipient address (email, URL, device token) |
| `payload` | arg | `Optional<string>` | Expression or literal for notification body (used when no template) |
| `data` | in | `Single<T>` or `Stream<T>` | Pipeline data used to resolve recipient and payload expressions |
| `data` | out | `Single<T>` or `Stream<T>` | Pass-through of input — original data continues down the chain |
| `sent` | out | `NotifyReceipt` | Delivery confirmation (explicit side-channel knot) |
| `failure` | err | `ErrorKnot` | Delivery failed |

**Required type definitions:**

```
@type NotifyChannel = union {
  email:    EmailChannel
  webhook:  WebhookChannel
  push:     PushChannel
}

@type EmailChannel {
  from:     string              // sender address
  subject:  string             // subject line (may reference template)
}

@type WebhookChannel {
  url:      string             // target URL (static or resolved from config)
  method:   string             // POST (default) or PUT
  headers:  Optional<Map<string, string>>
}

@type PushChannel {
  provider: PushProvider       // apns | fcm
  app_id:   string
}

@type PushProvider = enum { apns, fcm }

@type NotifyReceipt {
  recipient:   string          // resolved recipient address
  channel:     string          // "email" | "webhook" | "push"
  ts:          date            // send time
  provider_id: Optional<string> // provider-assigned message ID if available
}
```

**Implicit chain:** default input knot is `in.data`; default output knot is `out.data` (pass-through). The original pipeline data continues to the next rod unchanged. `out.sent` is an explicit side-channel knot — available via `from: notif.sent` when the receipt needs to be inspected or logged, but ignored by default.

**Expansion:** expands to `call` with channel-appropriate target configuration. The Next.js adapter emitter SHALL generate a `sendNotification(channel, recipient, payload): Promise<NotifyReceipt>` helper. For `webhook` channels the helper SHALL use `fetch`. For `email` and `push` channels the helper SHALL emit a typed stub with a `// TODO: wire provider SDK` comment (delivery provider integration is gap-fill or a future hub rod).

**Non-blocking semantics:** the `notify` rod SHALL NOT block the main response path. The emitter SHALL await the helper before `respond` but SHALL catch and log delivery failures without propagating them as handler errors, unless the panel explicitly connects `err.failure` to a downstream rod.

#### Scenario: Valid notify rod with webhook channel compiles without error

- **WHEN** a `.strux` panel contains `notify = notify { channel: webhook { url: "https://hooks.example.com/..." }, recipient: element.admin_email }` and the upstream rod emits a type with an `admin_email` string field
- **THEN** the compiler produces zero errors and the generated handler contains a `sendNotification` call

#### Scenario: Unresolvable recipient expression produces compile error

- **WHEN** a `.strux` panel contains `notify = notify { channel: email { ... }, recipient: element.nonexistent_field }`
- **THEN** the compiler emits `E_NOTIFY_UNRESOLVED_RECIPIENT` naming the unresolved field

#### Scenario: Next.js adapter emits fetch-based helper for webhook channel

- **WHEN** a panel with a `notify` rod using a `webhook` channel is compiled targeting Next.js
- **THEN** the generated handler file contains a `sendNotification` async function that calls `fetch` with the configured URL and a JSON body

#### Scenario: Next.js adapter emits stub helper for email channel

- **WHEN** a panel with a `notify` rod using an `email` channel is compiled targeting Next.js
- **THEN** the generated handler file contains a `sendNotification` async function with a `// TODO: wire provider SDK` comment

#### Scenario: notify failure does not fail the handler by default

- **WHEN** a panel contains `notify` without connecting `err.failure` to any downstream rod and the notification helper throws at runtime
- **THEN** the generated code catches the error, logs it, and continues to the `respond` rod

#### Scenario: notify failure propagates when err.failure is wired

- **WHEN** a panel contains `notify` with `err.failure` connected to a downstream `respond` rod returning a 500 status
- **THEN** the generated code propagates the failure to the respond rod on delivery error

#### Scenario: notify removed from convenience rod list

- **WHEN** the rod overview is consulted
- **THEN** `notify` does not appear in the convenience rod table and instead appears in the standard rod table
