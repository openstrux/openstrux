## 1. Lexer

- [x] 1.1 Define `TokenType` enum and `Token` interface (`type, value, line, col, length`) in `packages/parser/src/lexer.ts`
- [x] 1.2 Implement `tokenize(source: string): Token[]` — handles all token types including context-sensitive `NEWLINE` inside `@panel` blocks
- [x] 1.3 Write lexer unit tests: keywords (`@type`, `@panel`, `@context`, `@access`, `@dp`), identifiers, strings, numbers, braces, operators, newline significance
- [x] 1.4 Verify lexer handles UTF-8 source and reports correct line/col for multi-line inputs

## 2. Parser core

- [x] 2.1 Define `ParseResult = { ast: StruxNode[], diagnostics: Diagnostic[] }` and `Diagnostic` interface in `packages/parser/src/types.ts`
- [x] 2.2 Implement `Parser` class with token cursor, `peek()`, `consume()`, `expect()`, and `recover()` (skip-to-newline error recovery)
- [x] 2.3 Implement `parseFile()` top-level dispatcher: routes `@type`, `@panel`, `@context` tokens to sub-parsers
- [x] 2.4 Implement `parseRecord()`, `parseEnum()`, `parseUnion()` for the three `@type` definition forms
- [x] 2.5 Implement `parsePanel()` — parse `@panel Name { ... }` including `@access` block and rod lines
- [x] 2.6 Implement `parseAccessBlock()` — parse `@access { principal, intent, scope }` into AccessContext node
- [x] 2.7 Implement `parseRod()` dispatcher — routes on rod-type keyword to per-rod knot parsers
- [x] 2.8 Implement shared knot parsers: `parseCfgKnot()`, `parseArgKnot()`, `parseInKnot()`, `parseOutKnot()`, `parseErrKnot()`
- [x] 2.9 Implement per-rod shorthand parsers for all 18 rod types (share knot parsers where possible)
- [x] 2.10 Implement `parseExprShorthand()` — capture raw text for filter/projection/aggregation expressions

## 3. Diagnostics

- [x] 3.1 Define diagnostic codes: `E001` (unclosed brace), `E002` (unknown rod), `E003` (malformed type path), `W001` (missing @access)
- [x] 3.2 Wire diagnostic codes into all error paths in the parser
- [x] 3.3 Write unit tests asserting correct code + line/col for each diagnostic case

## 4. Conformance

- [x] 4.1 Write `conformance/invalid/err-unclosed-brace.strux` + `err-unclosed-brace.expected.json`
- [x] 4.2 Write `conformance/invalid/err-unknown-rod.strux` + `err-unknown-rod.expected.json`
- [x] 4.3 Write `conformance/invalid/err-bad-type-path.strux` + `err-bad-type-path.expected.json`
- [x] 4.4 Write `conformance/invalid/warn-missing-access.strux` + `warn-missing-access.expected.json`
- [x] 4.5 Mirror all invalid fixtures into `openstrux-core/tests/fixtures/invalid/`
- [x] 4.6 Write conformance test suite in `packages/parser/src/__tests__/conformance.test.ts` that runs parser against all valid/ fixtures (expect zero diagnostics) and all invalid/ fixtures (expect matching diagnostic codes)
- [x] 4.7 Run `pnpm test --filter packages/parser` — all conformance tests pass
