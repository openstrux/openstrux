#!/usr/bin/env bash
# Install all tools required across the Openstrux project.
# Run once per machine before any other bootstrap script.
# Supports: Ubuntu/Debian (apt), macOS (brew). Falls back to direct download.
set -euo pipefail

# ── PATH setup ────────────────────────────────────────────────────────────────
# Go binaries
export PATH="$PATH:/usr/local/go/bin:$HOME/go/bin"
# npm global binaries (nvm or prefix-based installs)
NPM_GLOBAL_BIN="$(npm root -g 2>/dev/null | sed 's|/node_modules||')/bin"
export PATH="$PATH:$NPM_GLOBAL_BIN"

# Persist PATH additions to ~/.bashrc
add_to_path() {
  local entry="$1"
  grep -qF "$entry" ~/.bashrc || echo "export PATH=\"\$PATH:$entry\"" >> ~/.bashrc
}
add_to_path "/usr/local/go/bin"
add_to_path "\$HOME/go/bin"
add_to_path "$NPM_GLOBAL_BIN"

OK=0
WARN=0
FAIL=0

ok()   { echo "  ✓ $*";  OK=$((OK + 1)); }
warn() { echo "  ⚠  $*"; WARN=$((WARN + 1)); }
fail() { echo "  ✗ $*" >&2; FAIL=$((FAIL + 1)); }

detect_os() {
  case "$(uname -s)" in
    Linux*)  echo "linux" ;;
    Darwin*) echo "macos" ;;
    *)       echo "unknown" ;;
  esac
}

OS=$(detect_os)

apt_install() {
  local pkg="$1"
  sudo apt-get install -y "$pkg" &>/dev/null
}

brew_install() {
  local pkg="$1"
  brew install "$pkg" &>/dev/null
}

install_via_os() {
  local pkg="$1"
  if [ "$OS" = "linux" ] && command -v apt-get &>/dev/null; then
    apt_install "$pkg"
  elif [ "$OS" = "macos" ] && command -v brew &>/dev/null; then
    brew_install "$pkg"
  else
    return 1
  fi
}

npm_global() {
  local pkg="$1" cmd="${2:-$1}"
  if ! command -v "$cmd" &>/dev/null; then
    echo "  → npm install -g $pkg"
    npm install -g "$pkg" &>/dev/null
  fi
  command -v "$cmd" &>/dev/null && ok "$cmd" || fail "$cmd (npm install -g $pkg failed)"
}

echo ""
echo "══════════════════════════════════════════════════════════════════════"
echo "  Openstrux — package installation"
echo "  OS: $OS"
echo "══════════════════════════════════════════════════════════════════════"

# ── Core tools ────────────────────────────────────────────────────────────────
echo ""
echo "── Core tools ───────────────────────────────────────────────────────"

# git
if command -v git &>/dev/null; then
  ok "git $(git --version | awk '{print $3}')"
else
  install_via_os git && ok "git" || fail "git — install manually"
fi

# gh (GitHub CLI)
if command -v gh &>/dev/null; then
  ok "gh $(gh --version | head -1 | awk '{print $3}')"
else
  if [ "$OS" = "linux" ]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg &>/dev/null
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      | sudo tee /etc/apt/sources.list.d/github-cli.list &>/dev/null
    sudo apt-get update &>/dev/null && apt_install gh
  elif [ "$OS" = "macos" ]; then
    brew_install gh
  fi
  command -v gh &>/dev/null && ok "gh" || fail "gh — see https://cli.github.com"
fi

# Node.js + npm
if command -v node &>/dev/null; then
  ok "node $(node --version)"
else
  warn "node not found — install via https://nodejs.org or nvm"
fi

if command -v npm &>/dev/null; then
  ok "npm $(npm --version)"
else
  fail "npm — required for markdownlint and TypeScript tooling"
fi

# Python 3
if command -v python3 &>/dev/null; then
  ok "python3 $(python3 --version | awk '{print $2}')"
else
  install_via_os python3 && ok "python3" || warn "python3 not found — required for Beam baselines"
fi

# pip
if command -v pip3 &>/dev/null; then
  ok "pip3"
else
  warn "pip3 not found — install python3-pip"
fi

# Go (required for OSV-Scanner)
if command -v go &>/dev/null; then
  ok "go $(go version | awk '{print $3}')"
else
  warn "go not found — required for OSV-Scanner (https://go.dev/dl)"
fi

# ── Documentation tools ───────────────────────────────────────────────────────
echo ""
echo "── Documentation tools ──────────────────────────────────────────────"

# markdownlint
npm_global markdownlint-cli markdownlint

# lychee (link checker)
if command -v lychee &>/dev/null; then
  ok "lychee $(lychee --version | head -1)"
else
  echo "  → installing lychee..."
  LYCHEE_URL="https://github.com/lycheeverse/lychee/releases/latest/download"
  if [ "$OS" = "linux" ]; then
    curl -sSLf "$LYCHEE_URL/lychee-x86_64-unknown-linux-gnu.tar.gz" \
      | sudo tar -xz -C /usr/local/bin lychee 2>/dev/null \
      && ok "lychee" || warn "lychee install failed — see https://github.com/lycheeverse/lychee"
  elif [ "$OS" = "macos" ]; then
    brew_install lychee && ok "lychee" || warn "lychee install failed"
  else
    warn "lychee — install manually: https://github.com/lycheeverse/lychee"
  fi
fi

# ── Security tools ────────────────────────────────────────────────────────────
echo ""
echo "── Security tools ───────────────────────────────────────────────────"

# OSV-Scanner (Google — CVE scan against lockfiles)
if command -v osv-scanner &>/dev/null; then
  ok "osv-scanner $(osv-scanner --version 2>/dev/null | head -1)"
else
  echo "  → installing osv-scanner..."
  if command -v go &>/dev/null; then
    go install github.com/google/osv-scanner/cmd/osv-scanner@latest &>/dev/null \
      && ok "osv-scanner" || warn "osv-scanner install failed"
    export PATH="$PATH:$(go env GOPATH)/bin"
  else
    LATEST=$(curl -s https://api.github.com/repos/google/osv-scanner/releases/latest | grep browser_download_url | grep linux_amd64 | cut -d '"' -f4 | head -1)
    if [ -n "$LATEST" ]; then
      curl -sSLf "$LATEST" -o /tmp/osv-scanner && sudo mv /tmp/osv-scanner /usr/local/bin/ \
        && sudo chmod +x /usr/local/bin/osv-scanner && ok "osv-scanner" \
        || warn "osv-scanner install failed — see https://github.com/google/osv-scanner"
    else
      warn "osv-scanner — install manually: https://github.com/google/osv-scanner"
    fi
  fi
fi

# cosign (Sigstore — artifact signing)
if command -v cosign &>/dev/null; then
  ok "cosign $(cosign version 2>/dev/null | grep GitVersion | awk '{print $2}')"
else
  echo "  → installing cosign..."
  if [ "$OS" = "linux" ]; then
    COSIGN_URL="https://github.com/sigstore/cosign/releases/latest/download/cosign-linux-amd64"
    curl -sSLf "$COSIGN_URL" -o /tmp/cosign \
      && sudo mv /tmp/cosign /usr/local/bin/cosign \
      && sudo chmod +x /usr/local/bin/cosign \
      && ok "cosign" || warn "cosign install failed — see https://github.com/sigstore/cosign"
  elif [ "$OS" = "macos" ]; then
    brew_install cosign && ok "cosign" || warn "cosign install failed"
  else
    warn "cosign — install manually: https://github.com/sigstore/cosign"
  fi
fi

# ── Benchmark tools ───────────────────────────────────────────────────────────
echo ""
echo "── Benchmark tools ──────────────────────────────────────────────────"

# Apache Beam Python SDK
if python3 -c "import apache_beam" &>/dev/null; then
  ok "apache-beam (Python)"
else
  echo "  → pip install apache-beam..."
  pip3 install apache-beam --quiet 2>/dev/null \
    && ok "apache-beam" || warn "apache-beam install failed — run: pip3 install apache-beam"
fi

# TypeScript + ts-node
npm_global typescript tsc
npm_global ts-node ts-node

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════════════"
printf "  ✓ %d installed   ⚠  %d warnings   ✗ %d failed\n" "$OK" "$WARN" "$FAIL"
echo "══════════════════════════════════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo "  Some required tools failed to install. Resolve before continuing."
  exit 1
fi
if [ "$WARN" -gt 0 ]; then
  echo "  Some optional tools are missing. Benchmarks or security scans may be limited."
fi
