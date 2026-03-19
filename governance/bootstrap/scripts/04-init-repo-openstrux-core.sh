#!/usr/bin/env bash
# Initialise openstrux-core repo — clone and configure local git settings.
# Files come from the repository; run 00-install-packages.sh first.
set -euo pipefail

REPO_URL="${1:-git@github.com:openstrux/openstrux-core.git}"
TARGET="${2:-$HOME/proj/openstrux-core}"

echo ""
echo "── Clone openstrux-core ─────────────────────────────────────────────"
if [ -d "$TARGET/.git" ]; then
  echo "  → already cloned at $TARGET — skipping clone"
else
  git clone "$REPO_URL" "$TARGET"
fi
cd "$TARGET"

echo ""
echo "── Git configuration ────────────────────────────────────────────────"
# core uses the root .gitmessage from openstrux if symlinked, otherwise inline
if [ -f .gitmessage ]; then
  git config commit.template .gitmessage
  echo "  ✓ commit.template → .gitmessage"
else
  echo "  ⚠  no .gitmessage found — add one or symlink from openstrux"
fi

echo ""
echo "── Verify toolchain ─────────────────────────────────────────────────"
check_cmd() {
  local cmd="$1" hint="$2"
  if command -v "$cmd" &>/dev/null; then
    echo "  ✓ $cmd"
  else
    echo "  ✗ $cmd missing — $hint" >&2
  fi
}
check_cmd node        "https://nodejs.org"
check_cmd npm         "https://nodejs.org"
check_cmd python3     "https://python.org"
check_cmd osv-scanner "https://github.com/google/osv-scanner"

echo ""
echo "✅ openstrux-core ready at $TARGET"
echo "   Run: cd $TARGET"
