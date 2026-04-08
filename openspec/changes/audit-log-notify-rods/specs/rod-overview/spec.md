## MODIFIED Requirements

### Requirement: Rod taxonomy table includes audit-log and notify as standard rods

The rod overview SHALL add `audit-log` and `notify` to the standard rod table. The entry for `notify` in the convenience rod table SHALL be removed. The standard rod section SHALL document both rods with their category, expansion target, and a brief description.

**Updated standard rod table (full replacement of the Standard Rods section):**

| Rod | Category | Expands to | Description |
|---|---|---|---|
| `private-data` | Privacy | `validate → pseudonymize → [encrypt] → guard` | Privacy-safe personal data processing (GDPR/BDSG) |
| `audit-log` | Compliance | `write-data (append)` | Append-only compliance audit event emission |
| `notify` | Integration | `call` | Channel-abstracted notification dispatch |

**Updated convenience rod table (full replacement — notify removed):**

| Rod | Equivalent |
|---|---|
| `dedupe` | `group(by key) → aggregate(first)` |
| `sort` | `window(global) → aggregate(ordered_collect)` |
| `cache` | `store(get) → if miss: compute → store(put)` |
| `batch` | `window(count) → aggregate(collect)` |
| `debounce` | `window(session) → aggregate(last)` |

#### Scenario: audit-log appears in standard rod table

- **WHEN** the rod overview table is consulted
- **THEN** `audit-log` appears under Standard Rods with category "Compliance" and expansion target `write-data (append)`

#### Scenario: notify appears in standard rod table, not convenience table

- **WHEN** the rod overview table is consulted
- **THEN** `notify` appears under Standard Rods with category "Integration" and does NOT appear in the convenience rod table
