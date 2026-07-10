#!/usr/bin/env bash
# build.sh — Render.com build script
#
# Installs npm deps + Playwright Chromium browser INTO the project directory
# (/opt/render/project/src/pw-browsers) so the binary is included in the
# uploaded build snapshot and available at runtime.
#
# Why not ~/.cache? Render uploads only the project dir; ~/.cache is discarded
# after the build, so browsers installed there are gone by the time the
# container starts.

set -euo pipefail

# ── 1. Install browsers inside the project dir ────────────────────────────────
export PLAYWRIGHT_BROWSERS_PATH="$(pwd)/pw-browsers"
echo "==> PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"

# ── 2. Install npm dependencies ───────────────────────────────────────────────
echo "==> npm install..."
npm install --prefer-offline 2>/dev/null || npm install

# ── 3. Install Playwright Chromium into the project dir ──────────────────────
echo "==> Installing Playwright Chromium browser..."
PW_CLI="$(pwd)/node_modules/playwright/cli.js"

if [ -f "$PW_CLI" ]; then
  # --with-deps needs root (will fail on Render free tier — that's OK)
  node "$PW_CLI" install chromium --with-deps 2>/dev/null || \
  node "$PW_CLI" install chromium
else
  npx playwright install chromium --with-deps 2>/dev/null || \
  npx playwright install chromium
fi

echo "==> Build complete. Browser path contents:"
ls -lh "$PLAYWRIGHT_BROWSERS_PATH" 2>/dev/null || echo "(empty — install may have failed)"
