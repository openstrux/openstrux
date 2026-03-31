## ADDED Requirements

### Requirement: PrivacyFramework union type

The spec SHALL define a `PrivacyFramework` union type following the DataSource union tree pattern:

```
@type PrivacyFramework = union {
  gdpr: GdprFramework,
  ccpa: CcpaFramework,
  lgpd: LgpdFramework
}
```

Only `gdpr` is normative in this version. `ccpa` and `lgpd` are reserved identifiers for future specialization.

#### Scenario: PrivacyFramework resolves via type path
- **WHEN** a rod config uses `framework: gdpr`
- **THEN** the type system resolves `PrivacyFramework.gdpr` to `GdprFramework`

#### Scenario: Unknown framework is a compile error
- **WHEN** a rod config uses `framework: hipaa`
- **THEN** the compiler emits a diagnostic error: `hipaa` is not a variant of `PrivacyFramework`

### Requirement: GdprFramework union type

The spec SHALL define `GdprFramework` as a union with jurisdiction-specific variants:

```
@type GdprFramework = union {
  base: GdprBaseConfig,
  bdsg: BdsgConfig,
  lopdgdd: LopdgddConfig
}
```

`gdpr` (without suffix) resolves to `GdprBaseConfig`. `gdpr.bdsg` resolves to `BdsgConfig`. Only `base` and `bdsg` are normative in this version; `lopdgdd` is reserved.

#### Scenario: gdpr resolves to base config
- **WHEN** a rod config uses `framework: gdpr`
- **THEN** the type system resolves to `GdprBaseConfig`

#### Scenario: gdpr.bdsg resolves to BDSG config
- **WHEN** a rod config uses `framework: gdpr.bdsg`
- **THEN** the type system resolves to `BdsgConfig`, which includes all `GdprBaseConfig` fields plus BDSG-specific extensions

### Requirement: FieldClassification type

The spec SHALL define:

```
@type FieldClassification {
  field: string,
  category: DataCategory,
  sensitivity: Sensitivity
}

@type DataCategory = enum {
  identifying, quasi_identifying, sensitive_special,
  financial, health, biometric, genetic, political,
  religious, trade_union, sexual_orientation, criminal
}

@type Sensitivity = enum { standard, special_category, highly_sensitive }
```

#### Scenario: Field classification drives pseudonymization scope
- **WHEN** a `private-data` rod has `fields: [{ field: "email", category: identifying, sensitivity: standard }]`
- **THEN** the expanded `pseudonymize` rod includes `email` in its field mask

#### Scenario: Special category triggers encryption default
- **WHEN** a `private-data` rod has `fields: [{ field: "health_status", category: health, sensitivity: special_category }]`
- **AND** `encryption_required` is not explicitly set
- **THEN** the compiler defaults `encryption_required` to `true` for GDPR and BDSG frameworks

### Requirement: RetentionPolicy type

The spec SHALL define:

```
@type RetentionPolicy {
  duration: string,
  basis: RetentionBasis,
  review_cycle: Optional<string>
}

@type RetentionBasis = enum {
  legal_obligation, contract_duration, consent_withdrawal,
  legitimate_interest_review, statutory_period
}
```

#### Scenario: Retention appears in manifest
- **WHEN** a `private-data` rod specifies `retention: { duration: "5y", basis: legal_obligation }`
- **THEN** the manifest's privacy record includes the retention duration and basis

### Requirement: GdprBaseConfig type

The spec SHALL define:

```
@type GdprBaseConfig {
  lawful_basis: GdprBasis,
  data_subject_categories: Batch<string>,
  dpia_ref: Optional<string>,
  cross_border_transfer: Optional<CrossBorderTransfer>
}

@type GdprBasis = enum {
  consent, contract, legal_obligation, vital_interests,
  public_task, legitimate_interest
}

@type CrossBorderTransfer {
  mechanism: TransferMechanism,
  destination_countries: Batch<string>
}

@type TransferMechanism = enum {
  adequacy_decision, standard_contractual_clauses, binding_corporate_rules, explicit_consent
}
```

#### Scenario: Lawful basis is required for GDPR
- **WHEN** a `private-data` rod uses `framework: gdpr` without `lawful_basis`
- **THEN** the compiler emits a diagnostic error: `lawful_basis` is required for GDPR framework

#### Scenario: DPIA reference is optional
- **WHEN** a `private-data` rod uses `framework: gdpr` with `dpia_ref: "DPIA-2026-001"`
- **THEN** the manifest includes the DPIA reference in the privacy record

### Requirement: BdsgConfig type

The spec SHALL define:

```
@type BdsgConfig {
  lawful_basis: GdprBasis,
  data_subject_categories: Batch<string>,
  dpia_ref: Optional<string>,
  cross_border_transfer: Optional<CrossBorderTransfer>,
  employee_data: bool,
  betriebsrat_consent: Optional<string>,
  employee_category: Optional<EmployeeCategory>
}

@type EmployeeCategory = enum {
  applicant, employee, former_employee, contractor, trainee
}
```

`BdsgConfig` includes all `GdprBaseConfig` fields plus BDSG-specific extensions.

#### Scenario: BdsgConfig accepts GDPR fields
- **WHEN** a `private-data` rod uses `framework: gdpr.bdsg` with `lawful_basis: contract`
- **THEN** the compiler accepts it — `lawful_basis` is inherited from GDPR

#### Scenario: Employee data triggers stricter defaults
- **WHEN** a `private-data` rod uses `framework: gdpr.bdsg` with `employee_data: true`
- **THEN** the compiler defaults all `identifying` and `quasi_identifying` fields to `sensitivity: special_category` and enables encryption
