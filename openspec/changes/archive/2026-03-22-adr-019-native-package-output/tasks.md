## 1. Spec Updates (openstrux-spec)

- [x] 1.1 Update `specs/modules/target-ts/generator.md` — rename to `target-nextjs`, update adapter interface (`emit`/`package` split), update output paths to `.openstrux/build/`, remove `target: "typescript"` references
- [x] 1.2 Update `specs/modules/target-ts/rods.md` — rod emitters produce `ChainStep` objects instead of standalone snippets, no TODO stubs for fully-specified pipelines
- [x] 1.3 Update `rfcs/RFC-0001-typescript-target-adapter.md` — adapter contract updated with `emit()`/`package()` interface, framework-specific naming, compatibility manifest
- [x] 1.4 Update golden conformance fixtures in `conformance/golden/target-ts/` — new output paths (package-relative), complete handler implementations instead of stubs, barrel exports
- [x] 1.5 Accept ADR-019 (change status from Proposed to Accepted)

## 2. Generator Core (openstrux-core/packages/generator)

- [x] 2.1 Update `types.ts` — rename `Adapter.generate()` to `Adapter.emit()`, add `Adapter.package()`, add `PackageOutput`, `ResolvedOptions`, `ChainContext`, `ChainStep` types
- [x] 2.2 Update `registry.ts` — register adapters by framework name (`nextjs`) instead of `typescript`
- [x] 2.3 Update `generate.ts` — accept `ResolvedOptions` instead of `GenerateOptions`, orchestrate `emit()` + `package()` pipeline
- [x] 2.4 Add config parser for `strux.config.yaml` — read target section, parse npm-style semver ranges, resolve against bundled adapter manifests
- [x] 2.5 Add adapter resolution — match config ranges against adapter compatibility manifests, produce `ResolvedOptions`

## 3. TypeScript Base (openstrux-core/packages/generator/src/adapters)

- [x] 3.1 Extract `ts-base/` module from current `typescript/` adapter — move `tsType()`, `prismaType()`, `zodType()`, type/enum/union emitters, schema emitters, Prisma emitters
- [x] 3.2 Create `nextjs/` adapter directory — import shared utilities from `ts-base`, implement `NextJsAdapter` with `emit()` and `package()` methods
- [x] 3.3 Implement `NextJsAdapter.package()` — emit `package.json`, `tsconfig.json`, barrel `index.ts`, sub-path exports (`schemas/index.ts`, `handlers/index.ts`)
- [x] 3.4 Remove old `typescript/` adapter directory after migration

## 4. Rod Chaining (openstrux-core/packages/generator/src/adapters/nextjs/rods)

- [x] 4.1 Refactor rod emitters from `RodEmitter` to `RodStepEmitter` — each returns `ChainStep` with imports, statement, outputVar, outputType
- [x] 4.2 Implement chain composer — walks panel rod chain, calls step emitters in order, combines imports (deduplicated) and statements into a complete handler function
- [x] 4.3 Update `receive` step emitter — produces request parsing statement (`await req.json()`)
- [x] 4.4 Update `validate` step emitter — produces Zod `.parse()` statement
- [x] 4.5 Update `guard` step emitter — produces AccessContext check statement
- [x] 4.6 Update `write-data` step emitter — produces Prisma `.create()` / `.update()` statement
- [x] 4.7 Update `read-data` step emitter — produces Prisma `.findMany()` / `.findUnique()` statement
- [x] 4.8 Update `respond` step emitter — produces `NextResponse.json()` return statement
- [x] 4.9 Update `transform` step emitter — produces typed function call
- [x] 4.10 Update `filter` step emitter — produces array filter with predicate
- [x] 4.11 Update `split` step emitter — produces switch statement dispatching to sub-chains
- [x] 4.12 Update `call` step emitter — produces fetch call to external endpoint
- [x] 4.13 Update `encrypt`/`pseudonymize` step emitters — produce compliance wrapper calls
- [x] 4.14 Update Tier 2 rod stubs (`group`, `aggregate`, `merge`, `join`, `window`) — produce STRUX-STUB chain steps with diagnostic comment

## 5. CLI Commands (openstrux-core — new package or extend existing)

- [x] 5.1 Implement `strux build` command — read config, resolve adapters, parse `.strux` files, validate, call `emit()` + `package()`, write to `.openstrux/build/`
- [x] 5.2 Implement `strux init` command — detect stack from `package.json`, prompt confirmation, write `strux.config.yaml`, configure `tsconfig.json` paths, add `.openstrux/` to `.gitignore`, create starter `.strux` file, run `strux build`
- [x] 5.3 Implement `strux doctor` command — validate config against adapter manifests, verify `tsconfig.json` paths, report status with ✓/✗

## 6. Tests

- [x] 6.1 Update conformance tests — golden fixtures match new package-relative output paths and complete handler implementations
- [x] 6.2 Update rod emitter tests — verify `ChainStep` output instead of string snippets
- [x] 6.3 Add chain composer tests — verify linear pipeline produces complete handler, split produces switch
- [x] 6.4 Add `package()` tests — verify barrel exports, package.json, tsconfig.json generation
- [x] 6.5 Add config parser tests — valid config, missing fields, unsupported ranges
- [x] 6.6 Add `strux init` integration test — verify config, tsconfig paths, gitignore, starter file, and build output
- [x] 6.7 Add `strux doctor` tests — valid config reports ✓, missing adapter reports ✗, missing tsconfig paths reported

## 7. Documentation

- [x] 7.1 Create `docs/getting-started.md` (openstrux repo) — end-to-end onboarding: install CLI → `strux init` → write first `.strux` file → `strux build` → import in app code
- [x] 7.2 Create `docs/migration/from-loose-files.md` (openstrux repo) — step-by-step migration for anyone using the current generator output
- [x] 7.3 Update `CLAUDE.md` (openstrux repo) — mention new CLI commands, docs folder updates
- [x] 7.4 Update `openstrux-core` README — usage examples with `strux build` instead of programmatic `generate()`
