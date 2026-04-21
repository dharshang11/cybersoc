# CyberSOC Global Deployment Playbook

**Goal:** Get `https://<your-app>.vercel.app` live with MongoDB Atlas + Render backend + Vercel frontend, in time for tomorrow morning's review.

**Estimated time:** 35–45 min end-to-end if nothing goes sideways.

---

## Your secrets (copy these — you'll paste them into Render in Phase 3)

Keep this file open in a second tab while deploying. **Do not commit these to GitHub.**

```
SECRET_KEY=ZLzc1Tq7qaniZ283QsRSNeLivAXZu4ucy9yr0VxNdUWmI7Uv_xiK-u9XIO_AlMR2
AGENT_API_KEY=agent_x7HnPpYBvw-ahHGgJHk1i6eOu43TlJx1
VAPID_PUBLIC_KEY=BCfopq960pSOB-ZwI8MIWgro64enqPN5G6zcuCpydYXuzhb_KNsHdnOqpsaQPpTlTqLE05JNcms5NdgUFxUkLSk
VAPID_PRIVATE_KEY=3sfyefzECNM-ztHwzQLE1LcEK9FrSlaxsOVw9f3t8TY
VAPID_SUBJECT=mailto:dharshanjr1101@gmail.com
ADMIN_EMAIL=dharshanjr1101@gmail.com
```

> These are freshly generated just now for your production deploy. The Procfile, CORS, and all the auth code is already shipped to use them.

---

## Phase 1 — Push everything to GitHub

Open Terminal on your Mac, `cd ~/Desktop/cyber`.

```bash
# 1. Make sure you're on main
git status
git branch

# 2. Stage every new/changed file from this session
git add backend/ frontend/ agent/ DEPLOY.md DEPLOY_PLAYBOOK.md DEMO_CHEATSHEET.md attack_simulator.py

# 3. Commit
git commit -m "Add auth (JWT+TOTP), RBAC, audit log, PWA, web push notifications"

# 4. Push
git push origin main
```

**Verify at:** https://github.com/dharshang11/cybersoc — you should see the new files (`backend/auth.py`, `backend/push.py`, `frontend/src/app/login/`, `frontend/public/sw.js`, etc.)

If git push asks for credentials, use your GitHub **Personal Access Token** (not password). Generate one at https://github.com/settings/tokens if needed.

---

## Phase 2 — MongoDB Atlas (free tier, ~8 min)

### 2a. Create cluster

1. Go to https://cloud.mongodb.com, sign up / log in with Google.
2. Click **+ New Project** → name it `CyberSOC` → Next → Create Project.
3. Click **+ Build a Database**.
4. Choose **M0 FREE** shared cluster.
5. Provider: **AWS**. Region: pick whichever is closest to your audience (e.g. `Mumbai ap-south-1`).
6. Cluster name: `cybersoc-cluster` → **Create Deployment**.

### 2b. Create database user

Atlas will prompt "How do you want to authenticate?"
- Choose **Username and Password**
- Username: `cybersoc`
- Click **Autogenerate Secure Password** → **copy it somewhere safe** (you'll need it in 30 seconds)
- Click **Create User**

### 2c. Network access

Same wizard:
- Select **My Local Environment** → **Add My Current IP Address** (for you to test)
- **Also important:** click "Add a Different IP Address" → enter `0.0.0.0/0` → description "Render / anywhere" → Add Entry.
  - This is safe because your DB is still password-protected; Render's IPs rotate so we can't whitelist a specific one on free tier.

Click **Finish and Close**.

### 2d. Get connection string

1. Click **Connect** on your cluster → **Drivers**.
2. Copy the URI. It looks like:
   ```
   mongodb+srv://cybersoc:<password>@cybersoc-cluster.XXXXX.mongodb.net/?retryWrites=true&w=majority
   ```
3. Replace `<password>` with the password you copied in step 2b.
4. Add `cybersoc` as the database name right before the `?`:
   ```
   mongodb+srv://cybersoc:YOUR_PASSWORD@cybersoc-cluster.XXXXX.mongodb.net/cybersoc?retryWrites=true&w=majority
   ```
5. **Save this as `MONGODB_URL`** — you'll paste into Render in Phase 3.

---

## Phase 3 — Render (backend, ~10 min)

### 3a. Sign up

1. Go to https://render.com → **Get Started** → sign in with GitHub.
2. Authorize Render to access your `dharshang11/cybersoc` repo.

### 3b. Create Web Service

1. Dashboard → **+ New** → **Web Service**.
2. Connect the `dharshang11/cybersoc` repo.
3. Fill in:
   | Field | Value |
   |---|---|
   | **Name** | `cybersoc-backend` |
   | **Region** | Same as your Atlas region (e.g. Singapore if you picked Mumbai) |
   | **Branch** | `main` |
   | **Root Directory** | `backend` |
   | **Runtime** | `Python 3` |
   | **Build Command** | `pip install -r requirements.txt` |
   | **Start Command** | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
   | **Instance Type** | **Free** |

### 3c. Environment variables

Scroll down to **Environment Variables** and add each of these one by one (click **Add Environment Variable**):

| Key | Value |
|---|---|
| `MONGODB_URL` | *paste the full connection string from Phase 2d* |
| `SECRET_KEY` | `ZLzc1Tq7qaniZ283QsRSNeLivAXZu4ucy9yr0VxNdUWmI7Uv_xiK-u9XIO_AlMR2` |
| `AGENT_API_KEY` | `agent_x7HnPpYBvw-ahHGgJHk1i6eOu43TlJx1` |
| `ADMIN_EMAIL` | `dharshanjr1101@gmail.com` |
| `VAPID_PUBLIC_KEY` | `BCfopq960pSOB-ZwI8MIWgro64enqPN5G6zcuCpydYXuzhb_KNsHdnOqpsaQPpTlTqLE05JNcms5NdgUFxUkLSk` |
| `VAPID_PRIVATE_KEY` | `3sfyefzECNM-ztHwzQLE1LcEK9FrSlaxsOVw9f3t8TY` |
| `VAPID_SUBJECT` | `mailto:dharshanjr1101@gmail.com` |
| `PYTHON_VERSION` | `3.11.9` |

### 3d. Deploy

Click **Create Web Service**. Wait ~4–6 min for the first build.

### 3e. Verify

When status is **Live**, copy the URL (looks like `https://cybersoc-backend.onrender.com`).

Test it:
```bash
curl https://cybersoc-backend.onrender.com/api/agent/health
# Should return: {"status":"healthy"}
```

In the Logs tab you should see `[DB] Connected to MongoDB!`.

> **Free tier quirk:** your backend sleeps after 15 min of idleness and takes 30-60s to wake up. Before the demo, hit `/api/agent/health` once to warm it.

---

## Phase 4 — Vercel (frontend, ~6 min)

### 4a. Create project

1. Go to https://vercel.com → Continue with GitHub.
2. **Add New Project** → Import `dharshang11/cybersoc`.
3. Framework Preset: **Next.js** (auto-detected).
4. **Root Directory:** click **Edit** → set to `frontend` → Continue.
5. Build Command / Output / Install Command: leave defaults.

### 4b. Environment variables

Before clicking Deploy, expand **Environment Variables** and add:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://cybersoc-backend.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `wss://cybersoc-backend.onrender.com/ws` |

*(Use your actual Render URL from Phase 3e. Note `wss://` not `ws://` — Render is HTTPS-only, so WebSockets must be secure.)*

### 4c. Deploy

Click **Deploy**. Wait ~3-4 min.

### 4d. Verify

When done, open the URL (e.g. `https://cybersoc-xxxx.vercel.app`).

You should see the **CyberSOC login page**. Sign up with `dharshanjr1101@gmail.com` → it'll pick you as admin because it matches `ADMIN_EMAIL` → you'll be pushed to `/setup-2fa` → scan with Google Authenticator → you're in.

---

## Phase 5 — Wire the agent to your live backend (~3 min)

The agent still needs to run somewhere to stream real telemetry. For the demo, easiest is to run it on your laptop pointed at the live backend.

On your Mac:

```bash
cd ~/Desktop/cyber/agent

# Set env vars (or create agent/.env with these two lines)
export BACKEND_URL="https://cybersoc-backend.onrender.com"
export API_KEY="agent_x7HnPpYBvw-ahHGgJHk1i6eOu43TlJx1"

# Run
source venv/bin/activate  # if you use a venv
python agent.py
```

You should see `[AGENT] -> POST 200` every 2 seconds.

Same pattern for the attack simulator when you want to force alerts:

```bash
cd ~/Desktop/cyber
export BACKEND_URL="https://cybersoc-backend.onrender.com"
export API_KEY="agent_x7HnPpYBvw-ahHGgJHk1i6eOu43TlJx1"
python attack_simulator.py
```

---

## Phase 6 — End-to-end smoke test (do this tonight, not morning-of)

On the Vercel URL, check each of these:

- [ ] **Register** a second analyst account (e.g. `analyst@test.com`) — it should become `analyst` role (not admin)
- [ ] **Log out**, **log in** again as admin → 2FA prompt → enter code → dashboard
- [ ] **Globe** renders, metrics stream in from the agent
- [ ] **Click SCAN NOW** → scan report populates
- [ ] **Run attack_simulator.py** → globe flashes, INSANE ALERT overlay drops
- [ ] **Enable push** via the bell icon (top right) → grant permission → close the tab → run simulator again → notification pops on your phone if you installed the PWA on Android; on iOS, add to Home Screen first
- [ ] **Log in as analyst** (second browser profile) → SCAN NOW button is gone, replaced with "VIEW-ONLY · ADMIN REQUIRED" chip
- [ ] **Log back in as admin** → click **AUDIT** top-right → full log of every action you just performed

---

## Troubleshooting cheatsheet

| Symptom | Likely cause / fix |
|---|---|
| Frontend loads but login 500s | Check Render Logs — almost always a missing env var; re-check Phase 3c |
| "Invalid or expired token" after 2FA | Atlas `0.0.0.0/0` IP access not added — redo Phase 2c |
| WebSocket won't connect | `NEXT_PUBLIC_WS_URL` must be `wss://` (not `ws://`); redeploy Vercel after fixing |
| Push notification doesn't fire | Browser permission denied — go to site settings → allow notifications → toggle bell again |
| Render says "Port scan timeout" | Your Start Command must use `$PORT` (already correct in `Procfile` and Phase 3b) |
| CORS error in browser console | Backend already has `allow_origins=["*"]`; if it's broken, hard-refresh Vercel to pull new build |
| Everything is slow on first load | Render free tier cold start — hit `/api/agent/health` 30s before demo |

---

## Morning-of warmup (5 min before the panel walks in)

```bash
# Wake Render
curl https://cybersoc-backend.onrender.com/api/agent/health

# Warm Vercel
open https://cybersoc-xxxx.vercel.app

# Start local agent
cd ~/Desktop/cyber/agent && export BACKEND_URL=... && export API_KEY=... && python agent.py
```

Then:
1. Log in on laptop → 2FA → dashboard up
2. Enable push on phone (open site on phone → bell → allow)
3. Test simulator fires one critical alert to confirm everything is live
4. Clear the test alert from the UI
5. You're green.

---

Good luck tomorrow. You've got this.
