# CyberSOC — Live Deployment Checklist

Target: live, globally reachable dashboard in ~45 minutes.

Architecture:
```
Your laptop (agent + simulator)  ──HTTP──►  Render (FastAPI backend)  ◄──WebSocket──  Vercel (Next.js UI)
                                                        │
                                                        └──────►  MongoDB Atlas
```

---

## Step 0 — Accounts you need (free tiers)

Sign up now if you don't already have them (2 min each):

1. GitHub — https://github.com/signup
2. MongoDB Atlas — https://cloud.mongodb.com
3. Render — https://render.com (sign in with GitHub)
4. Vercel — https://vercel.com (sign in with GitHub)

---

## Step 1 — Push code to GitHub

1. Go to https://github.com/new
   - Repository name: `cybersoc` (or anything)
   - Keep it **Public** (Render/Vercel free tier works easier with public)
   - **Do NOT** initialize with README, .gitignore, or license — we already have these
   - Click **Create repository**
2. Copy the HTTPS URL, e.g. `https://github.com/YOURNAME/cybersoc.git`
3. Back in your project folder, run:
   ```bash
   cd /path/to/cyber
   git add .
   git commit -m "Initial CyberSOC commit"
   git branch -M main
   git remote add origin https://github.com/YOURNAME/cybersoc.git
   git push -u origin main
   ```

⚠️ Confirm `.env` files are NOT pushed: run `git status` and make sure no `.env` appears. They are gitignored already.

---

## Step 2 — MongoDB Atlas (5 min)

1. https://cloud.mongodb.com → **Create** → **Shared (M0 Free)** → pick any region close to you → **Create Cluster**
2. Wait ~3 min for provisioning
3. **Database Access** → Add New Database User → username/password (save these)
4. **Network Access** → Add IP Address → **Allow Access from Anywhere** (`0.0.0.0/0`)
5. **Database** → Connect → **Drivers** → copy the connection string. Looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<password>` with your actual password.
6. Append `/cybersoc` before the `?` so it uses our database:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/cybersoc?retryWrites=true&w=majority
   ```

Save this string — you'll paste it into Render next.

---

## Step 3 — Deploy Backend to Render (5 min)

1. https://dashboard.render.com → **New +** → **Web Service**
2. **Connect** your GitHub repo (authorize if prompted)
3. Configuration:
   - **Name**: `cybersoc-backend`
   - **Region**: same as Atlas region
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - **Plan**: `Free`
4. Scroll down → **Environment Variables** → add:
   - `MONGODB_URL` = your Atlas string from Step 2
   - `AGENT_API_KEY` = `agent_secret_key` (keep this — agent & simulator default to it)
5. Click **Create Web Service** → wait ~3-5 min for first build
6. Once green, copy the URL: `https://cybersoc-backend.onrender.com`
7. **Test it**: open `https://cybersoc-backend.onrender.com/api/agent/health` in a browser → should return `{"status":"healthy"}`

---

## Step 4 — Deploy Frontend to Vercel (3 min)

1. https://vercel.com/new → import your GitHub repo
2. Configuration:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: click **Edit** → select `frontend`
3. Expand **Environment Variables** and add:
   - `NEXT_PUBLIC_WS_URL` = `wss://cybersoc-backend.onrender.com/ws`  ← note the `wss://`
   - `NEXT_PUBLIC_API_URL` = `https://cybersoc-backend.onrender.com`
4. Click **Deploy** → wait ~2 min
5. Copy your live URL: `https://cybersoc-XXXX.vercel.app`

---

## Step 5 — Point your local agent & simulator at the live backend

On your laptop:

**`agent/.env`** — replace the BACKEND_URL:
```
BACKEND_URL=https://cybersoc-backend.onrender.com
API_KEY=agent_secret_key
POLL_INTERVAL=2
```

**Root `.env`** (create new file next to `attack_simulator.py`):
```
BACKEND_URL=https://cybersoc-backend.onrender.com
API_KEY=agent_secret_key
```

Install deps (if not already):
```bash
# Agent
cd agent && pip install -r requirements.txt && cd ..

# Simulator (uses top-level requirements.txt)
pip install -r requirements.txt
```

---

## Step 6 — End-to-end smoke test

**Terminal 1 — run agent:**
```bash
cd agent
python3 agent.py
```
Expected: `[*] Starting SOC Agent... sending to https://cybersoc-backend.onrender.com`
Then `[+] Sent | Alerts: 0 | Procs: 25 | ...`

**Browser tab — open your live Vercel URL.**
You should see the dashboard connect, live CPU/RAM gauges update, processes stream in, and your WiFi info.

**Terminal 2 — run simulator to generate alerts:**
```bash
python3 attack_simulator.py
```
Expected: simulated nmap/metasploit/etc. attacks show as Critical alerts on the dashboard.

---

## ⚠️ Gotchas

- **Render free tier sleeps after 15 min of idle.** First request after idle takes 30-60s to wake the service (the simulator has a wake-up retry loop now). For your live demo, hit the health URL a few minutes before review starts to warm it up.
- **WebSocket must be `wss://` not `ws://`** when the frontend is HTTPS (Vercel is always HTTPS).
- **CORS is `*`** — fine for demo. Tighten after.
- **Don't commit `.env`** — already gitignored, but double-check.

---

## Demo script (for review)

1. "This is CyberSOC — an AI-powered Security Operations Center."
2. Open the live Vercel URL on the projector.
3. "The backend is on Render, database on MongoDB Atlas, frontend on Vercel — globally reachable."
4. "This agent right here on my laptop is streaming real-time metrics — CPU, RAM, processes, WiFi, network connections — to the cloud backend."
5. Run `attack_simulator.py` → watch the alerts light up on screen.
6. Click "Deep Scan" on the dashboard → scan report appears.
7. Stop. Take questions.
