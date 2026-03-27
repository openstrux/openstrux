#!/usr/bin/env bash
set -euo pipefail

# run-benchmark.sh — Orchestrate a full benchmark run against a use-case repo.
#
# Three operating modes (--mode):
#
#   agent  (default) — Full agentic generation loop.
#     Providers: anthropic (Claude Agent SDK), openai (OAI tool-calling loop),
#                google-gemini (OAI-compat endpoint at generativelanguage.googleapis.com)
#
#   prompt — Assemble the prompt, create the worktree, install dependencies,
#            write prompt-<path>.txt + worktree.txt to result-dir, then exit.
#            No API key required. Run --mode apply afterwards with the response.
#
#   apply  — Recover the worktree from a prior --mode prompt run, apply a
#            response file, run unit + integration tests, commit results.
#            Requires --response <file>. No API key required.
#
#   clean-test-env — Drop bench DB/user, delete remote bench branch, remove worktree.
#     Scoped:  --result-dir <path>  — clean a specific run's resources
#     Global:  (no --result-dir)    — clean all bench-prefixed resources
#
# Usage:
#   benchmarks/runner/run-benchmark.sh \
#     --uc    <abs-path-to-uc-repo> \
#     --path  <direct|openstrux> \
#     [--mode <agent|prompt|apply|clean-test-env>] \   # default: agent
#     [--model <model-id>]            \   # default: claude-sonnet-4-6 or gemini-2.5-pro
#     [--provider <anthropic|openai|google-gemini>] \
#     [--base-url <url>]              \   # override API endpoint
#     [--response <file>]             \   # apply: fenced-block response file
#     [--bench-branch <branch>]       \   # apply/prompt: override branch (default: bench-<slug>)
#     [--result-dir <abs-path>]       \   # auto-generated if not provided
#     [--with-db]                     \   # run integration tests (agent mode)
#     [--no-db]                       \   # skip integration tests
#     [--keep-test-env]               \   # keep worktree + bench DB after tests
#     [--web]                         \   # prompt mode: web-safe prompt (relative paths, fenced-block output)
#     [--note <string>]               \
#     [--max-turns <n>]                   # agent mode only, default: 80
#
# Env vars (agent mode only):
#   ANTHROPIC_API_KEY  — provider=anthropic
#   ZAI_API_KEY        — provider=openai (fallback: OPENAI_API_KEY)
#   GOOGLE_API_KEY     — provider=google-gemini

RUNNER_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENSTRUX_ROOT="$(cd "$RUNNER_DIR/../.." && pwd)"

# Load .env from openstrux root if present (gitignored — safe for API keys)
[[ -f "$OPENSTRUX_ROOT/.env" ]] && set -a && source "$OPENSTRUX_ROOT/.env" && set +a

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------

UC_ROOT=""
PATH_NAME=""
MODE="agent"
MODEL=""
PROVIDER=""
BASE_URL=""
RESPONSE_FILE=""
RESULT_DIR_ARG=""
BENCH_BRANCH_ARG=""
WITH_DB=true
KEEP_TEST_ENV=false
WEB_SESSION=false
NOTE=""
MAX_TURNS="80"
INPUT_TOKENS_ARG=""
OUTPUT_TOKENS_ARG=""
TIME_SECONDS_ARG=""
RETRIES_ARG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uc)            UC_ROOT="$2";           shift 2 ;;
    --path)          PATH_NAME="$2";         shift 2 ;;
    --mode)          MODE="$2";              shift 2 ;;
    --model)         MODEL="$2";             shift 2 ;;
    --provider)      PROVIDER="$2";          shift 2 ;;
    --base-url)      BASE_URL="$2";          shift 2 ;;
    --response)      RESPONSE_FILE="$2";     shift 2 ;;
    --result-dir)    RESULT_DIR_ARG="$2";    shift 2 ;;
    --bench-branch)  BENCH_BRANCH_ARG="$2";  shift 2 ;;
    --with-db)       WITH_DB=true;           shift ;;
    --no-db)         WITH_DB=false;          shift ;;
    --keep-test-env) KEEP_TEST_ENV=true;     shift ;;
    --web)           WEB_SESSION=true;       shift ;;
    --note)          NOTE="$2";              shift 2 ;;
    --max-turns)     MAX_TURNS="$2";         shift 2 ;;
    --input-tokens)  INPUT_TOKENS_ARG="$2";  shift 2 ;;
    --output-tokens) OUTPUT_TOKENS_ARG="$2"; shift 2 ;;
    --time-seconds)  TIME_SECONDS_ARG="$2";  shift 2 ;;
    --retries)       RETRIES_ARG="$2";       shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# Validate mode
case "$MODE" in
  agent|prompt|apply|clean-test-env) ;;
  *) echo "Error: --mode must be agent, prompt, apply, or clean-test-env"; exit 1 ;;
esac

# ---------------------------------------------------------------------------
# clean-test-env mode
# ---------------------------------------------------------------------------

if [[ "$MODE" == "clean-test-env" ]]; then
  if [[ -n "$RESULT_DIR_ARG" ]]; then
    # Scoped clean: drop resources for a specific run
    SLUG="$(basename "$RESULT_DIR_ARG" | sed 's/-direct$//' | sed 's/-openstrux$//')"
    BENCH_DB="grant_bench_${SLUG}"
    BENCH_USER="bench_${SLUG}"
    BENCH_BRANCH="bench-$(basename "$RESULT_DIR_ARG")"
    echo "Cleaning test env for: $(basename "$RESULT_DIR_ARG")"
    sudo -u postgres dropdb -h 127.0.0.1 --if-exists "$BENCH_DB" && echo "Dropped DB: $BENCH_DB"
    sudo -u postgres dropuser -h 127.0.0.1 --if-exists "$BENCH_USER" && echo "Dropped user: $BENCH_USER"
    if [[ -n "$UC_ROOT" ]]; then
      UC_ROOT="$(cd "$UC_ROOT" && pwd)"
      git -C "$UC_ROOT" push origin --delete "$BENCH_BRANCH" 2>/dev/null \
        && echo "Deleted branch: $BENCH_BRANCH" \
        || echo "Branch not found (skipped): $BENCH_BRANCH"
      WORKTREE_FILE="$RESULT_DIR_ARG/worktree.txt"
      if [[ -f "$WORKTREE_FILE" ]]; then
        WORKTREE_PATH="$(cat "$WORKTREE_FILE")"
        if [[ -d "$WORKTREE_PATH" ]]; then
          git -C "$UC_ROOT" worktree remove --force "$WORKTREE_PATH" 2>/dev/null \
            || rm -rf "$WORKTREE_PATH"
          echo "Removed worktree: $WORKTREE_PATH"
        fi
      fi
    fi
  else
    # Global clean: remove all bench-prefixed resources
    echo "Global clean: removing all bench-prefixed resources"
    sudo -u postgres psql -h 127.0.0.1 -tAc \
      "SELECT datname FROM pg_database WHERE datname LIKE 'grant_bench_%';" \
      | while IFS= read -r db; do
          [[ -n "$db" ]] || continue
          sudo -u postgres dropdb -h 127.0.0.1 --if-exists "$db" && echo "Dropped DB: $db"
        done
    sudo -u postgres psql -h 127.0.0.1 -tAc \
      "SELECT usename FROM pg_user WHERE usename LIKE 'bench_%';" \
      | while IFS= read -r user; do
          [[ -n "$user" ]] || continue
          sudo -u postgres dropuser -h 127.0.0.1 --if-exists "$user" && echo "Dropped user: $user"
        done
    if [[ -n "$UC_ROOT" ]]; then
      UC_ROOT="$(cd "$UC_ROOT" && pwd)"
      # Remove local worktrees whose branch name matches bench-* prefix
      git -C "$UC_ROOT" worktree list --porcelain \
        | awk '/^worktree /{wt=$2} /^branch refs\/heads\/bench-/{print wt}' \
        | while IFS= read -r wt_path; do
            [[ -n "$wt_path" ]] || continue
            git -C "$UC_ROOT" worktree remove --force "$wt_path" 2>/dev/null \
              || rm -rf "$wt_path"
            echo "Removed worktree: $wt_path"
          done
      # Delete all remote bench-* branches
      git -C "$UC_ROOT" ls-remote --heads origin 'refs/heads/bench-*' \
        | awk '{print $2}' | sed 's|refs/heads/||' \
        | while IFS= read -r branch; do
            [[ -n "$branch" ]] || continue
            git -C "$UC_ROOT" push origin --delete "$branch" 2>/dev/null \
              && echo "Deleted branch: $branch" || true
          done
    fi
    echo "Global clean complete."
  fi
  exit 0
fi

# ---------------------------------------------------------------------------
# Validate common required args
# ---------------------------------------------------------------------------

if [[ -z "$UC_ROOT" || -z "$PATH_NAME" ]]; then
  echo "Usage: run-benchmark.sh --uc <uc-repo> --path <direct|openstrux> [--mode agent|prompt|apply|clean-test-env] ..."
  exit 1
fi

case "$PATH_NAME" in
  direct|openstrux) ;;
  *) echo "Error: --path must be 'direct' or 'openstrux'"; exit 1 ;;
esac

if [[ "$MODE" == "apply" && -z "$RESPONSE_FILE" && -z "$RESULT_DIR_ARG" ]]; then
  echo "Error: --response <file> or --result-dir <path> required for --mode apply"
  exit 1
fi

UC_ROOT="$(cd "$UC_ROOT" && pwd)"

# Auto-detect provider from model name (for display and API key check)
if [[ -z "$PROVIDER" ]]; then
  if [[ "$MODEL" == claude-* ]]; then
    PROVIDER="anthropic"
  elif [[ "$MODEL" == gemini-* ]]; then
    PROVIDER="google-gemini"
  else
    PROVIDER="${MODEL:+openai}"
    PROVIDER="${PROVIDER:-anthropic}"
  fi
fi

# Default model per provider
if [[ -z "$MODEL" ]]; then
  if [[ "$PROVIDER" == "google-gemini" ]]; then
    MODEL="gemini-2.5-pro"
  else
    MODEL="claude-sonnet-4-6"
  fi
fi

# API key check (agent mode only)
if [[ "$MODE" == "agent" ]]; then
  if [[ "$PROVIDER" == "anthropic" ]]; then
    if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_AUTH_TOKEN:-}" ]]; then
      echo "Error: ANTHROPIC_API_KEY is not set"
      exit 1
    fi
  elif [[ "$PROVIDER" == "google-gemini" ]]; then
    if [[ -z "${GOOGLE_API_KEY:-}" ]]; then
      echo "Error: GOOGLE_API_KEY is not set"
      exit 1
    fi
  else
    if [[ -z "${ZAI_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
      echo "Error: ZAI_API_KEY (or OPENAI_API_KEY) is not set"
      exit 1
    fi
  fi
fi

# Validate uc repo
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

if [[ -n "$RESULT_DIR_ARG" ]]; then
  RESULT_DIR="$RESULT_DIR_ARG"
else
  RESULT_DIR="${UC_ROOT}/benchmarks/results/${RUN_SLUG}"
fi

mkdir -p "$RESULT_DIR"

# Derive bench branch: explicit override > result-dir slug (apply) > run slug (prompt/agent)
if [[ -n "$BENCH_BRANCH_ARG" ]]; then
  BENCH_BRANCH="$BENCH_BRANCH_ARG"
elif [[ "$MODE" == "apply" && -n "$RESULT_DIR_ARG" ]]; then
  BENCH_BRANCH="bench-$(basename "$RESULT_DIR_ARG")"
else
  BENCH_BRANCH="bench-${RUN_SLUG}"
fi

echo "============================================================"
echo " Benchmark run : $RUN_SLUG"
echo " mode          : $MODE"
echo " use-case repo : $UC_ROOT"
echo " path          : $PATH_NAME"
echo " model         : $MODEL"
echo " provider      : $PROVIDER"
echo " results       : $RESULT_DIR"
[[ "$MODE" != "apply" ]] && echo " branch        : $BENCH_BRANCH"
[[ "$MODE" != "apply" ]] && echo " worktree      : $WORKTREE_DIR"
[[ "$MODE" == "apply" ]] && echo " response      : $RESPONSE_FILE"
[[ "$MODE" == "agent" ]] && echo " integration db: $WITH_DB"
[[ "$MODE" == "agent" ]] && echo " keep-test-env : $KEEP_TEST_ENV"
[[ "$MODE" == "agent" ]] && echo " max-turns     : $MAX_TURNS"
echo "============================================================"
echo ""

# ---------------------------------------------------------------------------
# Build optional flags for generate.ts
# ---------------------------------------------------------------------------

BASE_URL_ARG=()
[[ -n "$BASE_URL" ]] && BASE_URL_ARG=(--base-url "$BASE_URL")

PROVIDER_ARG=()
[[ -n "$PROVIDER" ]] && PROVIDER_ARG=(--provider "$PROVIDER")

# For anthropic provider, route through ANTHROPIC_BASE_URL env var (Claude Agent SDK reads it)
if [[ "$PROVIDER" == "anthropic" && -n "$BASE_URL" ]]; then
  export ANTHROPIC_BASE_URL="$BASE_URL"
  echo "[runner] ANTHROPIC_BASE_URL=$ANTHROPIC_BASE_URL"
  BASE_URL_ARG=()  # Already set via env — don't pass as CLI arg for anthropic
fi

# ---------------------------------------------------------------------------
# Helper functions
# ---------------------------------------------------------------------------

# setup_bench_db <db> <user> <pass> <worktree> <result_dir>
# Ensures postgres is running, creates user/db, runs prisma generate + migrate/push.
setup_bench_db() {
  local db="$1" user="$2" pass="$3" worktree="$4" result_dir="$5"

  if ! command -v pg_isready &>/dev/null; then
    echo "Warning: postgresql not found — skipping DB setup"
    return 1
  fi

  if ! pg_isready -h 127.0.0.1 -q; then
    echo "Starting local Postgres..."
    sudo pg_ctlcluster 18 main start
    sleep 2
  fi

  sudo -u postgres psql -h 127.0.0.1 -v ON_ERROR_STOP=1 <<SQL
CREATE USER "${user}" WITH PASSWORD '${pass}';
CREATE DATABASE "${db}" OWNER "${user}";
SQL

  local db_url="postgresql://${user}:${pass}@127.0.0.1:5432/${db}"

  (cd "${worktree}" && \
    pnpm exec prisma generate \
    --schema=prisma/schema.prisma 2>&1 \
    | tee "${result_dir}/generate.log") || echo "Warning: prisma generate errors — see generate.log"

  local migrate_exit=0
  if ls "${worktree}/prisma/migrations/"*.sql 2>/dev/null | head -1 | grep -q .; then
    echo "Migrations found — running migrate deploy"
    (cd "${worktree}" && DATABASE_URL="$db_url" \
      pnpm exec prisma migrate deploy \
      --schema=prisma/schema.prisma 2>&1 \
      | tee "${result_dir}/migrate.log") || migrate_exit=$?
  else
    echo "No migrations found — using db push"
    (cd "${worktree}" && DATABASE_URL="$db_url" \
      pnpm exec prisma db push \
      --schema=prisma/schema.prisma --accept-data-loss --skip-generate 2>&1 \
      | tee "${result_dir}/migrate.log") || migrate_exit=$?
  fi
  if [[ $migrate_exit -ne 0 ]]; then
    echo "Warning: schema apply errors — see migrate.log"
  fi

  # Seed canonical dev fixtures (users + default call) defined in openspec/specs/access-policies.md.
  # The seeded rows are kept in the DB for manual inspection; everything is wiped by clean-test-env.
  echo "Seeding dev fixtures (prisma/seeds/seed.ts)..."
  (cd "${worktree}" && DATABASE_URL="$db_url" \
    pnpm exec prisma db seed 2>&1 \
    | tee "${result_dir}/seed.log") || echo "Warning: seed errors — see seed.log"

  return 0
}

# run_integration_tests <worktree> <result_dir> <db_url>
# Runs pnpm test:integration with DATABASE_URL, tees output, returns exit code.
run_integration_tests() {
  local worktree="$1" result_dir="$2" db_url="$3"
  local integ_json="${result_dir}/test-integration.json"
  local integ_exit=0
  (cd "$worktree" && DATABASE_URL="$db_url" pnpm test:integration \
    --reporter=json --outputFile="$integ_json" 2>&1 \
    | tee "${result_dir}/test-integration.log") || integ_exit=$?
  [[ $integ_exit -ne 0 ]] && echo "Integration tests had failures" || echo "Integration tests passed"
  return $integ_exit
}

# commit_results <worktree> <result_dir> <run_slug> <model> <path> <uc_root> <branch>
# Copies result-dir into worktree/results/, commits, and pushes to remote branch.
commit_results() {
  local worktree="$1" result_dir="$2" run_slug="$3" model="$4" path="$5" uc_root="$6" branch="$7"
  local dest="${worktree}/benchmarks/results/$(basename "$result_dir")"
  mkdir -p "$dest"
  cp -r "${result_dir}/." "$dest/"
  git -C "$worktree" add benchmarks/results/
  git -C "$worktree" \
    -c user.name="homofaber-tech" \
    -c user.email="olivierfabre@homofaberconsulting.com" \
    commit -m "bench(results): ${run_slug} — ${model} (${path})" 2>/dev/null \
    || echo "Note: nothing new to commit in results"
  git -C "$uc_root" push origin "$branch" 2>/dev/null \
    || echo "Note: branch push failed (skipped)"
}

# ---------------------------------------------------------------------------
# PROMPT MODE — Steps 1 + 2 then delegate to generate.ts --mode prompt
# ---------------------------------------------------------------------------

if [[ "$MODE" == "prompt" ]]; then
  echo "=== Step 1: Create worktree ==="
  git -C "$UC_ROOT" worktree add -b "$BENCH_BRANCH" "$WORKTREE_DIR" HEAD
  git -C "$UC_ROOT" push origin "$BENCH_BRANCH" 2>/dev/null || echo "Note: branch push failed (skipped)"
  echo ""

  echo "=== Step 2: Install dependencies ==="
  (cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile --silent)
  echo ""

  echo "=== Assembling prompt ==="
  WEB_FLAG=""
  [[ "$WEB_SESSION" == "true" ]] && WEB_FLAG="--web"
  node --experimental-strip-types "$RUNNER_DIR/generate.ts" \
    --mode       prompt \
    --path       "$PATH_NAME" \
    --worktree   "$WORKTREE_DIR" \
    --result-dir "$RESULT_DIR" \
    --branch     "$BENCH_BRANCH" \
    $WEB_FLAG

  echo ""
  echo "============================================================"
  echo " Prompt written to: $RESULT_DIR/prompt-${PATH_NAME}.txt"
  echo " Worktree kept at:  $WORKTREE_DIR"
  echo " Branch:            $BENCH_BRANCH"
  echo "============================================================"
  exit 0
fi

# ---------------------------------------------------------------------------
# APPLY MODE — apply response, run full pipeline, commit results
# ---------------------------------------------------------------------------

if [[ "$MODE" == "apply" ]]; then
  RESPONSE_ABS=""
  [[ -n "$RESPONSE_FILE" ]] && RESPONSE_ABS="$(cd "$(dirname "$RESPONSE_FILE")" && pwd)/$(basename "$RESPONSE_FILE")"

  # Recover worktree path from prior prompt run.
  # worktree.txt may have been bundled into evidence.zip by save-result.sh — also try unzip.
  WORKTREE_FROM_FILE="$(cat "$RESULT_DIR/worktree.txt" 2>/dev/null || true)"
  if [[ -z "$WORKTREE_FROM_FILE" && -f "$RESULT_DIR/evidence.zip" ]]; then
    WORKTREE_FROM_FILE="$(unzip -p "$RESULT_DIR/evidence.zip" worktree.txt 2>/dev/null || true)"
  fi
  if [[ -z "$WORKTREE_FROM_FILE" ]]; then
    # Derive from naming convention: <uc-root>-bench-<run-slug>
    RUN_SLUG_TEMP="$(basename "$RESULT_DIR")"
    WORKTREE_FROM_FILE="${UC_ROOT}-bench-${RUN_SLUG_TEMP}"
    echo "Warning: worktree.txt not found — derived worktree path: $WORKTREE_FROM_FILE"
  fi
  if [[ ! -d "$WORKTREE_FROM_FILE" ]]; then
    echo "Error: worktree not found at $WORKTREE_FROM_FILE — run --mode prompt first"
    exit 1
  fi
  # Ensure worktree.txt exists (may have been bundled into evidence.zip)
  echo "$WORKTREE_FROM_FILE" > "$RESULT_DIR/worktree.txt"

  # RV3.1: Derive slugs and branch from result-dir
  RUN_SLUG="$(basename "$RESULT_DIR")"
  DATE_SLUG="$(echo "$RUN_SLUG" | sed "s/-${PATH_NAME}$//")"
  # --bench-branch overrides the default bench-<slug> derivation (e.g. to point at a CC branch)
  [[ -z "$BENCH_BRANCH_ARG" ]] && BENCH_BRANCH="bench-${RUN_SLUG}"

  echo "=== Applying response ==="
  RESPONSE_ARG=()
  [[ -n "$RESPONSE_FILE" ]]      && RESPONSE_ARG+=(--response       "$RESPONSE_ABS")
  [[ -n "$INPUT_TOKENS_ARG" ]]   && RESPONSE_ARG+=(--input-tokens   "$INPUT_TOKENS_ARG")
  [[ -n "$OUTPUT_TOKENS_ARG" ]]  && RESPONSE_ARG+=(--output-tokens  "$OUTPUT_TOKENS_ARG")
  [[ -n "$TIME_SECONDS_ARG" ]]   && RESPONSE_ARG+=(--time-seconds   "$TIME_SECONDS_ARG")
  [[ -n "$RETRIES_ARG" ]]        && RESPONSE_ARG+=(--retries        "$RETRIES_ARG")
  node --experimental-strip-types "$RUNNER_DIR/generate.ts" \
    --mode        apply \
    --path        "$PATH_NAME" \
    --model       "$MODEL" \
    --result-dir  "$RESULT_DIR" \
    --branch      "$BENCH_BRANCH" \
    "${RESPONSE_ARG[@]}"

  # RV3.2: prisma generate (if schema present)
  if [[ -f "$WORKTREE_FROM_FILE/prisma/schema.prisma" ]]; then
    echo ""
    echo "=== prisma generate ==="
    (cd "$WORKTREE_FROM_FILE" && \
      pnpm exec prisma generate \
      --schema=prisma/schema.prisma 2>&1) || true
  fi

  # RV3.2: Integration tests
  echo ""
  echo "=== Step: Integration tests ==="
  BENCH_DB="grant_bench_${DATE_SLUG}"
  BENCH_USER="bench_${DATE_SLUG}"
  BENCH_PASS="bench"
  DB_URL="postgresql://${BENCH_USER}:${BENCH_PASS}@127.0.0.1:5432/${BENCH_DB}"

  INTEG_OK=true
  setup_bench_db "$BENCH_DB" "$BENCH_USER" "$BENCH_PASS" "$WORKTREE_FROM_FILE" "$RESULT_DIR" \
    && run_integration_tests "$WORKTREE_FROM_FILE" "$RESULT_DIR" "$DB_URL" \
    || INTEG_OK=false

  if [[ "$KEEP_TEST_ENV" == "false" ]]; then
    sudo -u postgres dropdb -h 127.0.0.1 --if-exists "$BENCH_DB" 2>/dev/null || true
    sudo -u postgres dropuser -h 127.0.0.1 --if-exists "$BENCH_USER" 2>/dev/null || true
  else
    echo "Kept bench DB (--keep-test-env): $DB_URL"
    echo "  clean up: run-benchmark.sh --mode clean-test-env --uc $UC_ROOT --result-dir $RESULT_DIR"
  fi

  # RV3.3: Merge integration counts into benchmark.json
  if [[ -f "${RESULT_DIR}/test-integration.json" ]]; then
    node --input-type=module <<JSEOF
import { readFileSync, writeFileSync } from "node:fs";
const bench = JSON.parse(readFileSync("${RESULT_DIR}/benchmark.json", "utf-8"));
const integ  = JSON.parse(readFileSync("${RESULT_DIR}/test-integration.json", "utf-8"));
bench.testSuites = bench.testSuites ?? {};
bench.testSuites.integration = {
  total:  integ.numTotalTests  ?? 0,
  passed: integ.numPassedTests ?? 0,
  failed: integ.numFailedTests ?? 0,
};
writeFileSync("${RESULT_DIR}/benchmark.json", JSON.stringify(bench, null, 2));
console.log("Updated benchmark.json with integration results.");
JSEOF
  fi

  # RV3.4: Re-bundle evidence.zip to include integration test artefacts produced after save-result.sh ran
  if [[ -f "${RESULT_DIR}/evidence.zip" ]]; then
    echo ""
    echo "=== Re-bundling evidence.zip (post-integration) ==="
    python3 - "${RESULT_DIR}" "${RESULT_DIR}/evidence.zip" \
        "benchmark.json" "generation-meta.json" "evidence.zip" <<'PYEOF'
import zipfile, os, sys
result_dir, out_path, *keep = sys.argv[1:]
keep_set = set(keep)
# Read existing zip entries
existing = {}
if os.path.exists(out_path):
    with zipfile.ZipFile(out_path, 'r') as zf:
        for name in zf.namelist():
            existing[name] = zf.read(name)
# Add/overwrite with any loose files not in keep_set
for name in sorted(os.listdir(result_dir)):
    if name in keep_set:
        continue
    fp = os.path.join(result_dir, name)
    if os.path.isfile(fp):
        with open(fp, 'rb') as f:
            existing[name] = f.read()
# Write merged zip
with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for name, data in sorted(existing.items()):
        zf.writestr(name, data)
print("Re-bundled evidence.zip")
PYEOF
  fi

  # RV3.5 / RV2.2: Commit results to bench branch
  echo ""
  echo "=== Committing results ==="
  commit_results "$WORKTREE_FROM_FILE" "$RESULT_DIR" "$RUN_SLUG" "$MODEL" "$PATH_NAME" "$UC_ROOT" "$BENCH_BRANCH"

  # Cleanup worktree unless --keep-test-env
  if [[ "$KEEP_TEST_ENV" == "false" ]]; then
    git -C "$UC_ROOT" worktree remove --force "$WORKTREE_FROM_FILE" 2>/dev/null \
      || rm -rf "$WORKTREE_FROM_FILE"
    echo "Worktree removed: $WORKTREE_FROM_FILE"
  else
    echo "Kept worktree (--keep-test-env): $WORKTREE_FROM_FILE"
  fi

  echo ""
  echo "============================================================"
  echo " Apply complete : $RUN_SLUG"
  echo " Results        : $RESULT_DIR"
  echo " Branch         : $BENCH_BRANCH"
  echo "============================================================"
  exit 0
fi

# ---------------------------------------------------------------------------
# AGENT MODE — full pipeline
# ---------------------------------------------------------------------------

# Cleanup trap (removes worktree and ephemeral bench DB on exit)
cleanup() {
  local exit_code=$?
  echo ""
  echo "=== Cleanup ==="
  if [[ "$KEEP_TEST_ENV" == "false" ]]; then
    if [[ -d "$WORKTREE_DIR" ]]; then
      git -C "$UC_ROOT" worktree remove --force "$WORKTREE_DIR" 2>/dev/null \
        || rm -rf "$WORKTREE_DIR"
      echo "Removed worktree."
    fi
    if [[ "$WITH_DB" == "true" ]]; then
      sudo -u postgres dropdb -h 127.0.0.1 --if-exists "grant_bench_${DATE_SLUG}" 2>/dev/null || true
      sudo -u postgres dropuser -h 127.0.0.1 --if-exists "bench_${DATE_SLUG}" 2>/dev/null || true
      echo "Dropped ephemeral bench DB."
    fi
  else
    echo "Test env kept:"
    echo "  worktree : $WORKTREE_DIR"
    echo "  branch   : $BENCH_BRANCH"
    if [[ "$WITH_DB" == "true" ]]; then
      echo "  db url   : postgresql://bench_${DATE_SLUG}:bench@127.0.0.1:5432/grant_bench_${DATE_SLUG}"
    fi
    echo "  clean up : run-benchmark.sh --mode clean-test-env --result-dir $RESULT_DIR"
  fi
  exit $exit_code
}
trap cleanup EXIT

# Step 1: Create worktree (named branch)
echo "=== Step 1: Create worktree ==="
git -C "$UC_ROOT" worktree add -b "$BENCH_BRANCH" "$WORKTREE_DIR" HEAD
git -C "$UC_ROOT" push origin "$BENCH_BRANCH" 2>/dev/null || echo "Note: branch push failed (skipped)"
echo ""

# Step 2: Install dependencies
echo "=== Step 2: Install dependencies ==="
(cd "$WORKTREE_DIR" && pnpm install --frozen-lockfile --silent)
echo ""

# Step 2.5: Write CLAUDE.md for agent context (RV7)
cat > "$WORKTREE_DIR/CLAUDE.md" <<'CLAUDEMD'
## Benchmark context

You are generating code for a grant-workflow use case. Implement the stubs provided in the repo.

## Testing

Run both test suites to verify your work:
  pnpm test:unit              # no database required
  pnpm test:integration:mock  # uses PrismaClient mock — no database required

Do NOT set up or start a real database.
CLAUDEMD

# Step 3: Generate
echo "=== Step 3: Generate (${PATH_NAME}, provider=${PROVIDER}) ==="
node --experimental-strip-types "$RUNNER_DIR/generate.ts" \
  --mode       agent \
  --path       "$PATH_NAME" \
  --model      "$MODEL" \
  --provider   "$PROVIDER" \
  --worktree   "$WORKTREE_DIR" \
  --result-dir "$RESULT_DIR" \
  --max-turns  "$MAX_TURNS" \
  "${BASE_URL_ARG[@]}"
echo ""

# Step 3.5: Prisma generate (if schema was produced by agent)
if [[ -f "$WORKTREE_DIR/prisma/schema.prisma" ]]; then
  echo "=== Step 3.5: prisma generate ==="
  PRISMA_GENERATE_SKIP_AUTOINSTALL=1 \
    "$WORKTREE_DIR/node_modules/.bin/prisma" generate \
    --schema="$WORKTREE_DIR/prisma/schema.prisma" 2>&1 || true
  echo ""
fi

# Step 4: Unit tests
echo "=== Step 4: Unit tests ==="
TEST_JSON="$RESULT_DIR/test-unit.json"
TEST_EXIT=0

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

# Step 5 (optional): Integration tests with ephemeral local Postgres DB
if [[ "$WITH_DB" == "true" ]]; then
  echo "=== Step 5: Integration tests ==="

  BENCH_DB="grant_bench_${DATE_SLUG}"
  BENCH_USER="bench_${DATE_SLUG}"
  BENCH_PASS="bench"
  DB_URL="postgresql://${BENCH_USER}:${BENCH_PASS}@127.0.0.1:5432/${BENCH_DB}"

  INTEG_EXIT=0
  setup_bench_db "$BENCH_DB" "$BENCH_USER" "$BENCH_PASS" "$WORKTREE_DIR" "$RESULT_DIR" \
    && run_integration_tests "$WORKTREE_DIR" "$RESULT_DIR" "$DB_URL" || INTEG_EXIT=$?
  echo ""
fi

# Step 6: Save result
echo "=== Step 6: Save result ==="
bash "$RUNNER_DIR/save-result.sh" \
  --path              "$PATH_NAME" \
  --llm               "$MODEL" \
  --worktree          "$WORKTREE_DIR" \
  --result-dir        "$RESULT_DIR" \
  --test-results-json "$TEST_JSON" \
  --note              "$NOTE"
echo ""

# Step 7: Merge integration counts into benchmark.json (if run)
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

# Step 7.5: Re-bundle evidence.zip to include integration artefacts (migrate.log, seed.log, test-integration*)
if [[ -f "${RESULT_DIR}/evidence.zip" ]]; then
  echo ""
  echo "=== Step 7.5: Re-bundling evidence.zip (post-integration) ==="
  python3 - "${RESULT_DIR}" "${RESULT_DIR}/evidence.zip" \
      "benchmark.json" "generation-meta.json" "evidence.zip" <<'PYEOF'
import zipfile, os, sys
result_dir, out_path, *keep = sys.argv[1:]
keep_set = set(keep)
existing = {}
if os.path.exists(out_path):
    with zipfile.ZipFile(out_path, 'r') as zf:
        for name in zf.namelist():
            existing[name] = zf.read(name)
for name in sorted(os.listdir(result_dir)):
    if name in keep_set:
        continue
    fp = os.path.join(result_dir, name)
    if os.path.isfile(fp):
        with open(fp, 'rb') as f:
            existing[name] = f.read()
with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for name, data in sorted(existing.items()):
        zf.writestr(name, data)
print("Re-bundled evidence.zip")
PYEOF
fi

# Step 8: Commit results to bench branch
echo "=== Step 8: Commit results ==="
commit_results "$WORKTREE_DIR" "$RESULT_DIR" "$RUN_SLUG" "$MODEL" "$PATH_NAME" "$UC_ROOT" "$BENCH_BRANCH"
echo ""

echo "============================================================"
echo " Run complete : $RUN_SLUG"
echo " Results      : $RESULT_DIR"
echo " Branch       : $BENCH_BRANCH"
echo "============================================================"
