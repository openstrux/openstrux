## MODIFIED Requirements

### Requirement: GDPR special category data handling

When any field in `fields` has `sensitivity: special_category` (Art. 9 data), the `private-data` rod with GDPR framework SHALL:
- Default `encryption_required` to `true`
- Require `lawful_basis` to be one of: `consent`, `legal_obligation`, `vital_interests` (the Art. 9(2) permitted bases)
- Include the field categories in the Art. 30 record under a `specialCategories` sub-field

#### Scenario: Special category forces encryption
- **WHEN** `fields` includes `{ field: "ethnicity", category: political, sensitivity: special_category }`
- **AND** `encryption_required` is not set
- **THEN** the compiler defaults `encryption_required` to `true`

#### Scenario: Special category restricts lawful basis
- **WHEN** `fields` includes a `special_category` field and `lawful_basis: legitimate_interest`
- **THEN** the compiler emits a diagnostic error: `legitimate_interest` is not a valid basis for special category data under Art. 9

#### Scenario: Special category with consent basis — no error
- **WHEN** `fields` includes a `special_category` field and `lawful_basis: consent`
- **THEN** the compiler does NOT emit `E_GDPR_INVALID_BASIS_SPECIAL_CATEGORY`
