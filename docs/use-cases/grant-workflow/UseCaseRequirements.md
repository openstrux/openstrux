# Openstrux MVP Requirements
Version: 0.1-draft  
Date: 2026-03-18

## 1. Purpose

This document defines the functional and technical requirements for the MVP use case: a privacy-first, generated review workflow system inspired by the NLnet NGI Zero Commons Fund submission and review process. [page:1][page:2]

The objective is not to replace reviewers or automate grant decisions. The objective is to demonstrate that a compact structured source can generate a secure back end, lightweight predefined UI, strong access controls, blinded review workflow, auditability, and benchmarkable implementation outputs with low token cost and fast execution. [file:14][file:12][file:13]

The MVP must support two execution paths over the same initialized repository and same task set:  
1. direct prompt-driven generation without Openstrux;  
2. prompt-driven generation with an initial Openstrux layer added.  
Both paths must be comparable using the same benchmark inputs, expected outputs, and measurement rules. [file:13][file:1]

## 2. Scope

### 2.1 In scope

- Submission intake with lightweight predefined UI.
- Separation of identity data and evaluable proposal data.
- Blinded reviewer packet generation.
- Simple first-stage eligibility gate using explicit boolean/numeric inputs only.
- Reviewer confidentiality and conflict-of-interest acknowledgement before access.
- Manual scoring entry by reviewers.
- Clarification and revision workflow.
- Independent validation support.
- Audit trail for workflow, access, and policy decisions.
- Data retention and deletion/anonymisation lifecycle.
- Starter repository with all solutions initialized, configured, and prompt/spec assets predefined.
- Side-by-side generation paths for baseline vs Openstrux-assisted execution.
- Benchmark-ready structure for later comparison of functionality, token use, and execution speed. [page:1][page:2][file:12][file:13][file:1]

### 2.2 Out of scope

- Automated proposal reading or semantic evaluation.
- English-language detection or proposal-content classification.
- Automated project selection or final funding recommendation.
- Grant execution, milestone payment, or post-award grant administration.
- Full production-grade legal compliance package.
- Multi-tenant enterprise scaling beyond MVP needs. [page:1][page:2]

## 3. Design principles

- Structure first, code second. Generated code is a derived artifact, not the primary source of truth. [file:14][file:12]
- Trust built in, not bolted on. Access, audit, and retention behavior must be encoded by design. [file:14][file:12]
- Human judgment remains human. The workflow supports reviewers; it does not replace them. [page:1][page:2]
- Simplicity first. Prefer explicit typed inputs and deterministic rules over hidden heuristics. [file:12][file:13]
- Benchmarkability first. The same prompts, same repository, same target slices, and same validation method must be used across both execution paths. [file:13]

## 4. Actors

- Applicant: creates and submits proposals, responds to clarification requests, and resubmits revised versions.
- Review administrator: manages call configuration, proposal intake state, reviewer assignment, and identity-controlled operations.
- Reviewer: accesses blinded review packets, acknowledges confidentiality and conflict rules, and enters manual scores/comments.
- Independent validator: validates shortlisted proposals on eligibility and process grounds without acting as the primary reviewer.
- System auditor: reads audit trails and retention/deletion evidence without modifying business data. [page:1][page:2]

## 5. Core entities

- Call
- Submission window
- Proposal dossier
- Proposal version
- Applicant identity record
- Applicant alias/public name
- Blinded review packet
- Eligibility check result
- Reviewer assignment
- Reviewer confidentiality acknowledgement
- Reviewer conflict-of-interest declaration
- Manual scorecard
- Clarification request
- Clarification response
- Validation record
- Audit event
- Retention rule
- Deletion/anonymisation record [page:1][page:2][file:12]

## 6. Functional requirements

### 6.1 Phase 0 — Canonical model

#### FR-P0-001
The system must define a typed canonical model for identity data, evaluable proposal data, workflow states, access roles, policy checks, review artifacts, and audit events.

#### FR-P0-002
The system must separate identity/legal/contact data from evaluable proposal content at the data-model level.

#### FR-P0-003
The system must define workflow states at minimum for:
- draft
- submitted
- eligibility_failed
- eligible
- under_review
- clarification_requested
- revised
- validation_pending
- selected
- rejected [page:1][page:2]

#### FR-P0-004
The system must define role-bound visibility rules so reviewers cannot access identity fields by default.

#### FR-P0-005
The system must define all policy checks as explicit machine-readable rules, not hidden application behavior. [file:12][file:1]

### 6.2 Phase 1 — Intake and data separation

#### FR-P1-001
The system must allow creation of a proposal dossier through a lightweight predefined UI.

#### FR-P1-002
The system must capture proposal data and applicant identity data in separate storage structures.

#### FR-P1-003
The system must allow pseudonymous submission before any award-related identity verification step, consistent with the selected use case assumptions. [page:2]

#### FR-P1-004
The system must support multiple proposal versions for the same submission.

#### FR-P1-005
The system must mark one proposal version as the effective review version.

#### FR-P1-006
The system must support submission metadata including:
- selected call
- submission timestamp
- applicant alias
- requested budget
- proposal title
- abstract
- structured tags
- attachments metadata

#### FR-P1-007
The system must generate a blinded review packet automatically from the effective proposal version.

#### FR-P1-008
The blinded review packet must exclude identity and business-identifying fields unless a specific policy explicitly allows controlled reveal.

#### FR-P1-009
The system must preserve traceability between blinded packet and original submission without exposing that link to reviewers. [page:1][page:2][web:174][web:180]

### 6.3 Phase 2 — Eligibility gate

#### FR-P2-001
The system must present first-stage eligibility criteria as explicit boolean, enumerated, or numeric inputs only.

#### FR-P2-002
The system must not perform semantic reading of free-text proposal content for eligibility decisions.

#### FR-P2-003
The system must support the following minimum eligibility inputs:
- submitted_in_english: boolean
- aligned_with_call: boolean
- primary_objective_is_rd: boolean
- meets_european_dimension: enum(true,false,not_applicable)
- requested_budget_k_eur: number
- first_time_applicant_in_programme: boolean [page:1]

#### FR-P2-004
The system must allow call-specific activation or deactivation of individual eligibility checks.

#### FR-P2-005
The system must compute eligibility status using explicit rule logic over active checks.

#### FR-P2-006
The system must return machine-readable failure reasons for each failed hard criterion.

#### FR-P2-007
The system must prevent reviewer assignment when eligibility status is ineligible.

#### FR-P2-008
The system must record the exact input values and active rule set used for the eligibility decision. [page:1][file:12]

### 6.4 Phase 3 — Review access and manual scoring

#### FR-P3-001
The system must require a reviewer confidentiality acknowledgement before any proposal access.

#### FR-P3-002
The system must require a reviewer conflict-of-interest declaration before any proposal access.

#### FR-P3-003
The system must block access when the reviewer has not completed required acknowledgements.

#### FR-P3-004
The system must assign blinded packets to reviewers without exposing identity or non-required metadata.

#### FR-P3-005
The system must support manual score entry for the following dimensions:
- technical excellence / feasibility
- relevance / impact / strategic potential
- cost effectiveness / value for money [page:1]

#### FR-P3-006
The system must support reviewer comments and structured concern flags.

#### FR-P3-007
The system must support multiple independent reviewer assignments for the same proposal.

#### FR-P3-008
The system must log assignment, access, acknowledgement, declaration, and score submission events. [page:1][page:2][web:175][web:178][web:176]

### 6.5 Phase 4 — Clarification and revision

#### FR-P4-001
The system must allow reviewers or review administrators to issue clarification requests linked to proposal sections or review concerns.

#### FR-P4-002
The system must allow applicants to respond to clarification requests and submit revised proposal versions.

#### FR-P4-003
The system must preserve all historical versions of the proposal dossier.

#### FR-P4-004
The system must provide version comparison between original and revised proposals.

#### FR-P4-005
The system must preserve a traceable relationship between clarification requests, applicant responses, and revised submission versions. [page:1][page:2]

### 6.6 Phase 5 — Independent validation

#### FR-P5-001
The system must support assignment of shortlisted proposals to independent validators.

#### FR-P5-002
The system must allow validators to record structured validation outcomes.

#### FR-P5-003
The system must keep validator outcomes separate from reviewer scorecards.

#### FR-P5-004
The system must support at least two independent validation records per shortlisted proposal.

#### FR-P5-005
The system must log all validation actions and preserve decision traceability. [page:1]

### 6.7 Phase 6 — Audit and lifecycle controls

#### FR-P6-001
The system must record audit events for workflow transitions, access attempts, role changes, packet generation, manual scores, clarifications, validations, exports, and retention actions.

#### FR-P6-002
The system must support retention rules that distinguish identity data, proposal data, review data, and audit data.

#### FR-P6-003
The system must support deletion or irreversible anonymisation of personal data once it is no longer necessary for the purpose for which it was collected.

#### FR-P6-004
The system must record deletion/anonymisation proof events.

#### FR-P6-005
The system must support export of audit logs and retention evidence for inspection. [web:167][web:177][web:176]

## 7. Non-functional requirements

### 7.1 Security and privacy

- Identity data and evaluable proposal data must be logically separated by design.
- Access must follow least-privilege and purpose-bound rules.
- Reviewer-facing views must be blinded by default.
- Personal data must have explicit retention handling.
- Audit logs must exist for all security-relevant actions. [web:174][web:179][web:176][file:10]

### 7.2 Determinism

- The same source model and same lock state should produce repeatable generated artifacts.
- Generated outputs should preserve traceability back to their structured source.
- Policy evaluation should be deterministic for the same input set. [file:12][file:13][file:14]

### 7.3 Performance

- The MVP must prioritize fast local execution and simple deployment.
- The selected stack must support acceptable response times for CRUD, review workflows, and audit-heavy operations.
- The benchmark later must record build time and execution time for both generation paths. [file:13][file:12]

### 7.4 Simplicity

- The first implementation must minimize moving parts.
- Front-end customization must remain light.
- Complex automation, NLP, and post-award features are intentionally deferred. [page:1][page:2]

## 8. Technical requirements

### 8.1 Stack

The MVP technical stack is:
- TypeScript
- Next.js for UI and server-side application logic
- Prisma as ORM / schema / migration layer
- PostgreSQL as primary database
- Keycloak for identity and access management
- Debian Linux as deployment OS
- Podman for container runtime [web:252][web:281][web:197][web:208][web:216][web:215]

### 8.2 Stack constraints

- Only standard open-source components may be used in the MVP stack. [web:252][web:237][web:197][web:215]
- The application must be self-hostable without dependence on proprietary SaaS runtime services. [web:252][web:216][web:215]
- The architecture must support later extraction of a more explicit Openstrux-generated layer without changing the functional scope. [file:14][file:1]

### 8.3 Runtime model

- The Next.js application must provide both the lightweight UI and the MVP server-side endpoints.
- PostgreSQL must store the canonical business data.
- Keycloak must handle authentication and role/claim issuance.
- Application-level authorization must still enforce workflow-specific visibility rules inside the app. [web:208][web:201][file:10]

### 8.4 Data model requirements

The database model must support at minimum:
- users
- identities
- calls
- submissions
- proposal_versions
- blinded_packets
- eligibility_results
- reviewer_assignments
- reviewer_acknowledgements
- coi_declarations
- scorecards
- clarification_threads
- clarification_messages
- validator_assignments
- validation_records
- audit_events
- retention_rules
- retention_events

Identity-bearing data and reviewer-visible data must not be stored in the same access path without explicit policy boundaries. [web:174][web:180][file:10]

### 8.5 Application requirements

- The application must support server-rendered or hybrid-rendered UI pages for the predefined workflow screens.
- The application must support typed server-side validation for all input DTOs.
- The application must expose explicit service boundaries in code even if deployed as one app.
- The application must support configuration-driven call policies and workflow settings. [web:254][web:281][file:1]

### 8.6 Repository strategy

The initial implementation should use one **starter repository** for delivery speed, but it must be organized so that specification, prompts, generated outputs, benchmark assets, and application code remain clearly separated. This is consistent with the Openstrux specification model, which separates stable source-of-truth material, normative requirements, profiles, conformance fixtures, and implementation guidance. [file:1]

The repository must support two execution paths against the same initialized target:
- baseline direct prompt execution
- Openstrux-assisted prompt execution [file:13][file:14]

### 8.7 Starter repository structure

```text
openstrux-nlnet-mvp/
  README.md
  LICENSE
  CONTRIBUTING.md
  SECURITY.md
  .gitignore
  .editorconfig
  .env.example
  openstrux.repo.json

  docs/
    overview.md
    scope.md
    use-case.md
    functional-requirements.md
    technical-requirements.md
    architecture-decisions/
      adr-001-stack.md
      adr-002-repository-structure.md
      adr-003-data-separation.md
      adr-004-authn-authz.md

  specs/
    mvp-profile.md
    domain-model.md
    workflow-states.md
    access-policies.md
    retention-policies.md
    prompt-contract.md

  prompts/
    shared/
      system.md
      constraints.md
      task-format.md
    baseline/
      p0-domain-model.md
      p1-intake.md
      p2-eligibility.md
      p3-review.md
      p4-clarification.md
      p5-validation.md
      p6-audit.md
    openstrux/
      p0-domain-model.md
      p1-intake.md
      p2-eligibility.md
      p3-review.md
      p4-clarification.md
      p5-validation.md
      p6-audit.md

  openspec/
    product/
    requirements/
    tasks/
    acceptance/

  app/
    web/
      package.json
      next.config.ts
      tsconfig.json
      src/
        app/
        components/
        features/
          intake/
          eligibility/
          review/
          clarification/
          validation/
          audit/
        lib/
        server/
          auth/
          db/
          policies/
          services/
          mappers/
        styles/

  packages/
    domain/
      src/
        entities/
        value-objects/
        enums/
        schemas/
    policies/
      src/
        eligibility/
        access/
        retention/
        workflow/
    generators/
      src/
        baseline/
        openstrux/
    benchmark-model/
      src/
        scorecard/
        metrics/
        result-schema/

  prisma/
    schema.prisma
    migrations/
    seeds/

  infra/
    containers/
      Containerfile.web
      Containerfile.keycloak
    podman/
      compose.yaml
    keycloak/
      realm-export.json
    db/
      init.sql

  tests/
    unit/
    integration/
    e2e/
    fixtures/
      submissions/
      blinded-packets/
      eligibility/
      review/
      validation/
      audit/

  conformance/
    valid/
    invalid/
    golden/

  benchmark/
    cases/
      B001-domain-model/
      B002-intake/
      B003-eligibility/
      B004-review-packet/
      B005-manual-review/
      B006-clarification/
      B007-validation/
      B008-audit-retention/
    baselines/
      direct/
      openstrux/
    runs/
      YYYY-MM-DD/
    scorecards/

  scripts/
    setup/
    generate/
    validate/
    benchmark/
    export/

  output/
    direct/
    openstrux/
This structure adapts the Openstrux guidance to a single implementation repo by preserving distinct locations for specifications, profiles, conformance fixtures, benchmark cases, and implementation code. [file:1][file:2][file:13]

8.8 Repository rules
docs/ holds human-facing project documentation.

specs/ holds the structured source-of-truth for the MVP use case.

prompts/ holds stable prompt assets for both execution paths.

openspec/ holds prompt/spec orchestration assets if OpenSpec is used.

app/web/ holds the running Next.js implementation.

packages/domain/ and packages/policies/ hold reusable typed business logic.

conformance/ holds valid, invalid, and golden fixtures.

benchmark/ holds benchmark case definitions, run outputs, and scorecards.

output/ holds generated artifacts from both paths for comparison. [file:1][file:2][file:13]

8.9 Code organization requirements
Business policies must be implemented outside UI components.

Eligibility, access, retention, and workflow rules must be isolated as reusable modules.

Mapping between source specs/prompts and generated outputs must be traceable.

Generated artifacts must be separable from handwritten source files. [file:12][file:14][file:1]

8.10 Configuration requirements
The system must support configuration for:

active call

enabled eligibility checks

reviewer policy text version

conflict-of-interest form version

retention durations

blinded packet field exclusions

feature flags by phase

benchmark run identifiers [page:1][file:12][file:13]

8.11 Testing requirements
Unit tests for policy modules.

Integration tests for database + service interactions.

End-to-end tests for main workflow slices.

Fixture-based conformance tests for valid/invalid policy cases.

Golden tests for blinded packet generation and workflow state transitions. [file:1][file:13]

8.12 Deployment requirements
The application must run locally with a documented one-command or few-command developer bootstrap.

The application must be deployable on a Debian host using Podman containers.

Web app, PostgreSQL, and Keycloak must run as separate services.

Secrets must be externalized from source control. [web:216][web:215][web:208]

8.13 Comparison-readiness requirements
The starter repository must be able to run the same functional slices through two generation paths and preserve:

prompts used

source specs used

generated files

validation results

token counts

execution time

repair/no-repair status

final scorecard entry [file:13][file:12]

9. Acceptance baseline
A phase is considered complete only when:

its functional requirements are implemented or explicitly stubbed,

its policy behavior is testable,

its outputs are auditable,

its fixtures exist where relevant,

and it is benchmark-ready for later comparison. [file:1][file:12][file:13]