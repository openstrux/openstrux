## Context

OpenStrux defines 18 basic rods as atomic building blocks. Compliance rods (`pseudonymize`, `encrypt`, `validate`) handle individual privacy operations, but panel authors must manually compose them for each data flow — choosing the right fields, wiring `@dp`/`@access`, and hoping the combination satisfies their target privacy regulation. There is no mechanism for reusable, pre-certified compositions.

The gap is structural: privacy compliance requires coordinated behavior across multiple rods (validate schema → classify fields → pseudonymize PII → encrypt sensitive → guard access → audit), but the language only offers the individual pieces. Authors cannot express "this flow handles personal data under GDPR" as a single, certifiable unit.

The `DataSource` union tree pattern (`db.sql.postgres`, `stream.kafka`) already demonstrates how OpenStrux handles extensible specialization hierarchies. The same pattern applies naturally to privacy frameworks.

## Goals / Non-Goals

**Goals:**

- Introduce a **standard rod** category — certified composites that ship with core, positioned between basic rods (18 primitives) and hub rods (community extensions)
- Define `private-data` as the first standard rod, with a `PrivacyFramework` union config that determines which privacy law governs the flow
- Provide GDPR and BDSG (German) specializations that add jurisdiction-specific knots, defaults, and manifest entries
- Enable compile-time validation: if a panel declares `@privacy { framework: gdpr }`, every flow touching personal data must pass through a `private-data` rod with a compatible framework
- Produce machine-readable privacy records in the manifest (Art. 30 for GDPR, Section 70 for BDSG) that can be queried structurally, not heuristically

**Non-Goals:**

- Runtime privacy enforcement (this is a compile-time and manifest concern)
- Implementing every global privacy framework now (CCPA, LGPD, POPIA are future work — the union tree accommodates them)
- Replacing raw `pseudonymize`/`encrypt` rods — they remain valid for non-privacy use cases (e.g., encrypting API keys is not a privacy operation)
- Hub rod marketplace or registry — standard rods are spec-defined, core-implemented
- Data subject rights automation (right to erasure, portability) — future standard rods

## Decisions

### D1: Standard rods as a spec-level category

Standard rods are a new rod category defined in the spec, implemented in core, and certified by the project. They differ from basic rods (primitives that cannot be decomposed) and hub rods (community-contributed, trust varies).

**Key properties:**
- Defined in `specs/modules/rods/standard/` (spec repo)
- Implemented in `packages/generator/src/adapters/*/rods/standard/` (core repo)
- Composed of basic rods — the compiler expands a standard rod into its constituent basic rods during IR lowering
- Individually certifiable via `@cert` — the certification covers the composition, not just the parts
- Cannot be overridden or monkey-patched by panel authors

**Why not hub:** Standard rods carry project-level certification. Hub rods are community-contributed with adapter-specific trust. Privacy compliance must not depend on community trust chains.

**Why not new basic rods:** Basic rods are primitives — they do one thing. `private-data` orchestrates multiple operations. Adding it as a basic rod would break the "atomic" principle.

**Alternatives considered:**
- Macros/templates: Too fragile, no certification boundary, hard to validate
- Panel-level composition patterns: Not reusable across projects, no structural guarantee

### D2: PrivacyFramework as a union type tree

The privacy framework config follows the `DataSource` union pattern:

```
@type PrivacyFramework = union {
  gdpr: GdprFramework,
  ccpa: CcpaFramework,        // future
  lgpd: LgpdFramework         // future
}

@type GdprFramework = union {
  base: GdprBaseConfig,
  bdsg: BdsgConfig,
  lopdgdd: LopdgddConfig      // future — Spain
}
```

Type path narrowing: `private-data { framework: gdpr }` uses `GdprBaseConfig`, `private-data { framework: gdpr.bdsg }` uses `BdsgConfig` which inherits and extends `GdprBaseConfig`.

**Why union tree over rod inheritance:** OpenStrux already has union narrowing in the type system. Rod inheritance would require a new language mechanism (class-like extends) that conflicts with the graph-of-rods model. Using config-level specialization keeps the rod definition singular while the framework type tree handles variation.

**Why not decorator-only:** A decorator cannot change the rod's knot signature. BDSG adds employee-data-specific knots (`betriebsrat_consent`, `employee_category`) that GDPR does not have. These must be config knots, not decorator metadata.

### D3: Compilation by expansion

During IR lowering, a `private-data` rod expands into a sub-graph of basic rods:

```
private-data { framework: gdpr, fields: [...], ... }
  ↓ expands to:
  validate → pseudonymize → encrypt (if required) → guard
```

The exact sub-graph depends on the framework:
- **Base**: validate + pseudonymize + guard
- **GDPR**: validate + pseudonymize + encrypt (if `encryption_required: true`) + guard (with lawful basis check)
- **BDSG**: Same as GDPR + stricter pseudonymize defaults + additional guard predicates for employee data

The expansion is deterministic and locked — same framework config, same sub-graph. The lock file records the expansion hash.

**Why expand rather than emit as a single function:** Expansion preserves the basic rod graph, which means existing certification, audit, and adapter machinery works unchanged. A custom emit function would need to duplicate all compliance rod logic.

### D4: `@privacy` panel decorator

A new `@privacy` decorator at panel level declares the governing framework:

```
@panel intake {
  @privacy { framework: gdpr, dpa_ref: "DPA-2026-001" }
  ...
}
```

The validator enforces: if `@privacy` is declared, every data flow path from `receive`/`read-data` to `write-data`/`respond` must pass through at least one `private-data` rod with a compatible framework. A flow that skips `private-data` is a compile error.

**Why not `@dp` extension:** `@dp` is the data protection *identity* (controller, DPO, record). `@privacy` is the *regulatory framework* in force. They are orthogonal — you need both. A GDPR-governed panel still needs `@dp` for the controller identity.

### D5: Manifest privacy records

When a `private-data` rod with GDPR framework is compiled, the manifest gains a `privacyRecords` array entry:

```json
{
  "privacyRecords": [{
    "framework": "gdpr",
    "article30": {
      "controller": "from @dp",
      "purpose": "from rod cfg",
      "lawfulBasis": "from rod cfg",
      "dataSubjectCategories": ["from rod cfg"],
      "personalDataCategories": ["from field classification"],
      "recipients": ["from write-data targets"],
      "retention": "from rod cfg",
      "technicalMeasures": ["pseudonymization", "encryption"],
      "dpiaRef": "from rod cfg or null"
    }
  }]
}
```

This is the structural certification output that benchmarks can query — no heuristic scanning needed.

### D6: Field classification as a first-class type

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

The `private-data` rod requires `cfg.fields: Batch<FieldClassification>`. This drives which fields get pseudonymized (all `identifying` + `quasi_identifying`), which get encrypted (all `special_category` +), and what appears in the Art. 30 record.

**Why explicit classification over inference:** Inference is fragile and non-deterministic. A field named `name` might be a person's name or a product name. Explicit classification is the only approach compatible with certification.

### D7: `PrivateData<T>` generic wrapper type

The type system gains a generic wrapper that marks data as personal:

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

When `PrivateData<T>` appears in a panel's data flow, the compiler enforces that the flow passes through a `private-data` rod. This is the type-level complement to the `@privacy` panel decorator — the decorator says "this panel handles personal data," the type says "this specific data *is* personal data."

The `private-data` rod can accept both raw `T` (with explicit `cfg.fields`) and `PrivateData<T>` (where classifications are embedded in the type). When the input is `PrivateData<T>`, `cfg.fields` becomes optional — the rod reads classifications from the wrapper.

**Why a wrapper over marker interfaces:** A wrapper carries the classification *with the data* through the entire pipeline. A marker interface only tags the type — the classification would still need to be declared separately on each rod.

### D8: Standard personal data models

A set of pre-classified `@type` definitions ships with core in `specs/modules/types/standard/personal-data/`:

```
@type PersonName {
  given_name: string,         // identifying
  family_name: string,        // identifying
  middle_name: Optional<string>,  // identifying
  prefix: Optional<string>,  // quasi_identifying
  suffix: Optional<string>   // quasi_identifying
}

@type PersonalContact {
  email: Optional<string>,           // identifying
  phone: Optional<string>,           // identifying
  mobile: Optional<string>,          // identifying
  preferred_channel: Optional<string> // non-personal
}

@type PostalAddress {
  street: string,            // identifying (with other fields)
  city: string,              // quasi_identifying
  state: Optional<string>,  // quasi_identifying
  postal_code: string,       // quasi_identifying
  country: string            // quasi_identifying
}

@type UserIdentity {
  name: PersonName,
  contact: PersonalContact,
  date_of_birth: Optional<date>,  // identifying
  national_id: Optional<string>   // special_category (highly_sensitive)
}

@type EmployeeRecord {
  identity: UserIdentity,
  employee_id: string,            // identifying
  department: string,             // quasi_identifying
  position: string,               // quasi_identifying
  hire_date: date,                // quasi_identifying
  salary: Optional<number>,      // financial (special_category)
  manager_id: Optional<string>   // quasi_identifying
}

@type FinancialAccount {
  iban: Optional<string>,         // financial (identifying)
  bic: Optional<string>,         // financial (quasi_identifying)
  account_holder: string,         // identifying
  bank_name: Optional<string>    // quasi_identifying
}
```

Each type carries an implicit `FieldClassification` per field (expressed as comments above, enforced by the compiler via a `@classified` decorator on the type definition). When used with `PrivateData<PersonalContact>`, the `private-data` rod automatically knows which fields to pseudonymize, encrypt, and report in Art. 30 — zero manual classification needed.

**Why these six types:** They cover the most common personal data patterns across industries (contact, identity, address, employment, financial). They are composable — `UserIdentity` includes `PersonName` + `PersonalContact`, `EmployeeRecord` includes `UserIdentity`. The grant workflow use case directly maps: applicant identity ≈ `UserIdentity`.

**Why in core, not hub:** These are reference classifications, not opinions. "Email is identifying" is a GDPR Data Protection Authority consensus, not a design choice. Shipping them in core means they carry project-level certification and can be referenced in conformance fixtures.

**Extensibility:** Users can define their own types alongside standard ones. Custom types require explicit `FieldClassification` in the `private-data` rod config. Standard types work out of the box.

## Risks / Trade-offs

- **Verbosity increase**: `private-data` rods require more config than raw `pseudonymize`. Mitigated by context cascade — GDPR config inherits from `strux.context`, panels only declare the delta.
- **Expansion complexity**: The sub-graph expansion must be deterministic and produce the same lock hash. Risk of subtle ordering bugs. Mitigated by requiring golden conformance fixtures for each framework.
- **Framework coverage**: Shipping only GDPR + BDSG may signal incompleteness. Mitigated by the union tree design — adding CCPA later is additive, not breaking.
- **Spec scope creep**: Privacy law is vast. Risk of trying to encode too much. Mitigated by non-goals: we encode *structure* (what fields, what basis, what measures), not *legal interpretation*.
- **`@privacy` validator cost**: Checking all flow paths for `private-data` coverage requires graph traversal. For v0.5 this is acceptable — panels are small. May need optimization for large panels later.
