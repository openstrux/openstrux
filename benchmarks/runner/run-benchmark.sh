#!/usr/bin/env bash
set -euo pipefail

# run-benchmark.sh — Orchestrate a full benchmark run against a use-case repo.
#
# Creates a git worktree in the uc repo → calls generate-api.ts (Anthropic API,
# clean context) → runs unit tests → saves results → copies results back to the
# uc repo's results/ → removes worktree.
#
# Usage:
#   benchmarks/runner/run-benchmark.sh \
#     --uc <abs-path-to-uc-repo> \
#     --path <direct|openstrux> \
#     [--model <model-id>] \
#     [--with-db] \
#     [--note <string>]
#
# Requires: ANTHROPIC_API_KEY, Node >= 24, pnpm, git

RUNNER_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENSTRUX_ROOT="$(cd "$RUNNER_DIR/../.." && pwd)"

# Load .env from openstrux root if present (gitignored — safe for API keys)
[[ -f "$OPENSTRUX_ROOT/.env" ]] && set -a && source "$OPENSTRUX_ROOT/.env" && set +a

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------

UC_ROOT=""
PATH_NAME=""
MODEL="claude-sonnet-4-6"
WITH_DB=true    # integration tests are on by default; pass --no-db to skip
NOTE=""
MAX_RETRIES=""   # empty = let generate-api read from benchmark.config.json
AGENT=true
MAX_TURNS="40"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uc)          UC_ROOT="$2";     shift 2 ;;
    --path)        PATH_NAME="$2";   shift 2 ;;
    --model)       MODEL="$2";       shift 2 ;;
    --no-db)       WITH_DB=false;    shift ;;
    --note)        NOTE="$2";        shift 2 ;;
    --max-retries) MAX_RETRIES="$2"; shift 2 ;;
    --no-agent)    AGENT=false;      shift ;;
    --max-turns)   MAX_TURNS="$2";  shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$UC_ROOT" || -z "$PATH_NAME" ]]; then
  echo "Usage: run-benchmark.sh --uc <uc-repo> --path <direct|openstrux> [--model <id>] [--no-db] [--note <string>] [--max-turns <n>] [--no-agent] [--max-retries <n>]"
  exit 1
fi

case "$PATH_NAME" in
  direct|openstrux) ;;
  *) echo "Error: --path must be 'direct' or 'openstrux'"; exit 1 ;;
esac

if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "Error: ANTHROPIC_API_KEY is not set"
  exit 1
fi

UC_ROOT="$(cd "$UC_ROOT" && pwd)"

# ---------------------------------------------------------------------------
# Validate uc repo has benchmark.config.json
# ---------------------------------------------------------------------------

if [[ ! -f "$UC_ROOT/benchmark.config.json" ]]; then
  echo "Error: $UC_ROOT/benchmark.config.json not found"
  exit 1
fi

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

DATE_SLUG="$(date -u +%Y%m%d-%H%M%S)"
RUN_SLUG="${DATE_SLUG}-${PATH_NAME}"
WORKTREE_DIR="${UC_ROOT}/../$(basename "$UC_ROOT")-bench-${RUN_SLUG}"
RESULT_DIR="${UC_ROOT}/results/${RUN_SLUG}"

mkdir -p "$RESULT_DIR"

echo "============================================================"
echo " Benchmark run : $RUN_SLUG"
echo " use-case repo : $UC_ROOT"
echo " path          : $PATH_NAME"
echo " model         : $MODEL"
echo " integration db: $WITH_DB"
echo " agent mode    : $AGENT"
echo " max-retries   : ${MAX_RETRIES:-from config}"
echo " worktree      : $WORKTREE_DIR"
echo " results       : $RESULT_DIR"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# Cleanup trap
# ---------------------------------------------------------------------------

cleanup() {
  local exit_code=$?
  echo ""
  echo "=== Cleanup ==="
  if [[ -d "$WORKTREE_DIR" ]]; then
    git -C "$UC_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null \
      || rm -rf "$WORKTREE_DIR"
    echo "Removed worktree."
  fi
  if [[ "$WITH_DB" == "true" ]]; then
    docker rm -f "grant-bench-pg-${DATE_SLUG}" >/dev/null 2>&1 || true
  fi
  exit $exit_code
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Step 1: Create worktree
# ---------------------------------------------------------------------------

echo "=== Step 1: Create worktree ==="
git -C "$UC_ROOT" worktree add "$WORKTREE_DIR" HEAD
echo ""

# ---------------------------------------------------------------------------
# Step 2: Install dependencies in worktree
# ---------------------------------------------------------------------------

echo "=== Step 2: Install dependencies ==="
(cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile --silent)
echo ""

# ---------------------------------------------------------------------------
# Step 3: Generate
# ---------------------------------------------------------------------------

echo "=== Step 3: Generate (${PATH_NAME}) ==="

if [[ "$AGENT" == "true" ]]; then
  # Agent mode: Claude Code SDK — agent reads stubs and tests, writes code, runs tests itself
  node --experimental-strip-types "$RUNNER_DIR/generate-agent.ts" \
    --path       "$PATH_NAME" \
    --model      "$MODEL" \
    --worktree   "$WORKTREE_DIR" \
    --result-dir "$RESULT_DIR" \
    --max-turns  "$MAX_TURNS"
else
  # API mode: static prompt + fenced-block parsing + retry loop
  RETRIES_ARG=()
  [[ -n "$MAX_RETRIES" ]] && RETRIES_ARG=(--max-retries "$MAX_RETRIES")

  node --experimental-strip-types "$RUNNER_DIR/generate-api.ts" \
    --path       "$PATH_NAME" \
    --model      "$MODEL" \
    --worktree   "$WORKTREE_DIR" \
    --result-dir "$RESULT_DIR" \
    "${RETRIES_ARG[@]}"

  # For the openstrux path in API mode: run strux build after generation
  if [[ "$PATH_NAME" == "openstrux" ]]; then
    echo "=== Step 3b: strux build ==="
    (cd "$WORKTREE_DIR" && npx strux build --explain 2>&1 | tee "$RESULT_DIR/strux-build.log") \
      || echo "Warning: strux build non-zero — see strux-build.log"
    echo ""
  fi
fi
echo ""

# ---------------------------------------------------------------------------
# Step 4: Unit tests
# ---------------------------------------------------------------------------

echo "=== Step 4: Unit tests ==="
TEST_JSON="$RESULT_DIR/test-unit.json"
TEST_EXIT=0

# Read test command from benchmark.config.json
TEST_CMD="$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("$WORKTREE_DIR/benchmark.config.json", "utf-8"));
process.stdout.write(c.testUnit ?? "pnpm test:unit");
JS
)"

(cd "$WORKTREE_DIR" && eval "$TEST_CMD --reporter=json --outputFile=$TEST_JSON" 2>&1 \
  | tee "$RESULT_DIR/test-unit.log") || TEST_EXIT=$?

[[ $TEST_EXIT -ne 0 ]] && echo "Unit tests had failures — results recorded" || echo "Unit tests passed"
echo ""

# ---------------------------------------------------------------------------
# Step 5 (optional): Integration tests with ephemeral DB
# ---------------------------------------------------------------------------

if [[ "$WITH_DB" == "true" ]]; then
  echo "=== Step 5: Integration tests (--with-db) ==="

  DB_PORT=5433
  DB_CONTAINER="grant-bench-pg-${DATE_SLUG}"
  DB_URL="postgresql://postgres:bench@localhost:${DB_PORT}/grant_workflow"

  docker run -d \
    --name "$DB_CONTAINER" \
    -e POSTGRES_PASSWORD=bench \
    -e POSTGRES_DB=grant_workflow \
    -p "${DB_PORT}:5432" \
    postgres:15 >/dev/null

  echo "Waiting for Postgres..."
  for i in $(seq 1 20); do
    docker exec "$DB_CONTAINER" pg_isready -U postgres >/dev/null 2>&1 && echo "Ready (${i}s)" && break
    sleep 1
  done

  (cd "$WORKTREE_DIR" && DATABASE_URL="$DB_URL" npx prisma migrate deploy 2>&1 \
    | tee "$RESULT_DIR/migrate.log") || echo "Warning: migration errors — see migrate.log"

  INTEG_JSON="$RESULT_DIR/test-integration.json"
  INTEG_EXIT=0
  (cd "$WORKTREE_DIR" && DATABASE_URL="$DB_URL" pnpm test:integration \
    --reporter=json --outputFile="$INTEG_JSON" 2>&1 \
    | tee "$RESULT_DIR/test-integration.log") || INTEG_EXIT=$?

  [[ $INTEG_EXIT -ne 0 ]] && echo "Integration tests had failures" || echo "Integration tests passed"
  echo ""
fi

# ---------------------------------------------------------------------------
# Step 6: Save result
# ---------------------------------------------------------------------------

echo "=== Step 6: Save result ==="
bash "$RUNNER_DIR/save-result.sh" \
  --path             "$PATH_NAME" \
  --llm              "$MODEL" \
  --worktree         "$WORKTREE_DIR" \
  --result-dir       "$RESULT_DIR" \
  --test-results-json "$TEST_JSON" \
  --note             "$NOTE"
echo ""

# ---------------------------------------------------------------------------
# Step 7: Merge integration counts into benchmark.json (if run)
# ---------------------------------------------------------------------------

if [[ "$WITH_DB" == "true" && -f "${RESULT_DIR}/test-integration.json" ]]; then
  node --input-type=module <<JSEOF
import { readFileSync, writeFileSync } from "node:fs";
const bench = JSON.parse(readFileSync("${RESULT_DIR}/benchmark.json", "utf-8"));
const integ  = JSON.parse(readFileSync("${RESULT_DIR}/test-integration.json", "utf-8"));
bench.testSuites.integration = {
  total:  integ.numTotalTests  ?? 0,
  passed: integ.numPassedTests ?? 0,
  failed: integ.numFailedTests ?? 0,
};
writeFileSync("${RESULT_DIR}/benchmark.json", JSON.stringify(bench, null, 2));
console.log("Updated benchmark.json with integration results.");
JSEOF
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

echo "============================================================"
echo " Run complete : $RUN_SLUG"
echo " Results      : $RESULT_DIR"
echo "============================================================"
