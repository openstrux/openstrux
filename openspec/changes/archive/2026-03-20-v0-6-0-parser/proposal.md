## Why

The AST node types exist but nothing can produce them. The parser is the entry point for the entire toolchain — without it, no source file can be validated, compiled, or used for generation. This is the first piece of executable code in openstrux-core and must land by 2026-03-22 to unblock the validator and target generator.

## What Changes

- Implement `packages/parser/` in openstrux-core: source text -> typed AST
- Parser handles all constructs needed for the grant-workflow P0-P2 panels: `@type` record/enum/union definitions, `@panel` shorthand, all 18 rod forms, `@access` blocks, expression shorthand
- Structured diagnostics (line, column, message, severity) for syntax errors — no raw exceptions
- Parser passes all `conformance/valid/` fixtures with zero diagnostics
- Invalid fixtures added to `openstrux-spec/conformance/invalid/` to pin error behaviour

## Capabilities

### New Capabilities

- `parser`: `.strux` source text -> `StruxNode[]` AST using the interfaces from `packages/ast/`; reports `Diagnostic[]` for syntax errors
- `conformance-fixtures-invalid`: Invalid `.strux` fixtures in `openstrux-spec/conformance/invalid/` with expected diagnostic codes

### Modified Capabilities

_(none)_

## Impact

- **openstrux-core**: `packages/parser/` goes from stub README to full implementation
- **openstrux-spec**: New files under `conformance/invalid/`
- **Downstream**: `packages/validator/` and target generators import the parser — this change unblocks both
- **No breaking changes**
