#!/usr/bin/env node
/**
 * server.js  —  Keep-alive HTTP server for Render.com
 *
 * Render's "Web Service" type requires a process that listens on PORT.
 * This tiny Express-free HTTP server satisfies that requirement while the
 * main Playwright worker runs in the background.
 *
 * It also self-pings every 14 minutes so the free-tier Render instance
 * never idles / sleeps (free tier spins down after 15 min of inactivity).
 *
 * ┌─────────────────────────────────────────────────────────┐
 * │  GET /          → health check (200 OK + JSON status)  │
 * │  GET /health    → same                                  │
 * │  GET /ping      → simple pong                          │
 * │  GET /status    → worker process status                │
 * └─────────────────────────────────────────────────────────┘
 *
 * Usage (set as the npm start command):
 *   node server.js
 */

"use strict";

const http = require("http");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

// ── Config ────────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 3000;
const SELF_URL = process.env.RENDER_EXTERNAL_URL
  ? `${process.env.RENDER_EXTERNAL_URL}/ping`
  : `http://localhost:${PORT}/ping`;

// How often to self-ping in ms (14 min < Render's 15-min idle cutoff)
const PING_INTERVAL_MS = 14 * 60 * 1000;

// ── Worker state ──────────────────────────────────────────────────────────────
let workerProcess = null;
let workerStatus = "starting";
let workerStartTime = null;
let workerRestarts = 0;
let lastPingAt = null;
let lastPingOk = null;

// ── Spawn the Playwright worker ───────────────────────────────────────────────
function startWorker() {
  const runnerPath = path.join(__dirname, "coursera_manual_runner.js");

  if (!fs.existsSync(runnerPath)) {
    console.error("[server] coursera_manual_runner.js not found — worker not started.");
    workerStatus = "missing_runner";
    return;
  }

  const env = {
    ...process.env,
    MODE: process.env.MODE || "auto",
    HEADLESS: process.env.HEADLESS || "y",
  };

  console.log(`[server] Spawning worker (restart #${workerRestarts})…`);
  workerProcess = spawn("node", [runnerPath], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    cwd: __dirname,
  });
  workerStartTime = new Date().toISOString();
  workerStatus = "running";

  workerProcess.stdout.on("data", (d) => process.stdout.write(d));
  workerProcess.stderr.on("data", (d) => process.stderr.write(d));

  workerProcess.on("exit", (code, signal) => {
    workerStatus = code === 0 ? "exited_ok" : `exited(${code ?? signal})`;
    console.log(`[server] Worker exited: ${workerStatus}`);
    workerProcess = null;

    // Auto-restart after 10 s unless it exited cleanly
    if (code !== 0) {
      workerRestarts += 1;
      console.log(`[server] Restarting worker in 10 s…`);
      setTimeout(startWorker, 10_000);
    }
  });

  workerProcess.on("error", (err) => {
    workerStatus = `error: ${err.message}`;
    console.error("[server] Worker error:", err.message);
  });
}

// ── HTTP server ───────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  // ── /ping  (keep-alive target) ────────────────────────────────────────────
  if (url === "/ping") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("pong");
    return;
  }

  // ── /status ───────────────────────────────────────────────────────────────
  if (url === "/status") {
    const payload = JSON.stringify({
      worker: workerStatus,
      workerPid: workerProcess?.pid ?? null,
      workerStartTime,
      workerRestarts,
      lastPingAt,
      lastPingOk,
      uptime: process.uptime(),
    }, null, 2);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(payload);
    return;
  }

  // ── / and /health ─────────────────────────────────────────────────────────
  if (url === "/" || url === "/health") {
    const payload = JSON.stringify({
      ok: true,
      service: "coursera-runner",
      worker: workerStatus,
      uptime: Math.round(process.uptime()),
      lastPingAt,
      message: "Keep-alive server is running. Worker is processing students.",
    }, null, 2);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(payload);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

// ── Self-pinger (prevents Render free-tier idle spin-down) ───────────────────
function selfPing() {
  const urlObj = new URL(SELF_URL);
  const mod = urlObj.protocol === "https:" ? require("https") : require("http");

  const req = mod.get(SELF_URL, { timeout: 10_000 }, (res) => {
    lastPingAt = new Date().toISOString();
    lastPingOk = res.statusCode === 200;
    console.log(`[keep-alive] ping → ${SELF_URL}  status=${res.statusCode}`);
    res.resume(); // drain
  });

  req.on("error", (err) => {
    lastPingAt = new Date().toISOString();
    lastPingOk = false;
    console.warn(`[keep-alive] ping failed: ${err.message}`);
  });

  req.end();
}

// ── Boot ──────────────────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Keep-alive HTTP server listening on port ${PORT}`);
  console.log(`[server] Self-ping URL: ${SELF_URL}`);
  console.log(`[server] Self-ping interval: ${PING_INTERVAL_MS / 60_000} min`);

  // Start pinging after first minute, then every PING_INTERVAL_MS
  setTimeout(() => {
    selfPing();
    setInterval(selfPing, PING_INTERVAL_MS);
  }, 60_000);

  // Give the server a moment to be fully ready, then start the worker
  setTimeout(startWorker, 2_000);
});

server.on("error", (err) => {
  console.error("[server] HTTP server error:", err.message);
});
