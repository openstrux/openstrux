## Why

The `v0-6-0-target-ts` change implements the adapter contract and the 6 rods needed for grant-workflow P0-P2. The remaining 12 rods are currently unhandled — the generator would either crash or silently skip them. All 18 rods must be handled before the toolchain can be called complete.

## What Changes

- Add TypeScript emitters for the 12 currently unhandled rods in `packages/generator/src/adapters/typescript/`
- **Tier 1 — real emitters** (used in grant-workflow P0-P6): `transform`, `filter`, `write-data`, `call`, `split`, `pseudonymize`, `encrypt`
- **Tier 2 — handled stubs** (not used in the grant-workflow use case): `group`, `aggregate`, `merge`, `join`, `window`
- Tier 2 stubs emit `// STRUX-STUB: <rod-type>` comments, keeping output compilable
- Generator MUST NOT throw or produce invalid TypeScript for any of the 18 rod types

**Exit criteria by tier:**
- **Tier 1**: Real emitters producing compilable TypeScript with correct type signatures. Golden fixtures required. Demo-capable — can be used in grant-workflow.
- **Tier 2**: Handled stubs only. No golden fixtures required. Explicitly marked as non-demo-capable. MUST NOT appear in benchmark claims or demo output. Generator summary prints stub count.

## Capabilities

### New Capabilities

- `rods-target-ts`: TypeScript emitters for all 18 basic rods — completes rod coverage

### Modified Capabilities

- `target-adapter-ts`: Extended with 12 additional rod emitters; dispatch table covers all 18 types

## Impact

- **openstrux-core**: Changes confined to `packages/generator/src/adapters/typescript/rods/`
- **openstrux-spec**: New golden fixtures for Tier 1 rod outputs only; existing P0-P2 golden fixtures unaffected
- **grant-workflow demo**: `transform` emitter unblocks P2 eligibility panel; P3-P6 panels become generatable
- **No breaking changes** to the adapter contract
