# Getting Started with Openstrux

This guide walks you through installing the CLI, writing your first `.strux` file, running `strux build`, and importing the generated output in your Next.js application.

## Prerequisites

- Node.js 20+
- A Next.js 13+ project with TypeScript, Prisma, and Zod

## Install the CLI

```bash
npm install --save-dev @openstrux/cli
```

## Initialize your project

Run `strux init` from your project root. It will detect your installed stack and ask for confirmation before writing any files.

```bash
npx strux init
```

What `strux init` does:
1. Reads `package.json` to detect `next`, `prisma`, `zod`, and `typescript` versions
2. Writes `strux.config.yaml` with the detected stack
3. Adds `@openstrux/build` path aliases to `tsconfig.json`
4. Adds `.openstrux/` to `.gitignore`
5. Creates `src/strux/starter.strux` with a health-check example
6. Runs `strux build` to generate the initial output

After `strux init`:

```
your-project/
├── strux.config.yaml          ← new: adapter configuration
├── .gitignore                 ← updated: .openstrux/ added
├── tsconfig.json              ← updated: @openstrux/build path aliases
├── src/strux/
│   └── starter.strux          ← new: starter panel definition
└── .openstrux/build/          ← new: generated output (gitignored)
    ├── handlers/
    │   ├── health.ts
    │   └── index.ts
    ├── index.ts
    ├── package.json
    └── tsconfig.json
```

## Write a panel

Create a `.strux` file anywhere under `src/`:

```
// src/strux/proposals.strux

@type Proposal @timestamps {
  id:     string @pk
  title:  string
  status: ReviewStatus
}

@enum ReviewStatus {
  Submitted
  UnderReview
  Accepted
  Rejected
}

@panel intake-proposals {
  @access { purpose: "grant-review", operation: "write" }
  receive = receive {
    trigger: http { method: "POST", path: "/api/proposals" }
  }
  validate = validate { schema: Proposal }
  save = write-data { model: Proposal }
  respond-ok = respond { schema: Proposal }
}
```

## Build

```bash
npx strux build
```

This reads all `.strux` files under your project, resolves the configured adapter, and writes:
- Generated TypeScript to `.openstrux/build/`
- A complete `prisma/schema.prisma` to your project root (from `@type` declarations with persistence annotations)

Use `--explain` to print the generated Prisma schema before writing: `npx strux build --explain`.

## Import in your app

Because `tsconfig.json` has the `@openstrux/build` path alias, you can import directly:

```typescript
import { POST } from "@openstrux/build/handlers";
// or specific panel:
import { POST } from "@openstrux/build/handlers/intake-proposals.js";
```

In a Next.js route file (`app/api/proposals/route.ts`):

```typescript
export { POST } from "@openstrux/build/handlers/intake-proposals.js";
```

## Verify configuration

Use `strux doctor` to check that everything is set up correctly:

```bash
npx strux doctor
```

Sample output:

```
strux doctor

  ✓ strux.config.yaml — found and parsed
      framework:  next@^15.0
      orm:        prisma@^6.0
      validation: zod@^3.23
      base:       typescript@~5.5
      runtime:    node@>=20

  ✓ adapter resolved — adapter/nextjs@1.0.0

  ✓ tsconfig.json — @openstrux/build paths configured
```

## Next steps

- See `docs/migration/from-loose-files.md` if you were using the generator programmatically before v0.6.
- Browse `src/strux/` to add more panels.
- Run `strux build` after every `.strux` change (or add it to your watch script).
