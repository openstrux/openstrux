## Capability: `standard-data-models`

### Purpose

Define pre-classified `@type` definitions for common personal data patterns that ship with core — `PersonName`, `PersonalContact`, `PostalAddress`, `UserIdentity`, `EmployeeRecord`, `FinancialAccount` — and their composability rules.

### Requirements

### Requirement: Standard personal data models shipped with core

The spec SHALL define a set of pre-classified `@type` definitions for common personal data patterns. These types ship with core at `specs/modules/types/standard/personal-data/` and are available to any `.strux` project without explicit import.

Each type's fields carry built-in `FieldClassification` (category + sensitivity) so that the `private-data` rod can derive pseudonymization scope, encryption requirements, and Art. 30 categories automatically.

#### Scenario: Standard type available without import
- **WHEN** a `.strux` file references `PersonalContact` without an explicit import
- **THEN** the compiler resolves it from the standard type library

#### Scenario: Standard type carries field classifications
- **WHEN** `PersonalContact` is used with a `private-data` rod
- **THEN** the rod knows that `email` is `identifying/standard` and `phone` is `identifying/standard` without the author specifying `cfg.fields`

### Requirement: PersonName type

The spec SHALL define:

```
@type PersonName {
  given_name: string,          // identifying, standard
  family_name: string,         // identifying, standard
  middle_name: Optional<string>,   // identifying, standard
  prefix: Optional<string>,   // quasi_identifying, standard
  suffix: Optional<string>    // quasi_identifying, standard
}
```

#### Scenario: PersonName fields classified correctly
- **WHEN** `PersonName` is used with a `private-data` rod
- **THEN** `given_name`, `family_name`, `middle_name` are pseudonymized (identifying), `prefix` and `suffix` are pseudonymized only under BDSG (quasi_identifying)

### Requirement: PersonalContact type

The spec SHALL define:

```
@type PersonalContact {
  email: Optional<string>,            // identifying, standard
  phone: Optional<string>,            // identifying, standard
  mobile: Optional<string>,           // identifying, standard
  preferred_channel: Optional<string>  // non-personal
}
```

#### Scenario: PersonalContact email and phone pseudonymized
- **WHEN** `PersonalContact` is used with `private-data { framework: gdpr }`
- **THEN** `email`, `phone`, `mobile` are included in the pseudonymize mask; `preferred_channel` is not

### Requirement: PostalAddress type

The spec SHALL define:

```
@type PostalAddress {
  street: string,             // identifying, standard (with combination)
  city: string,               // quasi_identifying, standard
  state: Optional<string>,   // quasi_identifying, standard
  postal_code: string,        // quasi_identifying, standard
  country: string             // quasi_identifying, standard
}
```

#### Scenario: PostalAddress quasi-identifying fields handled per framework
- **WHEN** `PostalAddress` is used with `private-data { framework: gdpr }`
- **THEN** `street` is pseudonymized (identifying); `city`, `state`, `postal_code`, `country` are pseudonymized only if the framework or rod config requires quasi-identifying coverage
- **WHEN** `PostalAddress` is used with `private-data { framework: gdpr.bdsg }`
- **THEN** all fields including quasi-identifying are pseudonymized (BDSG stricter defaults)

### Requirement: UserIdentity composite type

The spec SHALL define:

```
@type UserIdentity {
  name: PersonName,
  contact: PersonalContact,
  date_of_birth: Optional<date>,   // identifying, standard
  national_id: Optional<string>    // identifying, highly_sensitive
}
```

`UserIdentity` composes `PersonName` and `PersonalContact`. Field classifications are inherited from the composed types plus additional fields.

#### Scenario: UserIdentity inherits nested classifications
- **WHEN** `UserIdentity` is used with a `private-data` rod
- **THEN** the rod sees all classifications from `PersonName` (given_name, family_name, ...) and `PersonalContact` (email, phone, ...) plus `date_of_birth` and `national_id`

#### Scenario: national_id triggers encryption
- **WHEN** `UserIdentity` is used with `private-data { framework: gdpr }`
- **THEN** `national_id` (highly_sensitive) causes `encryption_required` to default to `true`

### Requirement: EmployeeRecord type

The spec SHALL define:

```
@type EmployeeRecord {
  identity: UserIdentity,
  employee_id: string,             // identifying, standard
  department: string,              // quasi_identifying, standard
  position: string,                // quasi_identifying, standard
  hire_date: date,                 // quasi_identifying, standard
  salary: Optional<number>,       // financial, special_category
  manager_id: Optional<string>    // quasi_identifying, standard
}
```

#### Scenario: EmployeeRecord with BDSG elevates all fields
- **WHEN** `EmployeeRecord` is used with `private-data { framework: gdpr.bdsg, employee_data: true }`
- **THEN** all identifying and quasi-identifying fields are treated as special_category per BDSG Section 26

#### Scenario: salary triggers special category handling
- **WHEN** `EmployeeRecord` is used with `private-data { framework: gdpr }`
- **THEN** `salary` (financial, special_category) triggers encryption and restricts lawful basis options per Art. 9

### Requirement: FinancialAccount type

The spec SHALL define:

```
@type FinancialAccount {
  iban: Optional<string>,          // financial, identifying
  bic: Optional<string>,          // financial, quasi_identifying
  account_holder: string,          // identifying, standard
  bank_name: Optional<string>     // quasi_identifying, standard
}
```

#### Scenario: FinancialAccount iban pseudonymized and encrypted
- **WHEN** `FinancialAccount` is used with `private-data { framework: gdpr }`
- **THEN** `iban` is pseudonymized (identifying) and `FinancialAccount` fields classified as `financial` appear in the Art. 30 record under financial data categories

### Requirement: Composability of standard types

Standard types SHALL be composable. A custom `@type` can include standard types as fields, and the field classifications propagate through nesting.

#### Scenario: Custom type includes standard types
- **WHEN** a user defines `@type GrantApplicant { identity: UserIdentity, organization: string, proposal_ref: string }`
- **THEN** the `private-data` rod sees `UserIdentity`'s full classification tree (name, contact, dob, national_id) plus the custom fields which require explicit classification

#### Scenario: Mixed classified and unclassified fields
- **WHEN** a custom type includes `UserIdentity` (classified) and `proposal_ref: string` (unclassified)
- **THEN** the rod auto-classifies `UserIdentity` fields from the standard model and requires explicit `cfg.fields` entries only for `proposal_ref` if it contains personal data

### Requirement: Standard types are extensible, not final

Authors SHALL be able to extend standard types by composition (including them as fields in custom types). Standard types themselves are sealed — they cannot be modified or have fields added. Extensions are always new custom types that compose standard ones.

#### Scenario: Cannot modify PersonalContact
- **WHEN** a `.strux` file attempts to redefine `PersonalContact` with additional fields
- **THEN** the compiler emits a diagnostic error: `PersonalContact` is a sealed standard type

#### Scenario: Can compose PersonalContact into a custom type
- **WHEN** a `.strux` file defines `@type ExtendedContact { base: PersonalContact, linkedin: Optional<string> }`
- **THEN** the compiler accepts it — `linkedin` requires explicit classification if used with `private-data`
