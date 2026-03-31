## Context

The benchmark runner (`benchmarks/runner/`) currently supports a single-step flow: generate a prompt, run an agent (or hand it to a human), then apply and score the results. The scoring focuses on functional correctness (tests pass, types compile).

The grant-workflow use case (`openstrux-uc-grant-workflow`) processes personal data (applicant names, emails, proposal content). Both benchmark paths generate code that handles this data, but neither path is asked to *certify* its privacy compliance. This means the benchmark cannot distinguish between "code that works" and "code that is auditable" — the core value proposition of Openstrux's structure-first approach.

The `private-data-rod` change in openstrux-spec (parallel work) introduces the `private-data` standard rod with GDPR manifest records. This benchmark change is designed to exercise and measure that capability once available, but the certification step is also meaningful *without* the `private-data` rod — it tests whether the LLM can produce Art. 30 records from existing code/metadata.

## Goals / Non-Goals

**Goals:**

- Define a multi-step benchmark protocol: generate → certify → propagate
- Create concrete benchmark cases that measure certification quality, not just functional correctness
- Extend the runner to orchestrate multi-step flows with intermediate prompts
- Establish scoring metrics that capture the structural advantage of `.strux` over raw TypeScript for compliance tasks

**Non-Goals:**

- Implementing the `private-data` rod or compiler changes (that's the parallel spec change)
- Legal validation of Art. 30 record completeness (we measure structural completeness, not legal sufficiency)
- Automating certification scoring end-to-end (human review remains part of the process for v1)
- Supporting non-GDPR certification benchmarks (CCPA etc. are future work)

## Decisions

### D1: Three-step benchmark protocol

The benchmark extends the existing single-step flow into up to three steps:

| Step | Prompt | Measures | Available for |
|------|--------|----------|---------------|
| 1. Generate | Existing backend generation prompt | Functional correctness (tests pass) | Both paths |
| 2. Certify | "Produce a GDPR Art. 30 record for this system" | Certification completeness and accuracy | Both paths |
| 3. Propagate | "Add field X as PII, update certification" | Change propagation correctness | Both paths |

Steps 2 and 3 operate on the *output of step 1* — they run in the same worktree, with the generated code already committed. This means the LLM must work with code it (or another LLM) already wrote.

**Why three steps instead of two:** Step 3 (propagation) is the killer differentiator. Step 2 alone shows that openstrux metadata is easier to query. Step 3 shows that structural changes *ripple correctly* through the certified pipeline — add a field to `@type`, rebuild, and the Art. 30 record updates automatically. The direct path must manually trace every file that touches the new field.

**Why same worktree:** The certification step must work with the actual generated code, not a clean reference. This is realistic — in production, you certify *your* code, not an idealized version.

### D2: Certification prompt design

The step 2 prompt is path-agnostic (identical for both paths):

> Produce a GDPR Article 30 record of processing activities for this system. For each data flow that processes personal data, state:
> 1. Controller identity and DPO
> 2. Processing purpose
> 3. Lawful basis
> 4. Categories of data subjects
> 5. Categories of personal data processed
> 6. Recipients or categories of recipients
> 7. Retention period
> 8. Technical and organizational security measures
> 9. DPIA reference (if applicable)
>
> Output as structured JSON following the schema in `benchmarks/schemas/art30-record.json`.

The prompt asks for structured JSON output so scoring can be partially automated. The schema is defined as part of this change.

**Why structured JSON:** Free-text Art. 30 records are hard to score programmatically. JSON with a defined schema enables field-by-field comparison against a reference record.

### D3: Scoring model

Three dimensions, each 0–100:

1. **Completeness** (40%): How many Art. 30 fields are populated? Missing fields = deductions. Scored per data flow.
2. **Accuracy** (40%): Are the values correct? Compared against a human-authored reference record. Field classification, purpose, lawful basis must match.
3. **Structural queryability** (20%): Did the LLM extract the information from structured metadata (`.strux`, manifest) or by scanning TypeScript? Measured by:
   - **Openstrux path**: Check if the answer references manifest `privacyRecords`, `.strux` `@dp`/`@access` blocks, or field classifications. If yes → high score.
   - **Direct path**: Check if the answer references specific TypeScript files/functions/comments. If it greps through code → lower score (correct but fragile).

**Why 20% for queryability:** It's the differentiator but shouldn't dominate. A direct-path agent that produces a perfect Art. 30 record by reading code carefully deserves a high score — the point is that it's *harder*, not impossible.

### D4: Runner multi-step support

The runner gains a `--step` flag:

```bash
# Step 1: generate (existing)
run-benchmark.sh --uc ... --path openstrux --mode prompt --step 1

# Step 2: certify (new)
run-benchmark.sh --uc ... --path openstrux --mode prompt --step 2 \
  --result-dir <step-1-result-dir>

# Step 3: propagate (new)
run-benchmark.sh --uc ... --path openstrux --mode prompt --step 3 \
  --result-dir <step-1-result-dir>
```

Steps 2 and 3 reuse the worktree from step 1 (read from `<result-dir>/worktree.txt`). The step-specific prompt is assembled from `benchmarks/prompts/step-2-certify.md` and `benchmarks/prompts/step-3-propagate.md`.

**Why `--step` flag over separate modes:** Steps share a worktree and build on each other. A flag keeps them under the same `--mode prompt/agent/apply` umbrella while indicating the position in the sequence.

### D5: Reference Art. 30 record

A human-authored reference Art. 30 record for the grant workflow is created at `benchmarks/baselines/art30-reference.json`. This is the ground truth for scoring step 2 accuracy. It covers:

- Intake pipeline: applicant submits proposal (purpose: grant application processing, basis: contract)
- Eligibility pipeline: reviewer evaluates eligibility (purpose: eligibility assessment, basis: legitimate interest)
- PII fields: applicant name, email, organization, proposal content
- Technical measures: pseudonymization of applicant identity, access control via role middleware

## Risks / Trade-offs

- **Step ordering dependency**: Step 2 quality depends entirely on step 1 output. A failed step 1 produces garbage for step 2. Mitigated by only scoring step 2 when step 1 passes all acceptance criteria.
- **Reference record subjectivity**: What counts as "correct" for Art. 30 fields involves judgment (e.g., is "grant review" or "eligibility assessment" the right purpose?). Mitigated by allowing synonym matching in the scoring rubric and focusing on structural completeness over exact wording.
- **Queryability scoring is heuristic**: We infer whether the LLM used structural metadata by examining its reasoning/output, which is imperfect. Mitigated by keeping this dimension at 20% weight.
- **`private-data` rod not yet available**: The openstrux path currently lacks manifest `privacyRecords`. Step 2 can still work with raw `.strux` metadata (`@dp`, `@access`), but the full structural advantage only appears after the private-data-rod change lands. The benchmark is designed to work with or without it.
