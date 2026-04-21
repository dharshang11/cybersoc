import os
import json as _json
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from models import (
    AgentPayload, Alert, ScanReport,
    UserRegister, UserLogin, TotpVerify, TotpSetupRequest, PushSubscription
)
from database import (
    test_db_connection, insert_log, get_logs,
    find_user_by_email, create_user, update_user, add_audit,
    add_push_subscription, get_push_subscriptions, remove_push_subscription,
)
from engine import evaluate_payload
from sockets import manager
from auth import (
    hash_password, verify_password,
    create_access_token, decode_access_token, get_current_user, require_role,
    generate_totp_secret, verify_totp, build_totp_qr_data_url,
)
from push import send_push_to_all
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="CyberSOC Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AGENT_TOKEN = os.getenv("AGENT_API_KEY", "agent_secret_key")

# Global state for scan requests
scan_state = {
    "requested": False,
    "in_progress": False,
    "last_report": None,
}


@app.on_event("startup")
async def startup_event():
    await test_db_connection()


def verify_agent(api_key: str = Header(None)):
    if api_key != AGENT_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return True


# ─────────────────── AUTH ENDPOINTS ───────────────────

@app.post("/api/auth/register")
async def register(body: UserRegister):
    email = body.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = await find_user_by_email(email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    # First user becomes admin, everyone after is analyst by default
    first = (await get_logs("audit_log", 1)) == [] and (await find_user_by_email("dummy-check") is None)
    # Simpler rule: if there are zero users so far, make admin
    # We detect this by attempting to create — but we need a count. Use a probe.
    # Fallback: look for any admin in memory/db via a marker.
    role = "analyst"
    # Heuristic: pick admin if email matches env ADMIN_EMAIL
    if email == os.getenv("ADMIN_EMAIL", "").lower().strip():
        role = "admin"

    totp_secret = generate_totp_secret()
    user_doc = {
        "email": email,
        "name": body.name or email.split("@")[0],
        "password_hash": hash_password(body.password),
        "role": role,
        "totp_secret": totp_secret,
        "totp_enabled": False,
    }
    created = await create_user(user_doc)
    if not created:
        raise HTTPException(status_code=500, detail="Could not create user")

    await add_audit(email, "register", f"Registered as {role}")
    return {
        "status": "ok",
        "email": email,
        "role": role,
        "totp_required_setup": True,
    }


@app.post("/api/auth/login")
async def login(body: UserLogin):
    """Stage 1 of login: verify email+password. Returns a flag telling the UI whether TOTP is next."""
    email = body.email.lower().strip()
    user = await find_user_by_email(email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        await add_audit(email, "login_failed", "Bad credentials", "warning")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if user.get("totp_enabled"):
        # Password OK, but TOTP required — return partial auth
        return {
            "status": "totp_required",
            "email": email,
        }

    # No TOTP set up yet → issue a token but tell UI to set up TOTP
    token = create_access_token(email, user.get("role", "analyst"))
    await add_audit(email, "login", "No 2FA configured yet")
    return {
        "status": "ok",
        "token": token,
        "role": user.get("role", "analyst"),
        "name": user.get("name", email),
        "totp_enabled": False,
    }


@app.post("/api/auth/totp/setup")
async def totp_setup(body: TotpSetupRequest):
    """Return a QR code data URL the user scans with Google Authenticator.
    Requires them to re-authenticate with password for safety.
    """
    email = body.email.lower().strip()
    user = await find_user_by_email(email)
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate a fresh secret every time setup is called (previous codes invalidated)
    secret = generate_totp_secret()
    await update_user(email, {"totp_secret": secret, "totp_enabled": False})
    qr = build_totp_qr_data_url(secret, email)
    return {"status": "ok", "qr_data_url": qr, "secret": secret}


@app.post("/api/auth/totp/verify")
async def totp_verify(body: TotpVerify):
    email = body.email.lower().strip()
    user = await find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    secret = user.get("totp_secret")
    if not secret:
        raise HTTPException(status_code=400, detail="No TOTP secret — run setup first")

    if not verify_totp(secret, body.code):
        await add_audit(email, "totp_failed", "Invalid 2FA code", "warning")
        raise HTTPException(status_code=401, detail="Invalid 2FA code")

    # First successful verify enables TOTP permanently for this account
    if not user.get("totp_enabled"):
        await update_user(email, {"totp_enabled": True})

    token = create_access_token(email, user.get("role", "analyst"))
    await add_audit(email, "login", "2FA verified")
    return {
        "status": "ok",
        "token": token,
        "role": user.get("role", "analyst"),
        "name": user.get("name", email),
        "totp_enabled": True,
    }


@app.get("/api/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {
        "email": user["email"],
        "name": user.get("name", user["email"]),
        "role": user.get("role", "analyst"),
        "totp_enabled": user.get("totp_enabled", False),
    }


# ─────────────────── AUDIT LOG ───────────────────

@app.get("/api/audit")
async def fetch_audit(limit: int = 200, user: dict = Depends(require_role("admin"))):
    entries = await get_logs("audit_log", limit)
    for e in entries:
        if "_id" in e:
            e["_id"] = str(e["_id"])
    return {"status": "ok", "data": entries}


# ─────────────────── PUSH NOTIFICATIONS ───────────────────

@app.get("/api/push/public-key")
async def push_public_key():
    from push import get_vapid_public_key
    return {"public_key": get_vapid_public_key()}


@app.post("/api/push/subscribe")
async def push_subscribe(sub: PushSubscription, user: dict = Depends(get_current_user)):
    sub_dict = sub.model_dump()
    sub_dict["user_email"] = user["email"]
    await add_push_subscription(sub_dict)
    await add_audit(user["email"], "push_subscribe", "Registered for push alerts")
    return {"status": "ok"}


@app.post("/api/push/unsubscribe")
async def push_unsubscribe(sub: PushSubscription, user: dict = Depends(get_current_user)):
    await remove_push_subscription(sub.endpoint)
    return {"status": "ok"}


# ─────────────────── AGENT INGEST ───────────────────

@app.post("/api/agent/ingest")
async def ingest_payload(payload: AgentPayload, authorized: bool = Depends(verify_agent)):
    if not payload.timestamp:
        payload.timestamp = datetime.utcnow().isoformat()

    payload_dict = payload.model_dump()
    broadcast_payload = dict(payload_dict)

    await insert_log("agent_metrics", payload_dict)

    # Threat Detection
    alerts = evaluate_payload(payload)
    alert_broadcast = []
    critical_alerts = []
    if alerts:
        for a in alerts:
            ad = a.model_dump()
            alert_broadcast.append(dict(ad))
            await insert_log("alerts", ad)
            if ad.get("severity") == "Critical":
                critical_alerts.append(ad)

        await manager.broadcast_json({
            "type": "NEW_ALERTS",
            "data": alert_broadcast
        })

        # Fire push notifications for Critical alerts
        if critical_alerts:
            for a in critical_alerts:
                try:
                    await send_push_to_all(
                        title=f"🚨 Critical: {a.get('type', 'threat')}",
                        body=a.get("message", "Critical alert fired"),
                        data={"alert_id": a.get("id"), "severity": "Critical"},
                    )
                except Exception as e:
                    print(f"[PUSH] Error sending notification: {e}")

    # Broadcast live metrics + wifi to UI
    await manager.broadcast_json({
        "type": "LIVE_METRICS",
        "data": broadcast_payload
    })

    # Check if a scan was requested by the frontend
    should_scan = scan_state["requested"]
    if should_scan:
        scan_state["requested"] = False
        scan_state["in_progress"] = True

    return {
        "status": "ok",
        "alerts_generated": len(alerts),
        "scan_requested": should_scan
    }


# ─────────────────── SCAN ENDPOINTS ───────────────────

@app.post("/api/agent/scan-report")
async def receive_scan_report(report: ScanReport, authorized: bool = Depends(verify_agent)):
    """Receive deep scan results from the agent and broadcast to dashboard."""
    report_dict = report.model_dump()

    scan_state["in_progress"] = False
    scan_state["last_report"] = report_dict

    await insert_log("scan_reports", dict(report_dict))

    # Broadcast scan results to all connected dashboards
    await manager.broadcast_json({
        "type": "SCAN_REPORT",
        "data": report_dict
    })

    print(f"[SCAN] Report received. Threat level: {report.threat_level}, Findings: {report.total_findings}")
    return {"status": "ok", "threat_level": report.threat_level}


@app.post("/api/scan/trigger")
async def trigger_scan(user: dict = Depends(require_role("admin"))):
    """Called by the frontend to request a deep scan. Requires admin role."""
    scan_state["requested"] = True
    scan_state["in_progress"] = True

    await manager.broadcast_json({
        "type": "SCAN_STATUS",
        "data": {"status": "INITIATED", "message": "Deep scan requested. Agent will execute on next heartbeat."}
    })

    await add_audit(user["email"], "scan_trigger", "Deep scan initiated", "info")
    print(f"[SCAN] Scan triggered by {user['email']}")
    return {"status": "ok", "message": "Scan requested"}


@app.get("/api/scan/status")
async def get_scan_status():
    return {
        "requested": scan_state["requested"],
        "in_progress": scan_state["in_progress"],
        "has_report": scan_state["last_report"] is not None
    }


@app.get("/api/scan/last-report")
async def get_last_report():
    if scan_state["last_report"]:
        return {"status": "ok", "data": scan_state["last_report"]}
    return {"status": "ok", "data": None}


# ─────────────────── OTHER ENDPOINTS ───────────────────

@app.get("/api/agent/health")
async def health_check():
    return {"status": "healthy"}


@app.get("/api/alerts")
async def fetch_alerts(limit: int = 100, user: dict = Depends(get_current_user)):
    alerts = await get_logs("alerts", limit)
    for a in alerts:
        if "_id" in a:
            a["_id"] = str(a["_id"])
    return {"status": "success", "data": alerts}


# ─────────────────── WEBSOCKET ───────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = ""):
    """
    Optional JWT in ?token=... query string.
    - No token → view-only client (can receive broadcasts, cannot trigger scans)
    - Valid token → role from JWT gates sensitive actions
    """
    ws_user = None
    if token:
        try:
            payload = decode_access_token(token)
            email = payload.get("sub")
            role = payload.get("role", "analyst")
            if email:
                ws_user = {"email": email, "role": role}
        except Exception:
            ws_user = None

    await manager.connect(websocket)
    role_str = (ws_user or {}).get("role", "anon")
    print(f"[WS] Client connected (role={role_str}). Active: {len(manager.active_connections)}")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = _json.loads(data)
                msg_type = message.get("type")

                if msg_type == "TRIGGER_DEEP_SCAN":
                    # Only admins can trigger a scan
                    if not ws_user or ws_user.get("role") != "admin":
                        await websocket.send_text(_json.dumps({
                            "type": "SCAN_STATUS",
                            "data": {"status": "DENIED", "message": "Admin role required to trigger scans."}
                        }))
                        continue
                    # Debounce: ignore if already requested/in progress
                    if not scan_state["requested"] and not scan_state["in_progress"]:
                        scan_state["requested"] = True
                        scan_state["in_progress"] = True
                        await manager.broadcast_json({
                            "type": "SCAN_STATUS",
                            "data": {"status": "INITIATED", "message": f"Deep scan requested by {ws_user['email']}."}
                        })
                        await add_audit(ws_user["email"], "scan_trigger", "Deep scan initiated via WS", "info")
                        print(f"[WS] Deep scan triggered by {ws_user['email']}")

                elif msg_type == "CLEAR_ALERTS":
                    print("[WS] Clear alerts requested")

            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"[WS] Client disconnected. Active: {len(manager.active_connections)}")
    except Exception as e:
        manager.disconnect(websocket)
        print(f"[WS] Error: {e}. Active: {len(manager.active_connections)}")
