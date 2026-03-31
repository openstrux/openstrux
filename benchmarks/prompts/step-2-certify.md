# Step 2 — GDPR Certification

You have just generated a backend for a privacy-first grant review workflow system. Your task now is to produce a GDPR Article 30 Record of Processing Activities for the system you generated.

## What to produce

For each data flow in the system that processes personal data, provide:

1. **Controller identity and DPO** — who is the data controller; who is the Data Protection Officer
2. **Processing purpose** — why is this data being processed
3. **Lawful basis** — the GDPR Article 6 basis (contract, legitimate interest, consent, etc.)
4. **Categories of data subjects** — who the data belongs to
5. **Categories of personal data processed** — what fields or data types are processed
6. **Recipients or categories of recipients** — who receives this data
7. **Retention period** — how long is the data kept
8. **Technical and organizational security measures** — privacy controls applied to this data flow
9. **DPIA reference** — if a Data Protection Impact Assessment exists, reference it; otherwise null

## Output format

Output a single JSON object conforming to the schema at `benchmarks/schemas/art30-record.json`:

```json
{
  "processingActivities": [
    {
      "controller": "...",
      "dpo": "...",
      "purpose": "...",
      "lawfulBasis": "...",
      "dataSubjectCategories": ["..."],
      "personalDataCategories": ["..."],
      "recipients": ["..."],
      "retention": "...",
      "technicalMeasures": ["..."],
      "dpiaRef": null
    }
  ]
}
```

Each processing activity in the system must have its own entry. For the grant workflow, this means at minimum:
- The **intake pipeline** (applicant submits a grant proposal)
- The **eligibility pipeline** (reviewer evaluates eligibility)

## How to approach this (path-specific appendix follows)

Read the path-specific appendix below to understand how to find the information you need.
