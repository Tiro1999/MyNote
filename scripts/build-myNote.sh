#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# scripts/build-myNote.sh
#
# Installs dependencies, runs security audits, then builds the application.
#
# Dependency install
#   • package-lock.json exists → npm ci  (reproducible, CI-safe)
#   • package-lock.json absent → npm install (creates the lockfile; commit it!)
#
# Audit rules
#   • npm audit (all deps, incl. dev)  → always runs; output is informational,
#                                         never blocks the build
#   • npm audit --omit=dev (prod only) → blocks the build on any finding;
#                                         these packages ship to end-users
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$SCRIPT_DIR/../application"

cd "$APP_DIR"

NODE_VER="$(node --version)"
NPM_VER="$(npm --version)"
V8_VER="$(node -e 'process.stdout.write(process.versions.v8)')"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MyNote Build"
echo "  Node ${NODE_VER}  |  npm ${NPM_VER}  |  V8 ${V8_VER}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Install / restore dependencies ────────────────────────────────────────
echo ""
echo "▶  1/4  Dependencies"
if [ -f package-lock.json ]; then
  npm ci
else
  echo "  ⚠️  No package-lock.json found — running 'npm install' to create one."
  echo "      Commit application/package-lock.json before the next release."
  npm install
fi

# ── 2. Audit — all dependencies (dev + prod) — informational ─────────────────
echo ""
echo "▶  2/4  npm audit  (all deps — informational, non-blocking)"
npm audit --json > audit-all.json 2>&1 || true
npm audit              || true
echo "        Full JSON report → application/audit-all.json"

# ── 3. Audit — production / release dependencies — BUILD-CRITICAL ────────────
echo ""
echo "▶  3/4  npm audit --omit=dev  (production deps — build-critical)"
if ! npm audit --omit=dev; then
  echo ""
  echo "  ╔══════════════════════════════════════════════════════════╗"
  echo "  ║  ❌  Production dependency audit FAILED                 ║"
  echo "  ║  Vulnerabilities found in packages shipped to users.    ║"
  echo "  ║  Fix them before releasing:                             ║"
  echo "  ║    cd application && npm audit fix --omit=dev           ║"
  echo "  ╚══════════════════════════════════════════════════════════╝"
  exit 1
fi
echo "        ✅  Production dependency audit passed."

# ── 4. Build ──────────────────────────────────────────────────────────────────
echo ""
echo "▶  4/4  electron-vite build"
npm run build

# Record the exact runtime versions used for this build (fed into SBOM)
{
  echo "node=${NODE_VER}"
  echo "npm=${NPM_VER}"
  echo "v8=${V8_VER}"
} > runtime-versions.txt

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  Build complete"
echo "      Output:           application/out/"
echo "      Runtime versions: application/runtime-versions.txt"
echo "      Audit report:     application/audit-all.json"
echo "  To package:  cd application && npm run dist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"