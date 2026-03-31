# Step 2 Context Appendix — Openstrux Path

You generated the backend using `.strux` source files. Use them as your primary source of truth for the Art. 30 record — they encode data flow semantics structurally.

## Where to find the information

### Processing purposes and lawful bases
Read the `@dp` blocks on your pipeline panels:
```
@dp { record: true, basis: "contract" }
```
The `basis` field is the GDPR lawful basis. The presence of `record: true` signals that this panel's data processing must be recorded.

### Personal data categories
Read your `@type` definitions. Fields annotated with classification metadata (sensitivity, category) are personal data. Also check for `@dp` field-level annotations if you used them.

### Technical measures
Read the compliance rods in your panels:
- `pseudonymize` → pseudonymization measure
- `encrypt` → encryption measure
- `guard` or `@access` → access control measure
Check `@access` blocks for `purpose` and `operation` — these define who can access what.

### Recipients
Derived from `@access` blocks: the `role` or `purpose` that has read access to a panel's data is a category of recipients.

### Retention
If not explicitly set in the `.strux` source, use domain knowledge: grant processing data is typically retained 7 years for accounting obligations.

## Files to read
- All `*.strux` files under `pipelines/` and `specs/`
- `strux.context` — controller and DPO are often defined here
- Manifest output at `.openstrux/build/manifest.json` if available (contains pre-computed `privacyRecords`)
