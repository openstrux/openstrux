#!/usr/bin/env bash
# Initialise openstrux-spec repo — clone and configure local git settings.
# Files come from the repository; run 00-install-packages.sh first.
set -euo pipefail

REPO_URL="${1:-git@github.com:openstrux/openstrux-spec.git}"
TARGET="${2:-$HOME/proj/openstrux-spec}"

echo ""
echo "── Clone openstrux-spec ─────────────────────────────────────────────"
if [ -d "$TARGET/.git" ]; then
  echo "  → already cloned at $TARGET — skipping clone"
else
  git clone "$REPO_URL" "$TARGET"
fi
cd "$TARGET"

echo ""
echo "── Git configuration ────────────────────────────────────────────────"
git config core.hooksPath .githooks
echo "  ✓ core.hooksPath → .githooks"

chmod +x .githooks/pre-push
echo "  ✓ .githooks/pre-push executable"

echo ""
echo "── Verify Level 1 tools ─────────────────────────────────────────────"
check_cmd() {
  local cmd="$1" hint="$2"
  if command -v "$cmd" &>/dev/null; then
    echo "  ✓ $cmd"
  else
    echo "  ✗ $cmd missing — $hint" >&2
  fi
}
check_cmd markdownlint "npm install -g markdownlint-cli"
check_cmd lychee       "see https://github.com/lycheeverse/lychee"

echo ""
echo "✅ openstrux-spec ready at $TARGET"
echo "   Run: cd $TARGET"
