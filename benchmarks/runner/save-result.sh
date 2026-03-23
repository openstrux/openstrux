#!/usr/bin/env bash
set -euo pipefail

# save-result.sh — Non-interactive benchmark result archival.
#
# Detects generated files via git diff in the worktree, copies them to
# output/<path>/ in the uc repo as a reference mirror, zips to
# results/<slug>/, writes benchmark.json. No interactive prompts.
#
# Usage:
#   save-result.sh \
#     --path <direct|openstrux> \
#     --llm <model-id> \
#     --worktree <abs-path> \
#     --result-dir <abs-path> \
#     [--test-results-json <path>] \
#     [--note <string>]

# ---------------------------------------------------------------------------
# Args
# ---------------------------------------------------------------------------

PATH_NAME=""
LLM=""
WORKTREE=""
RESULT_DIR=""
TEST_JSON=""
NOTE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --path)              PATH_NAME="$2"; shift 2 ;;
    --llm)               LLM="$2";       shift 2 ;;
    --worktree)          WORKTREE="$2";  shift 2 ;;
    --result-dir)        RESULT_DIR="$2"; shift 2 ;;
    --test-results-json) TEST_JSON="$2"; shift 2 ;;
    --note)              NOTE="$2";      shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

if [[ -z "$PATH_NAME" || -z "$LLM" || -z "$WORKTREE" || -z "$RESULT_DIR" ]]; then
  echo "Error: --path, --llm, --worktree, and --result-dir are required"
  exit 1
fi

# Derive uc repo root from worktree (worktree lives one level up from uc root)
UC_ROOT="$(node --input-type=module <<JSEOF
import { readFileSync } from "node:fs";
// The worktree is a sibling of the uc repo — work backwards
const wt = "${WORKTREE}";
// benchmark.config.json is in the worktree root, same as uc root structure
process.stdout.write(wt);
JSEOF
)"
UC_ROOT="$WORKTREE"  # worktree mirrors uc root; output/ lives in the uc root
# Actually output/ and results/ should be in the REAL uc root, not the worktree.
# Derive uc root from result-dir (result-dir = uc-root/results/<slug>)
UC_ROOT="$(dirname "$(dirname "$RESULT_DIR")")"

mkdir -p "$RESULT_DIR"

# ---------------------------------------------------------------------------
# Detect generated files
# ---------------------------------------------------------------------------

echo "=== Detecting generated files ==="

GENERATED_FILES=()
while IFS= read -r f; do
  [[ -n "$f" ]] && GENERATED_FILES+=("$f")
done < <(
  cd "$WORKTREE"
  git diff --name-only HEAD 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null \
    | grep -v '^node_modules/' \
    | grep -v '^\.' \
    | grep -v '^output/' \
    | grep -v '^results/'
)

FILE_COUNT="${#GENERATED_FILES[@]}"
echo "Found ${FILE_COUNT} generated file(s)"

# ---------------------------------------------------------------------------
# Copy to uc-root/output/<path>/ as reference mirror
# ---------------------------------------------------------------------------

OUTPUT_REF="$UC_ROOT/output/$PATH_NAME"
rm -rf "$OUTPUT_REF"
mkdir -p "$OUTPUT_REF"

for f in "${GENERATED_FILES[@]}"; do
  src="$WORKTREE/$f"
  dst="$OUTPUT_REF/$f"
  if [[ -f "$src" ]]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
  fi
done

echo "Copied to output/$PATH_NAME/"

# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

TOTAL_LINES=0
if [[ "${FILE_COUNT}" -gt 0 ]]; then
  TOTAL_LINES=$(find "$OUTPUT_REF" -type f -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')
fi

# ---------------------------------------------------------------------------
# Zip generated files
# ---------------------------------------------------------------------------

GENERATED_ZIP="$RESULT_DIR/generated.zip"
if [[ "${FILE_COUNT}" -gt 0 ]]; then
  python3 -c "
import zipfile, os, sys
src = sys.argv[1]; out = sys.argv[2]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if f == '.DS_Store': continue
            fp = os.path.join(root, f)
            zf.write(fp, os.path.relpath(fp, src))
" "$OUTPUT_REF" "$GENERATED_ZIP"
  echo "Zipped → generated.zip"
fi

# ---------------------------------------------------------------------------
# Snapshot prompts
# ---------------------------------------------------------------------------

PROMPTS_ZIP="$RESULT_DIR/prompts.zip"
PROMPT_VERSION="$(cd "$WORKTREE" && git log -1 --format=%h -- prompts/ 2>/dev/null || echo "uncommitted")"
python3 -c "
import zipfile, os, sys
src = sys.argv[1]; paths = sys.argv[2:]; out = paths.pop(0)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zf:
    for p in paths:
        full = os.path.join(src, p)
        if not os.path.exists(full): continue
        for root, dirs, files in os.walk(full):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in files:
                if f == '.DS_Store': continue
                fp = os.path.join(root, f)
                zf.write(fp, os.path.relpath(fp, src))
" "$WORKTREE" "$PROMPTS_ZIP" "prompts/shared" "prompts/$PATH_NAME" 2>/dev/null || true
echo "Snapshotted → prompts.zip"

# ---------------------------------------------------------------------------
# Parse test results
# ---------------------------------------------------------------------------

UNIT_TOTAL=0; UNIT_PASSED=0; UNIT_FAILED=0
TEST_SUMMARY="not run"

if [[ -n "$TEST_JSON" && -f "$TEST_JSON" ]]; then
  UNIT_TOTAL=$(node  --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$TEST_JSON","utf-8"));
process.stdout.write(String(d.numTotalTests  ?? 0));
JS
)
  UNIT_PASSED=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$TEST_JSON","utf-8"));
process.stdout.write(String(d.numPassedTests ?? 0));
JS
)
  UNIT_FAILED=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$TEST_JSON","utf-8"));
process.stdout.write(String(d.numFailedTests ?? 0));
JS
)
  TEST_SUMMARY="${UNIT_PASSED}/${UNIT_TOTAL} pass"
  echo "Test results: $TEST_SUMMARY"
fi

# ---------------------------------------------------------------------------
# Generation metadata (tokens, time) from generate-api.ts
# ---------------------------------------------------------------------------

INPUT_TOKENS=0
OUTPUT_TOKENS=0
TIME_SECONDS=0
RETRIES=0

if [[ -f "$RESULT_DIR/generation-meta.json" ]]; then
  INPUT_TOKENS=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$RESULT_DIR/generation-meta.json","utf-8"));
process.stdout.write(String(d.inputTokens ?? 0));
JS
)
  OUTPUT_TOKENS=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$RESULT_DIR/generation-meta.json","utf-8"));
process.stdout.write(String(d.outputTokens ?? 0));
JS
)
  TIME_SECONDS=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$RESULT_DIR/generation-meta.json","utf-8"));
process.stdout.write(String(d.timeSeconds ?? 0));
JS
)
  RETRIES=$(node --input-type=module <<JS
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("$RESULT_DIR/generation-meta.json","utf-8"));
process.stdout.write(String(d.retries ?? 0));
JS
)
  echo "Token usage: input=${INPUT_TOKENS}  output=${OUTPUT_TOKENS}  time=${TIME_SECONDS}s  retries=${RETRIES}"
fi

# ---------------------------------------------------------------------------
# Gaps
# ---------------------------------------------------------------------------

GAPS_JSON="[]"
[[ -f "$RESULT_DIR/gaps.json" ]] && GAPS_JSON="$(cat "$RESULT_DIR/gaps.json")"

# ---------------------------------------------------------------------------
# benchmark.json
# ---------------------------------------------------------------------------

TIMESTAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
SAFE_NOTE="$(node --input-type=module <<JSEOF
process.stdout.write(JSON.stringify("${NOTE}"));
JSEOF
)"

cat > "$RESULT_DIR/benchmark.json" <<JSONEOF
{
  "timestamp": "$TIMESTAMP",
  "path": "$PATH_NAME",
  "promptVersion": "$PROMPT_VERSION",
  "llm": "$LLM",
  "generatedFileCount": $FILE_COUNT,
  "totalLines": $TOTAL_LINES,
  "inputTokens": $INPUT_TOKENS,
  "outputTokens": $OUTPUT_TOKENS,
  "timeSeconds": $TIME_SECONDS,
  "retries": $RETRIES,
  "testSuites": {
    "unit": { "total": $UNIT_TOTAL, "passed": $UNIT_PASSED, "failed": $UNIT_FAILED }
  },
  "testResults": "$TEST_SUMMARY",
  "note": $SAFE_NOTE,
  "gaps": $GAPS_JSON
}
JSONEOF

echo "Wrote benchmark.json"

# ---------------------------------------------------------------------------
# Bundle evidence — everything except benchmark.json and generation-meta.json
# ---------------------------------------------------------------------------

KEEP=('benchmark.json' 'generation-meta.json' 'evidence.zip')
EVIDENCE_ZIP="$RESULT_DIR/evidence.zip"

python3 - "$RESULT_DIR" "$EVIDENCE_ZIP" "${KEEP[@]}" <<'PYEOF'
import zipfile, os, sys
result_dir, out_path, *keep = sys.argv[1:]
keep_set = set(keep)
with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for name in sorted(os.listdir(result_dir)):
        if name in keep_set:
            continue
        fp = os.path.join(result_dir, name)
        if os.path.isfile(fp):
            zf.write(fp, name)
PYEOF

# Remove individual files now bundled into evidence.zip
python3 - "$RESULT_DIR" "$EVIDENCE_ZIP" "${KEEP[@]}" <<'PYEOF'
import zipfile, os, sys
result_dir, evidence, *keep = sys.argv[1:]
keep_set = set(keep)
with zipfile.ZipFile(evidence, 'r') as zf:
    for name in zf.namelist():
        fp = os.path.join(result_dir, name)
        if os.path.isfile(fp) and name not in keep_set:
            os.remove(fp)
PYEOF

echo "Bundled evidence → evidence.zip"
echo ""
echo "=== Result saved to $RESULT_DIR ==="
