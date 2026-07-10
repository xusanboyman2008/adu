# Coursera Runner — Render.com Deployment Guide

Automated headless Coursera completion runner using Node.js + Playwright stealth, ready to deploy on [Render.com](https://render.com).

---

## How it works

```
npm install
  └─ scripts/postinstall.js   ← installs Playwright Chromium + system deps automatically

npm start
  └─ server.js                ← keep-alive HTTP server (listens on $PORT for Render)
       ├─ GET /               ← health check (JSON status)
       ├─ GET /health         ← health check
       ├─ GET /ping           ← self-ping target (keep-alive)
       ├─ GET /status         ← detailed worker status
       └─ spawns → coursera_manual_runner.js  (headless, MODE=auto)
```

The HTTP server **self-pings** every **14 minutes** to prevent Render's free-tier from spinning down (free tier idles after 15 min of no traffic).

---

## Deploy to Render in 5 steps

### 1. Push this repo to GitHub / GitLab
```bash
git add .
git commit -m "render-ready deployment"
git push
```

### 2. Create a new Web Service on Render
- Go to https://render.com → **New → Web Service**
- Connect your GitHub repo
- Render will auto-detect `render.yaml` and fill in all settings

### 3. Set secret environment variables in the Render Dashboard
| Variable | Value |
|---|---|
| `COORDINATOR_URL` | Your Google Apps Script exec URL |
| `PC_ID` | A friendly name, e.g. `render-1` |

> **Do NOT put your `COORDINATOR_URL` in `render.yaml`** — set it as a secret in the dashboard.

### 4. Deploy
Click **Create Web Service**. Render will:
1. Run `npm install` (which auto-installs Playwright Chromium via `postinstall.js`)
2. Run `npm start` (which launches the keep-alive server + Playwright worker)

### 5. Verify
Visit your Render URL:
- `https://your-app.onrender.com/` — should return `{"ok": true, ...}`
- `https://your-app.onrender.com/status` — shows worker process status

---

## Local development

```bash
# First-time setup
npm install            # also installs Playwright Chromium automatically

# Run headless auto mode (same as Render)
npm start

# Run headless worker only (no HTTP server)
npm run worker

# Run with visible browser (for debugging)
npm run auto

# Safe smoke test (no enroll/submit)
npm run diagnose

# Headless auto mode (explicit)
npm run auto:headless
```

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `COORDINATOR_URL` | _(required)_ | Google Apps Script URL for the student queue |
| `PC_ID` | `render-1` | Friendly name for this instance |
| `MODE` | `auto` | `auto` / `diagnose` / `manual` |
| `HEADLESS` | `y` | `y` = headless, `n` = visible browser (needs display) |
| `CONCURRENCY` | `1` | Parallel browser sessions per process |
| `SPEED` | `1` | Timeout multiplier (2 = 2× slower for VPN/slow networks) |
| `VPN` | `n` | `y` = enable Browsec VPN extension |
| `CERT_ATTEMPTS` | `12` | How many times to poll for the certificate |
| `CERT_WAIT_MS` | `15000` | ms between certificate poll attempts |
| `PORT` | `3000` | HTTP server port (Render sets this automatically) |
| `RENDER_EXTERNAL_URL` | _(set by Render)_ | Used for self-ping URL |

---

## Upgrade from free to paid tier

On the free tier, even with self-pinging Render may occasionally restart the service.  
Upgrade to **Starter ($7/mo)** for always-on, no spin-down instances.

---

## Troubleshooting

**Playwright browser not found**  
Run `npm run install-browsers` manually or check the build logs for the `postinstall` step.

**Worker not starting**  
Visit `/status` on your Render URL. Check that `COORDINATOR_URL` is set correctly in the Render dashboard.

**CloudFront 403 errors**  
Coursera blocks datacenter IPs. Use a residential proxy via `PROXY=http://user:pass@host:port` env var, or enable a VPN (`VPN=y` + `BROWSEC_EXTENSION_PATH`).
