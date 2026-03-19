# Commit Format

## Title

One line, imperative mood, ≤ 72 characters.

```
Fix compliance test failures in generated TypeScript output
```

---

## Body

Blank line after the title, then a prose description explaining **what** changed and **why**. Be specific enough that the commit is self-contained without reading the diff.

### Human-authored commit

```
Fix several mistakes in generated code, make it compile; manually
verify each test with RFC123 specification.

Author: Olivier Fabre <info@homofaberconsulting.com>
```

### AI-assisted commit

```
Drafted governance document structure and section headings based on
manifesto objectives; author reviewed content, rewrote policy clauses,
and verified alignment with project governance requirements.

Author: Olivier Fabre with Claude Sonnet 4.6 <info@homofaberconsulting.com>
[Gen AI contribution: document structure, initial section drafts]
Defined and Reviewed by author
```

---

## Rules

| Field | Rule |
|---|---|
| **Author line** | Human name + ` with <Full Model Name>` when AI-assisted; always the human's email (they are responsible for the commit) |
| **[Gen AI contribution]** | Summarise the specific parts where GenAI was actively involved — not a fixed phrase; must be accurate |
| **"Defined and Reviewed by author"** | Fixed phrase; always present when GenAI assisted; asserts the human defined the task and reviewed the output |
| **Date** | Not included in the body — git's built-in commit date is authoritative |

---

## Disclosure rationale

This format ensures AI-generated contributions are disclosed and not presented as human-authored work. The human author's email on the `Author:` line records accountability; the `[Gen AI contribution]` summary records provenance; `Defined and Reviewed by author` records human oversight. See [GenAiPolicy](../docs/use-cases/grant-workflow/GenAiPoliciy.md).
