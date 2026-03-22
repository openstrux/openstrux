#!/usr/bin/env bash
set -euo pipefail

# run.sh — End-to-end demo of the Openstrux grant-workflow use case.
# Builds the toolchain, parses/validates/generates from .strux files, checks TypeScript output.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CORE_DIR="$(cd "$REPO_ROOT/../openstrux-core" && pwd)"
UC_DIR="$(cd "$REPO_ROOT/../openstrux-uc-grant-workflow" && pwd)"

echo "=== Openstrux Grant Workflow Demo ==="
echo ""

# --- Check prerequisites ---
echo "Checking prerequisites..."

for cmd in node pnpm npx tsc; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: $cmd is required but not found."
    exit 1
  fi
done

NODE_VERSION="$(node -v | sed 's/v//' | cut -d. -f1)"
if (( NODE_VERSION < 20 )); then
  echo "Error: Node.js >= 20 required (found v$NODE_VERSION)."
  exit 1
fi

echo "  node $(node -v), pnpm $(pnpm -v)"
echo ""

# --- Build toolchain ---
echo "Building openstrux-core toolchain..."
(cd "$CORE_DIR" && pnpm install --frozen-lockfile && pnpm build)
echo "  Done."
echo ""

# --- Check strux config ---
if [[ ! -f "$UC_DIR/strux.config.yaml" ]]; then
  echo "Error: strux.config.yaml not found in use-case repo."
  exit 1
fi
echo "Found strux.config.yaml"

# --- Check for .strux source files ---
STRUX_FILES="$(find "$UC_DIR/pipelines" "$UC_DIR/specs" -name '*.strux' 2>/dev/null | wc -l | tr -d ' ')"
if (( STRUX_FILES == 0 )); then
  echo ""
  echo "No .strux source files found. This is expected before a benchmark run."
  echo "The openstrux generation path will create these files."
  echo ""
  echo "To run a benchmark:"
  echo "  1. Feed prompts/openstrux/generate.md to an LLM"
  echo "  2. The LLM writes .strux files and runs strux build"
  echo "  3. Run scripts/save-result.sh openstrux to archive results"
  exit 0
fi

echo "Found $STRUX_FILES .strux source files"
echo ""

# --- Parse, validate, generate ---
echo "Running strux build --explain..."
echo ""
(cd "$UC_DIR" && npx strux build --explain)
echo ""

# --- TypeScript check ---
echo "Running tsc --noEmit..."
if [[ -d "$UC_DIR/.openstrux/build" ]]; then
  (cd "$UC_DIR/app/web" && npx tsc --noEmit)
  echo "  TypeScript check passed."
else
  echo "  No build output found — skipping tsc check."
fi

echo ""

# --- Summary ---
echo "=== Demo Complete ==="
echo ""

if [[ -d "$UC_DIR/.openstrux/build" ]]; then
  BUILD_FILES="$(find "$UC_DIR/.openstrux/build" -type f | wc -l | tr -d ' ')"
  BUILD_LINES="$(find "$UC_DIR/.openstrux/build" -type f -exec cat {} + 2>/dev/null | wc -l | tr -d ' ')"
  echo "Generated: $BUILD_FILES files, $BUILD_LINES lines"
fi

echo "Source:    $STRUX_FILES .strux files"

# Token count if tiktoken available
if python3 -c "import tiktoken" 2>/dev/null; then
  STRUX_TOKENS="$(find "$UC_DIR/pipelines" "$UC_DIR/specs" -name '*.strux' -exec cat {} + | python3 -c "
import sys, tiktoken
enc = tiktoken.get_encoding('cl100k_base')
print(len(enc.encode(sys.stdin.read())))
")"
  echo "Tokens:    $STRUX_TOKENS (cl100k_base)"
fi

echo ""
echo "Next: run tests with 'cd $UC_DIR && pnpm test'"
