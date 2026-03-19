## Context

With `v0-6-0-target-ts` in place, the generator handles the adapter contract, the 6 P0-P2 rods, and the three type definition forms. This change fills the remaining 12 rod emitters. The architecture is already established — this is additive work inside `packages/generator/src/adapters/typescript/rods/`, one file per rod or per logical group.

## Goals / Non-Goals

**Goals:**
- Tier 1 rod emitters (real TypeScript output): `transform`, `filter`, `write-data`, `call`, `split`, `pseudonymize`, `encrypt`
- Tier 2 rod emitters (compilable stubs): `group`, `aggregate`, `merge`, `join`, `window`
- All 18 rods registered in the rod dispatch table
- Generator exits cleanly for any valid `.strux` panel regardless of rod types used
- Golden fixtures for Tier 1 rod outputs in `conformance/golden/target-ts/`

**Non-Goals:**
- Full expression compilation for computation rods (raw-expr fallback)
- Stream processing semantics for `window`, `merge` (stub output only)
- Beam Python equivalents

**Exit criteria by tier:**

| | Tier 1 | Tier 2 |
|---|---|---|
| Output | Real compilable TypeScript | `// STRUX-STUB` comment |
| Golden fixtures | Required | Not required |
| Demo-capable | Yes | No |
| Benchmark claims | Eligible | Excluded |
| Generator summary | Counted as implemented | Counted as stubbed |

## Decisions

**One file per rod in `rods/` subdirectory**
Each rod gets `rods/<rod-type>.ts` exporting an emitter function. The dispatch table maps rod type strings to emitters.

**`transform` emits a typed mapping function stub**
Emits `transform<InputType, OutputType>(input: InputType): OutputType { /* TODO */ }` with types from `in`/`out` knots. Falls back to `unknown` if unresolved.

**`filter` emits an array filter stub**
`input.filter((item) => /* TODO: <raw-expr> */)` inline.

**`write-data` emits a Prisma create/update stub**
Mirrors `read-data`. Model name from `cfg.target`.

**`call` emits a `fetch()` stub**
URL and method from `cfg.endpoint` and `cfg.method`.

**`split` emits a switch-statement routing stub**
One `case` per named route in split config.

**`pseudonymize` and `encrypt` emit compliance function stubs**
Wrapper functions with JSDoc citing AccessContext scope fields.

**Tier 2 stubs: single-line comment only**
`// STRUX-STUB: <rod-type> — implement for production use`. Grep-able. Generator summary prints count.

**Tier 2 stubs excluded from benchmark claims**
Any panel that contains a Tier 2 stub rod is flagged in the generator summary and excluded from token compression measurements in the benchmark suite. This prevents reporting compression ratios for incomplete functionality.

## Risks / Trade-offs

**[Risk] `transform` stub doesn't compile if knot types are unresolved raw-expr nodes**
-> Mitigation: Falls back to `unknown` with a TODO comment — still valid TypeScript.

**[Risk] Tier 2 stubs produce compilable but misleading output**
-> Mitigation: `// STRUX-STUB` prefix is grep-able. Generator summary prints stub count. Stubs are excluded from benchmark claims.

## Open Questions

- Should `split` emit a discriminated union return type? Decision: no for v0.6.0 — each case returns `NextResponse` uniformly.
