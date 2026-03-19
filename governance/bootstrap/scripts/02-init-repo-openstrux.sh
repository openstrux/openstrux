#!/usr/bin/env bash
# Initialise openstrux repo — clone and configure local git settings.
# Files come from the repository; run 00-install-packages.sh first.
set -euo pipefail

REPO_URL="${1:-git@github.com:openstrux/openstrux.git}"
TARGET="${2:-$HOME/proj/openstrux}"

echo ""
echo "── Clone openstrux ──────────────────────────────────────────────────"
if [ -d "$TARGET/.git" ]; then
  echo "  → already cloned at $TARGET — skipping clone"
else
  git clone "$REPO_URL" "$TARGET"
fi
cd "$TARGET"

echo ""
echo "── Git configuration ────────────────────────────────────────────────"
git config commit.template .gitmessage
echo "  ✓ commit.template → .gitmessage"

echo ""
echo "✅ openstrux ready at $TARGET"
echo "   Run: cd $TARGET"
