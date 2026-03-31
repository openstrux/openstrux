# Step 2 Context Appendix — Direct TypeScript Path

You generated the backend as TypeScript source files. You will need to read and trace through the code to produce the Art. 30 record.

## Where to find the information

### Processing purposes
Read the route handlers (`src/app/api/*/route.ts`) and service layer (`src/server/services/`). The purpose is the business operation these services perform.

### Personal data categories
Read the Prisma schema (`prisma/schema.prisma`) and TypeScript domain types (`src/domain/schemas/`). Fields that store names, emails, identifiers, or proposal content are personal data. Also check fixture files (`tests/fixtures/`) for concrete field examples.

### Lawful basis
Not encoded in TypeScript — derive from the business context:
- Intake (proposal submission): **Contract** — the applicant is applying under grant terms
- Eligibility (assessment): **Legitimate interest** — the foundation's interest in fair grant allocation

### Technical measures
Read the service implementations for:
- Pseudonymization: look for `BlindedPacket` creation, hash functions, or identity stripping
- Access control: look for role checks (`req.user.role`, middleware guards)
- Audit logging: look for `AuditEvent` writes

### Recipients
Derived from role-based access: which roles (`reviewer`, `admin`, etc.) can call which service functions.

### Retention
Not typically encoded in TypeScript — use domain knowledge: 7 years for grant accounting records.

## Files to read
- `prisma/schema.prisma` — all entities and fields
- `src/domain/schemas/index.ts` — TypeScript domain types
- `src/server/services/submissionService.ts` — intake data flow
- `src/server/services/eligibilityService.ts` — eligibility data flow
- `src/policies/index.ts` — privacy policy functions (blinding, pseudonymization)
