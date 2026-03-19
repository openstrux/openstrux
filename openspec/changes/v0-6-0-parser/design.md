## Context

The `.strux` language has two syntactic layers: verbose form (explicit `@rod`, `cfg.`, `arg.` prefixes) and shorthand form (implicit linear snaps, dropped prefixes). The spec defines both in `specs/core/panel-shorthand.md` and `specs/core/syntax-reference.md`. The shorthand is the primary authoring form; the verbose form is retained for clarity in complex panels.

The parser is purely a syntax concern — it does not type-check, evaluate expressions, or resolve references. It converts source text to an AST and reports diagnostics. Type-checking belongs in `packages/validator/`.

The grammar uses `@type` for type definitions (record, enum, union), `@panel` for panel blocks, and `@context` for context files. These are the three top-level declaration forms.

## Goals / Non-Goals

**Goals:**
- Hand-written recursive-descent parser (no parser generator) — the grammar is small enough and the diagnostic quality is more controllable
- Parses all constructs needed for grant-workflow P0-P2: `@type` record/enum/union, `@panel` shorthand, 18 rod types, `@access` block, expression shorthand
- Returns `{ ast: StruxNode[], diagnostics: Diagnostic[] }` — never throws
- Zero diagnostics on all `conformance/valid/` fixtures
- Correct diagnostic (code + location) on all `conformance/invalid/` fixtures

**Non-Goals:**
- Full expression evaluation or pushdown analysis (validator/generator concern)
- Config inheritance resolution (validator concern)
- Source maps / incremental parsing (post-0.6.0)
- LSP integration (post-0.6.0)

## Decisions

**Hand-written recursive-descent parser, not a parser generator (PEG.js, Nearley, ANTLR)**
The grammar is approximately 30 productions. A hand-written parser gives full control over error recovery and diagnostic messages, which are a manifesto objective (localised diagnostics, Principle 1).

**Return type: `ParseResult = { ast: StruxNode[], diagnostics: Diagnostic[] }`**
Never throw — always return a result. Diagnostics carry `{ code, message, severity, line, col, length }`. This matches the LSP diagnostic model.

**Lexer/parser split: two-pass**
A separate lexer produces a flat token stream; the parser consumes tokens. Token types include `AT` (for `@type`, `@panel`, `@context`), `IDENT`, `STRING`, `NUMBER`, `LBRACE`, `RBRACE`, and context-sensitive `NEWLINE` inside `@panel` blocks.

**Newline significance in shorthand panels**
In shorthand form, each rod occupies one line. The lexer emits `NEWLINE` tokens inside `@panel` blocks; the parser uses them to delimit rod statements. Outside panels, newlines are insignificant whitespace.

**Error recovery: skip-to-next-statement**
On a syntax error, the parser records the diagnostic and skips tokens until the next newline or `}`. This allows a single parse pass to collect all errors in a file.

**Expression shorthand: parsed as opaque strings for v0.6.0**
Full expression AST nodes exist in `packages/ast/` but parsing them to a structured AST is deferred. The parser stores expression shorthand as `{ kind: "raw-expr", text: "..." }`.

## Risks / Trade-offs

**[Risk] Shorthand newline sensitivity makes the grammar context-dependent**
-> Mitigation: The lexer tracks whether it is inside a `@panel` block and only emits `NEWLINE` tokens in that context.

**[Risk] Expression shorthand parsing is deferred — generator must handle raw strings**
-> Mitigation: Documented limitation. Golden fixtures for P0-P2 use simple expressions only.

**[Risk] 18 rod types means the parser has 18 rod-specific sub-parsers**
-> Mitigation: All rods share the same structural pattern — a single `parseRod()` dispatcher routes on the rod type keyword.

## Open Questions

- Should the parser validate rod types against known 18? Decision: pass unknown identifiers through — keeps the parser a pure syntax concern.
- Is `@dp` decorator required at panel level? Decision: optional for v0.6.0; validator enforces it.
