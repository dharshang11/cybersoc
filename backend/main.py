import os
import json as _json
from fastapi import FastAPI, Depends, HTTPException, WebSocket, WebSocketDisconnect, Header
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from models import AgentPayload, Alert, ScanReport
from database import test_db_connection, insert_log, get_logs
from engine import evaluate_payload
from sockets import manager
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
    if alerts:
        for a in alerts:
            ad = a.model_dump()
            alert_broadcast.append(dict(ad))
            await insert_log("alerts", ad)

        await manager.broadcast_json({
            "type": "NEW_ALERTS",
            "data": alert_broadcast
        })

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
async def trigger_scan():
    """Called by the frontend to request a deep scan."""
    scan_state["requested"] = True
    scan_state["in_progress"] = True

    await manager.broadcast_json({
        "type": "SCAN_STATUS",
        "data": {"status": "INITIATED", "message": "Deep scan requested. Agent will execute on next heartbeat."}
    })

    print("[SCAN] Scan triggered by dashboard")
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
async def fetch_alerts(limit: int = 100):
    alerts = await get_logs("alerts", limit)
    for a in alerts:
        a["_id"] = str(a["_id"])
    return {"status": "success", "data": alerts}

# ─────────────────── WEBSOCKET ───────────────────

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    print(f"[WS] Client connected. Active: {len(manager.active_connections)}")
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = _json.loads(data)
                msg_type = message.get("type")

                if msg_type == "TRIGGER_DEEP_SCAN":
                    # Debounce: ignore if already requested/in progress
                    if not scan_state["requested"] and not scan_state["in_progress"]:
                        scan_state["requested"] = True
                        scan_state["in_progress"] = True
                        await manager.broadcast_json({
                            "type": "SCAN_STATUS",
                            "data": {"status": "INITIATED", "message": "Deep scan requested. Scanning..."}
                        })
                        print("[WS] Deep scan triggered")

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
