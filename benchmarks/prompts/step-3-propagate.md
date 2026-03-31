# Step 3 — Change Propagation and Re-certification

The grant workflow system has a new requirement: grant applicants must optionally provide a phone number for follow-up contact.

## Your task

1. Add `phone_number` as an **optional** personal data field to the applicant identity record:
   - Data category: **identifying** (sensitivity: high)
   - It must be included in the **blinded packet pseudonymization** — reviewers must not see it
   - Store it on the applicant identity entity alongside name, email, and organization

2. Update the Art. 30 Record of Processing Activities to reflect the new field:
   - Add `"Phone number"` to `personalDataCategories` for the intake processing activity
   - Update the `technicalMeasures` entry for pseudonymization to mention phone number

3. Verify no regressions: run `pnpm test:unit` and confirm all tests still pass.

## Hard constraints

- Do NOT modify any file under `tests/`
- All TypeScript must compile (strict mode)
- The `phone_number` field must be optional in both the data model and the route handler input

## Output

After making the changes, provide:
- The updated Art. 30 JSON (full record, not just the diff)
- A summary of every file you modified and why
