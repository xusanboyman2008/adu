#!/usr/bin/env bash
# build.sh — Render.com build script
#
# KEY INSIGHT: Render uploads only /opt/render/project/src/ as the build artifact.
# ~/.cache is DISCARDED after the build phase, so Playwright browsers installed
# there are gone by the time the container starts.
#
# Fix: install browsers into ./pw-browsers (inside the project dir) so they
# are included in the uploaded snapshot and available at runtime.

set -euo pipefail

# Must match PLAYWRIGHT_BROWSERS_PATH in render.yaml envVars
export PLAYWRIGHT_BROWSERS_PATH="/opt/render/project/src/pw-browsers"
echo "==> PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"
mkdir -p "$PLAYWRIGHT_BROWSERS_PATH"

# Install npm dependencies
echo "==> npm install..."
npm install

# Install Playwright Chromium into the project dir
echo "==> Installing Playwright Chromium into $PLAYWRIGHT_BROWSERS_PATH ..."
PW_CLI="$(pwd)/node_modules/playwright/cli.js"

if [ -f "$PW_CLI" ]; then
  # --with-deps needs root (fails on Render — that's OK, binary-only is enough)
  node "$PW_CLI" install chromium --with-deps 2>/dev/null \
    || node "$PW_CLI" install chromium
else
  npx playwright install chromium --with-deps 2>/dev/null \
    || npx playwright install chromium
fi

echo ""
echo "==> Browser install complete. Contents of pw-browsers/:"
ls -lh "$PLAYWRIGHT_BROWSERS_PATH"
