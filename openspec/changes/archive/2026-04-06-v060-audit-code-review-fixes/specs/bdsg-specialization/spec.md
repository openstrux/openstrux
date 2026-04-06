## MODIFIED Requirements

### Requirement: BDSG Section 26 employee data rules

When `framework: gdpr.bdsg` is used with `employee_data: true`, the `private-data` rod SHALL apply stricter processing rules per BDSG Section 26:

- All `identifying` and `quasi_identifying` fields are treated as `sensitivity: special_category` (elevated protection for employment context)
- `encryption_required` defaults to `true` regardless of field sensitivity
- The `employee_category` config knot becomes required

#### Scenario: Employee data elevates sensitivity
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and a field `{ field: "salary", category: financial, sensitivity: standard }`
- **THEN** the compiler treats the field as `special_category` for pseudonymization and encryption purposes

#### Scenario: Employee category required for employee data
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and no `employee_category`
- **THEN** the compiler emits a diagnostic error: `employee_category` is required when `employee_data` is true (BDSG Section 26)

#### Scenario: Employee category required — diagnostic code
- **WHEN** `framework: gdpr.bdsg` with `employee_data: true` and no `employee_category`
- **THEN** the diagnostic code SHALL be `E_BDSG_EMPLOYEE_CATEGORY` with severity `error`
