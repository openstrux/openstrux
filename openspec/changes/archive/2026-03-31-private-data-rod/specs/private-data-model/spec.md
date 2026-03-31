## ADDED Requirements

### Requirement: PrivateData generic wrapper type

The spec SHALL define a `PrivateData<T>` generic type that wraps any record with privacy metadata:

```
@type PrivateData<T> {
  data: T,
  classification: Batch<FieldClassification>,
  processing: ProcessingMetadata
}

@type ProcessingMetadata {
  purpose: string,
  basis: Optional<string>,
  retention: Optional<RetentionPolicy>,
  consent_ref: Optional<string>
}
```

`PrivateData<T>` is the type-level marker for personal data. It carries field classifications and processing metadata alongside the data itself.

#### Scenario: PrivateData wraps a custom type
- **WHEN** a panel declares `@type Applicant { name: string, email: string }` and uses `PrivateData<Applicant>` in a data flow
- **THEN** the compiler accepts the generic instantiation and the wrapped type carries its classification through the pipeline

#### Scenario: PrivateData wraps a standard model
- **WHEN** a panel uses `PrivateData<PersonalContact>` in a data flow
- **THEN** the compiler resolves `PersonalContact`'s built-in classifications and merges them into the wrapper

### Requirement: Compile-time enforcement for PrivateData

When `PrivateData<T>` appears in a panel's data flow, the compiler SHALL enforce that the flow passes through at least one `private-data` rod. A `PrivateData<T>` value that reaches a `write-data` or `respond` rod without passing through `private-data` is a compile error.

#### Scenario: PrivateData without private-data rod is an error
- **WHEN** a panel has `PrivateData<UserIdentity>` flowing from `receive` directly to `write-data` with no `private-data` rod in between
- **THEN** the compiler emits a diagnostic error: `PrivateData<UserIdentity>` must pass through a `private-data` rod before reaching a sink

#### Scenario: PrivateData through private-data rod is accepted
- **WHEN** a panel has `PrivateData<UserIdentity>` flowing through `receive → private-data → write-data`
- **THEN** the compiler accepts the flow with no privacy-related diagnostics

### Requirement: private-data rod auto-reads PrivateData classifications

When the input to a `private-data` rod is typed as `PrivateData<T>`, the rod SHALL derive its field classifications from the wrapper's `classification` field. The `cfg.fields` knot becomes optional — if omitted, the rod uses the embedded classifications.

#### Scenario: cfg.fields optional with PrivateData input
- **WHEN** `pd = private-data { framework: gdpr, purpose: "intake" }` receives `PrivateData<PersonalContact>` as input
- **AND** `cfg.fields` is not specified
- **THEN** the rod uses `PersonalContact`'s built-in classifications (email → identifying, phone → identifying)

#### Scenario: cfg.fields overrides PrivateData classifications
- **WHEN** `pd = private-data { framework: gdpr, fields: [...], purpose: "intake" }` receives `PrivateData<PersonalContact>` as input
- **AND** `cfg.fields` is explicitly specified
- **THEN** the rod uses the explicit classifications, ignoring the embedded ones

### Requirement: ProcessingMetadata propagation

When `PrivateData<T>` carries `ProcessingMetadata`, the `private-data` rod SHALL use it as defaults for `purpose`, `retention`, and framework-specific config. Explicit rod config overrides embedded metadata.

#### Scenario: Purpose from ProcessingMetadata
- **WHEN** `PrivateData<T>` has `processing: { purpose: "grant application" }` and the `private-data` rod does not specify `purpose`
- **THEN** the rod uses `"grant application"` as the processing purpose

#### Scenario: Rod config overrides ProcessingMetadata
- **WHEN** `PrivateData<T>` has `processing: { purpose: "grant application" }` and the rod specifies `purpose: "eligibility check"`
- **THEN** the rod uses `"eligibility check"`, overriding the embedded metadata
