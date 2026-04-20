import uuid
from datetime import datetime
from models import AgentPayload, Alert

# Suspicious processes (exact name match only to avoid false positives)
SUSPICIOUS_PROCESSES = {"nmap", "netcat", "hashcat", "mimikatz", "wireshark",
                        "hydra", "sqlmap", "metasploit", "meterpreter",
                        "ettercap", "aircrack-ng", "burpsuite", "nikto",
                        "gobuster", "ncat", "masscan", "responder"}

def evaluate_payload(payload: AgentPayload) -> list[Alert]:
    alerts = []
    timestamp = datetime.utcnow().isoformat()

    # Rule 1: High CPU Usage
    if payload.metrics.cpu_percent > 90.0:
        alerts.append(Alert(
            id=str(uuid.uuid4()),
            type="high_cpu",
            severity="High",
            message=f"CPU usage critically high: {payload.metrics.cpu_percent}%",
            timestamp=timestamp
        ))

    # Rule 2: High RAM Usage
    if payload.metrics.ram_percent > 90.0:
        alerts.append(Alert(
            id=str(uuid.uuid4()),
            type="high_ram",
            severity="Medium",
            message=f"RAM usage high: {payload.metrics.ram_percent}%",
            timestamp=timestamp
        ))

    # Rule 3: Suspicious Processes (exact name match)
    for proc in payload.processes:
        if proc.name.lower() in SUSPICIOUS_PROCESSES:
            alerts.append(Alert(
                id=str(uuid.uuid4()),
                type="suspicious_process",
                severity="Critical",
                message=f"Detected suspicious process: {proc.name} (PID: {proc.pid})",
                timestamp=timestamp
            ))

    # Rule 4: High number of network connections
    if len(payload.connections) > 50:
        alerts.append(Alert(
            id=str(uuid.uuid4()),
            type="high_connections",
            severity="Medium",
            message=f"Abnormally high network connections: {len(payload.connections)}",
            timestamp=timestamp
        ))

    # Rule 5: Connections to suspicious ports
    suspicious_ports = {4444, 5555, 6666, 1337, 31337, 12345, 54321}
    for conn in payload.connections:
        if conn.raddr:
            try:
                port = int(conn.raddr.split(":")[-1]) if ":" in conn.raddr else 0
                if port in suspicious_ports:
                    alerts.append(Alert(
                        id=str(uuid.uuid4()),
                        type="suspicious_connection",
                        severity="Critical",
                        message=f"Connection to suspicious port {port}: {conn.raddr}",
                        timestamp=timestamp
                    ))
            except ValueError:
                pass

    return alerts
