# openstrux — Project Hub

This repo is the canonical home for the Openstrux manifesto, governance, benchmark definitions, use-cases, and demos. It is **not** the spec and **not** the implementation — see sister repos below.

## Sister repos

| Repo | Purpose |
|---|---|
| `../openstrux-spec` | Normative language specification (v0.5) |
| `../openstrux-core` | Parser, validator, AST/IR implementation |
| `../openstrux-uc-grant-workflow` | NLnet grant-workflow use case (P0–P2 demo for v0.6.0) |

## Folder guide

```
docs/manifesto/     Manifesto, objectives, and benchmark policy — normative for all review decisions
docs/architecture/  Cross-repo architecture diagrams and notes
docs/roadmap/       Release plans, milestone tracking, and backlog (unversioned future work pool)
docs/use-cases/     Per-use-case requirements (grant-workflow = privacy-first grant review workflow)
benchmarks/cases/   Benchmark case definitions per MANIFESTO_BENCHMARKS.md (B001–B030+)
benchmarks/baselines/ Hand-written reference implementations (Beam Python, TypeScript)
benchmarks/results/ Dated benchmark run outputs and scorecards
governance/         Contribution policy, RFC process, release gate rules
demos/              Self-contained runnable examples
tmp/                Working drafts only — promote to openstrux-spec via change-package
```

## Key rules

- `docs/manifesto/` is normative. Never edit without a versioned justification.
- Benchmark cases MUST follow the format in `MANIFESTO_BENCHMARKS.md §5`.
- Draft spec material goes to `tmp/` then migrates to `openstrux-spec` — never stays here permanently.
- `tmp/` is untracked working space; do not commit tmp files to main.

## Commit format

**Title:** imperative, ≤ 72 chars.

**Body:** single flowing paragraph — no unnecessary line breaks. Wrap only at natural sentence boundaries if needed.

**Human-authored:**
```
<description>

Author: Name <email>
```

**AI-assisted:**
```
<description>

Author: homofaber-tech with Claude Opus 4.6 <info@homofaberconsulting.com>
[Gen AI contribution: <1–2 elements max, must make clear it followed author's instructions and that author has reviewed and eventually updated the result>]
Defined and Reviewed by author
```

Update model name to whichever is actually running. Keep `[Gen AI contribution]` to 1–2 brief items. Do NOT use `Co-Authored-By`. NLnet grant compliance requires explicit AI disclosure.
