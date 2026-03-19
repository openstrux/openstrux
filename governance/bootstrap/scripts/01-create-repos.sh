#!/usr/bin/env bash
# Phase 1 – Create 3 repositories under the openstrux org
set -euo pipefail

ORG="openstrux"

gh repo create "$ORG/openstrux" \
  --public \
  --description "Manifesto, objectives, benchmarks, governance, demos" \
  --homepage "https://github.com/openstrux"

gh repo create "$ORG/openstrux-spec" \
  --public \
  --description "Normative language spec, grammar, schemas, conformance, ADRs" \

gh repo create "$ORG/openstrux-core" \
  --public \
  --description "Parser, validator, AST, IR, manifest, lock (future CLI)"

echo "✅ Repositories created."
