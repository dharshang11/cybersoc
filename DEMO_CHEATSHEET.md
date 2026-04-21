# CyberSOC — Demo Cheatsheet

**Review:** April 22, 2026 (tomorrow morning)

## 30-second elevator pitch

> *"CyberSOC is an AI-powered Security Operations Center that turns one laptop into a real-time threat detection node. A lightweight agent streams live CPU/network/Wi-Fi telemetry to a FastAPI backend, which runs rule-based detection and pushes alerts to a cinematic Next.js dashboard — and straight to my phone as mobile push notifications. It's secured behind email/password plus Google Authenticator 2FA, with role-based access so analysts can watch and admins can act. Every sensitive action is audit-logged."*

## The three headline features to show

1. **Phone-based 2FA login** — I register, scan a QR into Google Authenticator, enter the 6-digit code. That's the gate to the SOC.
2. **Live threat intelligence** — trigger the attack simulator; critical alerts fire on the Three.js globe and my phone buzzes with a push notification in real time.
3. **Role-based separation of duties** — analyst account sees everything but cannot trigger a deep scan; admin account has the SCAN NOW button plus the AUDIT log view.

## Run order on demo day

```bash
# 1. Backend
cd backend
source venv/bin/activate  # or recreate venv
uvicorn main:app --host 0.0.0.0 --port 8000

# 2. Frontend (new terminal)
cd frontend
npm run dev

# 3. Agent (new terminal) — streams telemetry
cd agent
python agent.py

# 4. Optional: attack simulator to force alerts
python attack_simulator.py
```

Open `http://localhost:3000`.

## Demo script (≈4 min)

**Setup before panel walks in:**
- Backend, frontend, agent all running locally
- Have two browser profiles open: admin session in one, analyst in the other (or use incognito)
- Have your phone unlocked with Google Authenticator open

**Live walkthrough:**

1. **(0:00) Log in.** Open `/login`. Enter admin creds → prompt goes to 2FA screen → glance at phone → type 6-digit code → dashboard loads.
2. **(0:30) The globe.** "This is the threat map — each connection is a geolocation attempt plotted on Three.js."
3. **(1:00) Deep scan.** Click **SCAN NOW** (or show open-palm gesture via webcam) → agent runs full telemetry sweep → scan report renders.
4. **(2:00) Trigger an attack.** Run `python attack_simulator.py` in a visible terminal. Explain: "The simulator is emulating port-scan / malicious connection signatures."
5. **(2:30) Critical alert fires.** Globe pulses red, the INSANE ALERT overlay drops, AND **your phone buzzes** with a push notification. Hold phone up to camera.
6. **(3:00) Role gap.** Switch to analyst browser profile. Same dashboard, but the SCAN NOW button is replaced with *"VIEW-ONLY · ADMIN REQUIRED"*.
7. **(3:30) Audit log.** Switch back to admin, click **AUDIT** in the top bar. "Every login, 2FA attempt, scan trigger — time-stamped and attributed."

## Tech talking points (for Q&A)

**Stack**
- FastAPI + Motor (async Mongo) + in-memory fallback for zero-dependency demo
- Next.js 16 + React 19, Three.js globe, MediaPipe hand-gesture control
- Python agent using psutil, uploads via signed API key

**Security choices**
- Password hashing: **bcrypt via passlib** (work factor automatically tuned)
- Session: **JWT HS256**, 12-hour expiry, carried in `Authorization: Bearer` header
- 2FA: **TOTP (RFC 6238)** using `pyotp`, time-window = ±1 step for clock drift, QR code compatible with Google Authenticator / Authy / 1Password
- **RBAC enforced at three layers:** REST endpoint dependency (`require_role("admin")`), WebSocket token-gated `TRIGGER_DEEP_SCAN`, and UI hides the button client-side
- Audit log is append-only; admin-only read via `GET /api/audit`
- Web Push uses **VAPID** with P-256 keypair; server dispatches via `pywebpush`

**Resilience**
- Mongo goes down? Auth, audit, push subscriptions all fall back to in-memory stores so the app never hard-crashes in the demo.
- Agent timeouts (15s/30s) + retry loop handle free-tier backend cold starts.
- Service worker caches the shell + icons for offline / flaky-wifi demos.

**PWA**
- `manifest.webmanifest`, `sw.js`, 192/512 icons → installable on Android/iOS home screen.
- `notificationclick` handler focuses or opens the dashboard.

## Likely questions + crisp answers

- *"Why rule-based detection instead of ML?"* — The engine layer is pluggable; current MVP ships 8 hand-tuned heuristic rules (port-scan, unusual process, external connection count, etc.). Swapping in an isolation-forest model is a single file change.
- *"Why TOTP over SMS?"* — TOTP is offline, phishing-resistant, and free. SMS is SIM-swap-vulnerable.
- *"Why localStorage for the JWT?"* — Trade-off. XSS-safe option is httpOnly cookies; localStorage is simpler for a demo and the scope is personal-machine-only. In prod I'd move to httpOnly + CSRF token.
- *"First-user-becomes-admin logic?"* — Currently opt-in via `ADMIN_EMAIL` env var; guarantees no accidental admin escalation.
- *"Horizontal scale?"* — The WebSocket manager is a single-process in-memory set — would move to Redis pub/sub to scale past one pod.

## If something breaks mid-demo

| Breakage | Fallback |
|---|---|
| Agent crashes | The dashboard still works — metrics freeze but the globe, alerts history, and audit log all stay up |
| Push notification doesn't fire | Show the CRITICAL banner + globe pulse — that's the same alert path, push is the extra-credit channel |
| Mongo unreachable | App auto-falls-back to in-memory stores; no user-visible change |
| 2FA code rejected | `valid_window=1` already forgives ±30s drift; if laptop clock is off, reset via `/setup-2fa` |

## One-liner for the slide

> **CyberSOC: Real-time threat telemetry → AI detection → phone-authenticated, role-aware command console, with live push alerts to any device.**
