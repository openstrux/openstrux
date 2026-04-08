# Backlog

Unversioned pool of deferred decisions and future improvements. Items here are not assigned to any release — they feed into future roadmap versions when they become actionable.

**Flow:** backlog → roadmap version → change package → done.

**Rules:**
- One line per item — if it needs more detail, it's ready for a change package
- Always tag the origin (ADR, discussion, or roadmap)
- Delete items when they graduate to a roadmap version or change package

---

## Generated Output / Build System (ADR-019)

- [ ] Multiple targets from one project — generate both Next.js API and Beam pipeline from same `.strux` source
- [ ] Incremental builds — only regenerate files whose `.strux` inputs changed
- [ ] Eject command — convert generated package to owned source code (manifesto value, required before 1.0)
- [ ] `strux build --watch` — auto-regenerate on `.strux` file changes
- [ ] Starter `.strux` templates per stack — `strux init` generates a meaningful example, not a hello-world

## Adapter Ecosystem (ADR-019, ADR-004, ADR-009)

- [ ] Adapter conformance suite — public test harness so community can build and certify adapters
- [ ] Hub registry with search, discovery, and compatibility matrix
- [ ] `strux adapters list` / `strux adapters check` — CLI discovery commands
- [ ] Community adapter tier (verified, community) alongside certified official adapters
- [ ] Additional framework adapters: Hono, Fastify, Express, SvelteKit
- [ ] Additional ORM adapters: Drizzle, TypeORM, Kysely
- [ ] Additional validation adapters: Valibot, Yup
- [ ] Additional runtime support: Bun, Deno

## Brownfield Database Support (ADR-020)

- [ ] `strux introspect` — read existing DB schema, emit `.strux` type definitions
- [ ] Lint rules for `@opaque` annotation growth threshold

## Persistence Annotations (type-persistence-annotations)

- [ ] Composite primary keys — `@@id([f1, f2])` block annotation; deferred from type-persistence-annotations (uncommon, adds significant validator complexity)
- [ ] `@db.XXX` native-type annotations — Prisma-specific type overrides (e.g. `@db.VarChar(255)`); deferred as too ORM-specific for the current abstraction layer
- [ ] Bi-directional schema sync — round-trip between DB state and `.strux` source; out of scope until `strux introspect` lands

## Testing

- [ ] Generated code integration tests — verify that built packages produce working behavior
- [ ] Adapter golden file tests per stack — same `.strux` input, expected output per framework+version
- [ ] User-facing test helpers — utilities for testing `.strux` definitions against generated code

## Token Optimization (v0.6.0 roadmap)

- [ ] ADR formalizing token-efficient authoring pattern (context cascade, named references, shorthand)
