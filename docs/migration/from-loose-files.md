# Migration: From Loose Files to Native Package Output (v0.5 → v0.6)

Before v0.6, the generator wrote loose TypeScript files directly into your source tree. From v0.6 onward, the generator emits a native package-shaped build artifact to `.openstrux/build/`, and you import from it via the `@openstrux/build` path alias.

## What changed

| Before (v0.5) | After (v0.6) |
|---|---|
| `generate(ast, {}, { target: "typescript" })` | `build(ast, {}, { framework: "next" })` |
| Wrote files to `app/api/<panel>/route.ts` | Writes to `.openstrux/build/handlers/<panel>.ts` |
| No `package.json` or barrel exports | Emits `package.json`, `index.ts`, `schemas/index.ts`, `handlers/index.ts` |
| Rod emitters returned string snippets | Rod emitters return `ChainStep` objects; chain composer assembles complete handlers |
| `adapter.generate()` | `adapter.emit()` + `adapter.package()` |
| `target: "typescript"` in options | `framework: "next"` + config-driven `strux.config.yaml` |
| No CLI | `strux build`, `strux init`, `strux doctor` |

## Migration steps

### 1. Run `strux init`

If you haven't already:

```bash
npx strux init
```

This writes `strux.config.yaml`, updates `tsconfig.json`, and adds `.openstrux/` to `.gitignore`.

### 2. Remove manually placed generated files

Before v0.6, generated files lived in your source tree (e.g., `app/api/*/route.ts`, `lib/schemas/`). These should now come from `.openstrux/build/` instead.

**Prisma schema:** In v0.6, `strux build` generates a complete `prisma/schema.prisma` at your project root from `@type` declarations with persistence annotations (`@pk`, `@relation`, `@@index`, `@timestamps`, etc.). If you previously authored `prisma/schema.prisma` by hand, migrate the model definitions into `.strux` annotations and let the generator produce the file.

Remove:
- `app/api/<panel>/route.ts` files that were generated (keep hand-written ones)
- `lib/schemas/<Type>.schema.ts` files that were generated
- Any hand-authored `prisma/schema.prisma` once all models are covered by `.strux` annotations

### 3. Update imports

Old (direct file path):
```typescript
import { POST } from "./app/api/intake-proposals/route";
import { ProposalSchema } from "./lib/schemas/Proposal.schema";
```

New (via path alias):
```typescript
import { POST } from "@openstrux/build/handlers/intake-proposals.js";
import { ProposalSchema } from "@openstrux/build/schemas/Proposal.schema.js";
// or via barrel:
import { intakeProposals } from "@openstrux/build/handlers";
import { ProposalSchema } from "@openstrux/build/schemas";
```

### 4. Update programmatic usage

If you called the generator programmatically, update the API:

Old:
```typescript
import { generate } from "@openstrux/generator";
const files = generate(ast, {}, { target: "typescript" });
// write files manually to your source tree
```

New:
```typescript
import { build } from "@openstrux/generator";
const { files, pkg } = build(ast, {}, { framework: "next" });
// files go to pkg.outputDir (.openstrux/build/)
```

Or just use the CLI:
```bash
npx strux build
```

### 5. Add `.openstrux/` to `.gitignore`

`.openstrux/build/` is generated output — it should not be committed. `strux init` does this automatically, but if you skipped init:

```
echo ".openstrux/" >> .gitignore
```

### 6. Verify with `strux doctor`

```bash
npx strux doctor
```

All three checks (config, adapter, tsconfig paths) should show ✓.

## Schema file path change

In v0.5, Zod schemas were written to `lib/schemas/<Type>.schema.ts`. In v0.6, they are written to `schemas/<Type>.schema.ts` (relative to the output package root, resolving to `.openstrux/build/schemas/<Type>.schema.ts`).

Update any direct imports of schema files.
