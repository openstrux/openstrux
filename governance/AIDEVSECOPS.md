# AiDevSecOps Policy

## Threat model

Openstrux is a specification-driven build system. The primary attack surfaces are:

| Threat | Attack surface |
|---|---|
| Spec injection | Malicious input in spec files that triggers unexpected codegen behavior |
| Parser exploits | Crafted input to crash or subvert the parser (openstrux-core) |
| Supply chain | Compromised dependency introduces malicious codegen or validator behavior |
| GenAI hallucination | AI-generated code introduces subtle logic errors or insecure patterns |
| Prompt injection | Spec content crafted to manipulate AI-assisted tooling |
| Output trust | Generated artifacts assumed safe without independent review |
| Contributor compromise | Malicious PR that bypasses review |

---

## Security review gates

| Trigger | Gate |
|---|---|
| Every PR | Automated SAST (CodeQL) + dependency vulnerability audit |
| Parser or codegen changes | Mandatory human security review — explicit checklist item in PR |
| New dependency added | License check + vulnerability scan before merge |
| Pre-release | Full dependency audit + SBOM generation |
| Major release | Full threat model review by author |

---

## Dependency scanning

| Tool | Role |
|---|---|
| **Dependabot** | Automated dependency update PRs |
| **OSV-Scanner** | Known CVE scan against lockfiles |
| **CodeQL** | SAST — static analysis for common vulnerability patterns |
| **REUSE / SPDX** | License compliance per dependency |
| **Sigstore / cosign** | Artifact signing for releases |

### License allowlist

Permitted: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, MPL-2.0.

Copyleft licenses (GPL, AGPL, LGPL) require explicit author review before inclusion — build tools risk embedding license obligations into user outputs.

---

## GenAI rules

All code paths are human-validated regardless of origin — there is no AI-only or human-only designation. The following rules govern AI-assisted contributions:

- AI-assisted code undergoes the same review process as human-written code — no exceptions, no bypass.
- AI must not be used without an explicit human review step in the PR on: parser logic, validator logic, security-sensitive codegen paths.
- Prompt provenance (model name, date, task description) is recorded in the commit body per [COMMIT_FORMAT.md](COMMIT_FORMAT.md).
- Generated output is not considered reviewed until the author has explicitly validated it against the relevant spec or test suite.

---

## References

- [COMMIT_FORMAT.md](COMMIT_FORMAT.md) — AI attribution in commits
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution workflow
