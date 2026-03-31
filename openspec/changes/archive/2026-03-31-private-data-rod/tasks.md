## 1. Type definitions (openstrux-spec)

- [x] 1.1 Define `FieldClassification`, `DataCategory`, `Sensitivity` types in `specs/core/type-system.md`
- [x] 1.2 Define `RetentionPolicy`, `RetentionBasis` types in `specs/core/type-system.md`
- [x] 1.3 Define `PrivacyFramework` union type tree in `specs/modules/privacy-framework.strux`
- [x] 1.4 Define `GdprBaseConfig`, `GdprBasis`, `CrossBorderTransfer`, `TransferMechanism` types
- [x] 1.5 Define `BdsgConfig`, `EmployeeCategory` types
- [x] 1.6 Add `.strux` conformance fixtures for all new types (`conformance/valid/`)

## 2. Standard rod category (openstrux-spec)

- [x] 2.1 Add "Standard Rods" section to `specs/modules/rods/overview.md` documenting the category
- [x] 2.2 Create `specs/modules/rods/standard/` directory with README
- [x] 2.3 Define the standard rod expansion model in `specs/core/semantics.md` (IR lowering rules)

## 3. private-data rod definition (openstrux-spec)

- [x] 3.1 Write `specs/modules/rods/standard/private-data.strux` — knot signature (cfg, arg, in, out, err)
- [x] 3.2 Document `private-data` in overview section with knot table and compliance mappings
- [x] 3.3 Define expansion rules: base → validate + pseudonymize + guard; with encryption → validate + pseudonymize + encrypt + guard
- [x] 3.4 Add valid conformance fixtures: `conformance/valid/private-data-gdpr.strux`, `conformance/valid/private-data-bdsg.strux`
- [x] 3.5 Add invalid conformance fixtures: `conformance/invalid/private-data-missing-fields.strux`, `conformance/invalid/private-data-bad-basis.strux`

## 4. @privacy decorator (openstrux-spec)

- [x] 4.1 Add `@privacy` to decorator list in `specs/core/grammar.md`
- [x] 4.2 Document `@privacy` syntax and inheritance in `specs/core/config-inheritance.md`
- [x] 4.3 Define `@privacy` validation rule: all source→sink paths must include a `private-data` rod
- [x] 4.4 Add conformance fixture: `conformance/invalid/privacy-bypass.strux` (path without private-data rod)

## 5. GDPR specialization (openstrux-spec)

- [x] 5.1 Document Art. 5 compile-time enforcement rules (purpose, retention required)
- [x] 5.2 Document Art. 25 defaults (auto-pseudonymize identifying/quasi-identifying fields)
- [x] 5.3 Document Art. 6 lawful basis validation and Art. 9 special category restrictions
- [x] 5.4 Document Art. 30 manifest record schema and generation rules
- [x] 5.5 Add golden conformance fixture: `conformance/golden/private-data-gdpr-manifest.json`

## 6. BDSG specialization (openstrux-spec)

- [x] 6.1 Document Section 26 employee data elevation rules
- [x] 6.2 Document Betriebsrat consent tracking and validation
- [x] 6.3 Document stricter pseudonymization defaults (HMAC, key required)
- [x] 6.4 Document BDSG manifest extensions (bdsgSection26, employeeCategory, betriebsratConsent)
- [x] 6.5 Add golden conformance fixture: `conformance/golden/private-data-bdsg-manifest.json`

## 7. Manifest extension (openstrux-spec)

- [x] 7.1 Add `privacyRecords` field to manifest schema in `specs/modules/manifest.md`
- [x] 7.2 Define Art. 30 record JSON structure
- [x] 7.3 Define BDSG extension fields on top of Art. 30
- [x] 7.4 Verify determinism: privacy records must be stable across compilations

## 8. PrivateData generic wrapper type (openstrux-spec)

- [x] 8.1 Define `PrivateData<T>` and `ProcessingMetadata` types in `specs/core/type-system.md`
- [x] 8.2 Define compile-time rule: `PrivateData<T>` must flow through `private-data` rod before reaching a sink
- [x] 8.3 Define auto-read behavior: `private-data` rod derives `cfg.fields` from `PrivateData<T>.classification` when not explicit
- [x] 8.4 Add conformance fixtures: `conformance/valid/private-data-wrapper.strux`, `conformance/invalid/private-data-wrapper-bypass.strux`

## 9. Standard personal data models (openstrux-spec)

- [x] 9.1 Create `specs/modules/types/standard/personal-data/` directory
- [x] 9.2 Define `PersonName` type with field classifications in `.strux`
- [x] 9.3 Define `PersonalContact` type with field classifications in `.strux`
- [x] 9.4 Define `PostalAddress` type with field classifications in `.strux`
- [x] 9.5 Define `UserIdentity` composite type (PersonName + PersonalContact + dob + national_id)
- [x] 9.6 Define `EmployeeRecord` composite type (UserIdentity + employment fields)
- [x] 9.7 Define `FinancialAccount` type with field classifications
- [x] 9.8 Define sealed type mechanism — standard types cannot be redefined, only composed
- [x] 9.9 Add conformance fixtures for each standard type used with `private-data` rod
- [x] 9.10 Document classification propagation through nested types

## 10. Syntax reference update (openstrux-spec + openstrux)

- [x] 10.1 Update `specs/core/syntax-reference.md` to include `private-data` rod, `@privacy` decorator, `PrivateData<T>`, and standard data models
- [x] 10.2 Update `openstrux/docs/` syntax reference copy with standard rod and data model sections

## 11. Core implementation (openstrux-core — separate change)

// Tasks 11.x are in openstrux-core (separate change). Tracking here for reference only.
- [x] 11.1 Add `private-data` to parser rod recognition (not just `BasicRodType`)
- [x] 11.2 Add `PrivacyFramework` types and `PrivateData<T>` to AST package
- [x] 11.3 Register standard data models (PersonName, PersonalContact, etc.) in the type resolver
- [x] 11.4 Implement IR lowering: `private-data` → basic rod sub-graph expansion
- [x] 11.5 Implement `@privacy` validator: check all source→sink paths
- [x] 11.6 Implement `PrivateData<T>` enforcement: type-level check for private-data rod coverage
- [x] 11.7 Implement manifest `privacyRecords` emitter
- [x] 11.8 Add `private-data` rod emitters for Next.js adapter (`packages/generator/src/adapters/nextjs/rods/standard/`)
- [x] 11.9 Add unit tests for expansion, validation, manifest generation, and standard type resolution
