## 1. Rod dispatch table

- [ ] 1.1 Refactor `packages/generator/src/adapters/typescript/index.ts` — extract rod dispatch into `rods/index.ts` mapping all 18 rod type strings to emitter functions
- [ ] 1.2 Add a fallback entry for unrecognised rod types that emits `// STRUX-STUB: <rod-type>` and logs a warning
- [ ] 1.3 Add generator summary: after generation, print count of Tier 1 emitters used, Tier 2 stubs emitted, and flag panels containing stubs as non-demo-capable

## 2. Tier 1 emitters — computation and control

- [ ] 2.1 Implement `rods/transform.ts` — typed mapping function stub with inferred `in`/`out` types; falls back to `unknown` if unresolved
- [ ] 2.2 Implement `rods/filter.ts` — `input.filter((item) => /* TODO: <expr> */)` inline
- [ ] 2.3 Write unit tests for `transform` and `filter` emitters

## 3. Tier 1 emitters — I/O and topology

- [ ] 3.1 Implement `rods/write-data.ts` — Prisma `create`/`update` stub with model name from `cfg.target`
- [ ] 3.2 Implement `rods/call.ts` — `fetch()` stub with URL/method from `cfg.endpoint`/`cfg.method`
- [ ] 3.3 Implement `rods/split.ts` — `switch` block with one `case` per named route
- [ ] 3.4 Write unit tests for `write-data`, `call`, `split` emitters

## 4. Tier 1 emitters — compliance

- [ ] 4.1 Implement `rods/pseudonymize.ts` — wrapper function stub with JSDoc citing AccessContext scope fields
- [ ] 4.2 Implement `rods/encrypt.ts` — wrapper function stub with JSDoc citing AccessContext scope fields
- [ ] 4.3 Write unit tests for `pseudonymize` and `encrypt` emitters

## 5. Tier 2 stubs (non-demo-capable)

- [ ] 5.1 Implement `rods/group.ts` — `// STRUX-STUB: group` at call site
- [ ] 5.2 Implement `rods/aggregate.ts` — `// STRUX-STUB: aggregate` at call site
- [ ] 5.3 Implement `rods/merge.ts` — `// STRUX-STUB: merge` at call site
- [ ] 5.4 Implement `rods/join.ts` — `// STRUX-STUB: join` at call site
- [ ] 5.5 Implement `rods/window.ts` — `// STRUX-STUB: window` at call site

## 6. Golden fixtures and conformance

- [ ] 6.1 Write golden fixtures for each Tier 1 emitter in `openstrux-spec/conformance/golden/target-ts/rods/`
- [ ] 6.2 Mirror golden fixtures into `openstrux-core/tests/fixtures/golden/target-ts/rods/`
- [ ] 6.3 Add conformance tests for all 18 rod types — valid TypeScript output, no crashes
- [ ] 6.4 Add test asserting generator summary flags panels with Tier 2 stubs
- [ ] 6.5 Run `pnpm test` from repo root — all packages pass
