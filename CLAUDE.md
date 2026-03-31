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
docs/manifesto/          Manifesto, objectives, and benchmark policy — normative for all review decisions
docs/architecture/       Cross-repo architecture diagrams and notes
docs/roadmap/            Release plans, milestone tracking, and backlog (unversioned future work pool)
docs/use-cases/          Per-use-case requirements (grant-workflow = privacy-first grant review workflow)
docs/getting-started.md  End-to-end onboarding: install CLI → strux init → build → import
docs/migration/          Migration guides (e.g. from-loose-files.md for v0.5 → v0.6)
benchmarks/cases/        Benchmark case definitions per MANIFESTO_BENCHMARKS.md (B001–B030+)
benchmarks/baselines/    Hand-written reference implementations (Beam Python, TypeScript)
benchmarks/results/      Dated benchmark run outputs and scorecards
governance/              Contribution policy, RFC process, release gate rules
demos/                   Self-contained runnable examples
tmp/                     Working drafts only — promote to openstrux-spec via change-package
```

## Key rules

- `docs/manifesto/` is normative. Never edit without a versioned justification.
- Benchmark cases MUST follow the format in `MANIFESTO_BENCHMARKS.md §5`.
- Draft spec material goes to `tmp/` then migrates to `openstrux-spec` — never stays here permanently.
- `tmp/` is untracked working space; do not commit tmp files to main.

## Benchmark runner — quick reference

UC repo: `../openstrux-uc-grant-workflow`
Runner: `benchmarks/runner/run-benchmark.sh`
Paths: `direct` | `openstrux`
Modes: `prompt` | `agent` | `apply` | `clean-test-env`

### Typical workflow — prompt → CC session → apply

```bash
# Step 1: generate prompt + worktree
benchmarks/runner/run-benchmark.sh \
  --uc ../openstrux-uc-grant-workflow \
  --path direct \
  --mode prompt

# Step 2: run CC in the worktree (printed at end of step 1)
#   claude "<worktree-path>"
#   paste prompt-direct.txt; CC commits & pushes to bench branch
#   token usage captured automatically on session end

# Step 3: apply (--keep-test-env keeps worktree + DB for manual tests)
benchmarks/runner/run-benchmark.sh \
  --uc ../openstrux-uc-grant-workflow \
  --path direct \
  --mode apply \
  --result-dir ../openstrux-uc-grant-workflow/benchmarks/results/<slug> \
  --keep-test-env

# Clean up when done
benchmarks/runner/run-benchmark.sh \
  --mode clean-test-env \
  --uc ../openstrux-uc-grant-workflow \
  --result-dir ../openstrux-uc-grant-workflow/benchmarks/results/<slug>
```

### Key flags

| Flag | Default | Notes |
|---|---|---|
| `--path` | — | `direct` or `openstrux` |
| `--mode` | `agent` | `prompt`, `agent`, `apply`, `clean-test-env` |
| `--step` | `1` | `1` (generate), `2` (certify), `3` (propagate); steps 2/3 require `--result-dir` from step 1 |
| `--model` | `claude-sonnet-4-6` | any model ID |
| `--provider` | auto from model | `anthropic`, `openai`, `google-gemini` |
| `--keep-test-env` | false | keep worktree + bench DB after tests |
| `--web` | false | prompt mode: web-safe prompt (relative paths, fenced-block output) |
| `--no-db` | — | skip integration tests |
| `--result-dir` | auto-generated | required for apply; required for steps 2/3 |
| `--response` | — | apply: fenced-block file (omit if CC pushed) |
| `--max-turns` | 80 | agent mode only |

### Multi-step workflow (certification benchmarks)

```bash
# Step 1: generate backend (existing workflow)
benchmarks/runner/run-benchmark.sh --uc ... --path openstrux --mode prompt --step 1

# Step 2: certify — assemble certification prompt using step 1 worktree
benchmarks/runner/run-benchmark.sh --uc ... --path openstrux --mode prompt --step 2 \
  --result-dir <step-1-result-dir>
# → writes step-1-result-dir/step-2/prompt-openstrux.txt

# Step 3: propagate — add phone_number PII field and re-certify
benchmarks/runner/run-benchmark.sh --uc ... --path openstrux --mode prompt --step 3 \
  --result-dir <step-1-result-dir>
# → writes step-1-result-dir/step-3/prompt-openstrux.txt
```

### Scoring certification results

```bash
node --experimental-strip-types benchmarks/runner/score-certification.ts \
  --result   <step-2-result-dir>/art30-output.json \
  --reference benchmarks/baselines/art30-reference.json \
  --response  <step-2-result-dir>/response.txt \
  --out       <step-2-result-dir>/scoring.json
```

### Result dir layout (auto: `../openstrux-uc-grant-workflow/benchmarks/results/<YYYYMMDD-HHmmss>-<path>`)

```
prompt-<path>.txt     assembled prompt
worktree.txt          abs path to worktree
response-agent.txt    agent conversation log
test-unit.json        final unit test results
generation-meta.json  tokens / turns / time
code-surface.json     meaningful code token count (B016 — token-maintainability)
evidence.zip          bundled artefacts
step-2/
  prompt-<path>.txt   certification prompt
  response1.txt       LLM response slot
  scoring.json        completeness / accuracy / queryability scores
step-3/
  prompt-<path>.txt   propagation prompt
  response1.txt       LLM response slot
```

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
