#!/usr/bin/env bash
set -euo pipefail

# view-results.sh — Generate and open the static benchmark report.
#
# Reads benchmarks/viewer.config.json, aggregates results from all
# configured use-case repos, writes benchmarks/viewer/report.html,
# and opens it in the default browser.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENSTRUX_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT="$OPENSTRUX_ROOT/benchmarks/viewer/report.html"

echo "Generating report..."
node --experimental-strip-types \
  "$OPENSTRUX_ROOT/benchmarks/viewer/generate-report.ts"

echo ""
echo "Opening: file://$REPORT"

if command -v xdg-open &>/dev/null; then
  xdg-open "file://$REPORT"
elif command -v open &>/dev/null; then
  open "$REPORT"
else
  echo "Open manually: file://$REPORT"
fi
