#!/usr/bin/env node
/**
 * scripts/postinstall.js
 *
 * Runs automatically after `npm install`.
 * Installs Playwright Chromium + OS system libraries so the project
 * is ready to run immediately — no manual "npx playwright install" needed.
 *
 * On Render.com this executes during the build phase, so the browser
 * binaries are baked into the build image and available at runtime.
 */

"use strict";

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "..");
const PW_CLI = path.join(ROOT, "node_modules", "playwright", "cli.js");

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT, ...opts });
    return true;
  } catch (e) {
    console.error(`[postinstall] command failed (exit ${e.status}): ${cmd}`);
    return false;
  }
}

// ── 1. Resolve the Playwright CLI ─────────────────────────────────────────────
const pw = fs.existsSync(PW_CLI) ? `node "${PW_CLI}"` : "npx playwright";

console.log("\n=== postinstall: installing Playwright Chromium browser ===");

// ── 2. Try --with-deps (installs OS libs too, needs root / sudo) ─────────────
const ok =
  run(`${pw} install chromium --with-deps`) ||
  run(`${pw} install chromium`);

if (!ok) {
  console.warn(
    "[postinstall] WARNING: Playwright browser install failed.\n" +
    "  Run  npx playwright install chromium --with-deps  manually before starting."
  );
  // Don't hard-exit; the rest of npm install should still complete.
}

// ── 3. Ensure node_modules/.bin shims are executable ─────────────────────────
//    ZIP extractions and some CI environments strip the +x bit.
const binDir = path.join(ROOT, "node_modules", ".bin");
if (fs.existsSync(binDir)) {
  for (const name of fs.readdirSync(binDir)) {
    const full = path.join(binDir, name);
    try {
      const mode = fs.statSync(full).mode;
      fs.chmodSync(full, mode | 0o111);
    } catch {
      // ignore
    }
  }
}

console.log("=== postinstall: done ===\n");
