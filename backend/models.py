from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# ─────────────────── AUTH MODELS ───────────────────

class UserRegister(BaseModel):
    email: str
    password: str
    name: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class TotpVerify(BaseModel):
    email: str
    code: str

class TotpSetupRequest(BaseModel):
    email: str
    password: str

class UserPublic(BaseModel):
    email: str
    name: Optional[str] = None
    role: str = "analyst"
    totp_enabled: bool = False

class AuditEntry(BaseModel):
    timestamp: str
    user_email: str
    action: str            # e.g. "login", "register", "totp_setup", "scan_trigger", "alert_ack"
    detail: Optional[str] = None
    severity: str = "info" # info, warning, critical

class PushSubscription(BaseModel):
    endpoint: str
    keys: Dict[str, str]

# ─────────────────── AGENT MODELS ───────────────────

class SystemMetric(BaseModel):
    cpu_percent: float
    ram_percent: float
    disk_percent: float

class ProcessObj(BaseModel):
    pid: int
    name: str
    cpu_percent: float

class NetworkConn(BaseModel):
    fd: int
    family: int
    type: int
    laddr: str
    raddr: str
    status: str
    pid: Optional[int] = None

class WifiInfo(BaseModel):
    ssid: str = "Unknown"
    bssid: str = "Unknown"
    rssi: str = "N/A"
    channel: str = "N/A"
    security: str = "N/A"

class AgentPayload(BaseModel):
    metrics: SystemMetric
    processes: List[ProcessObj]
    connections: List[NetworkConn]
    wifi_info: Optional[WifiInfo] = None
    timestamp: Optional[str] = None

class Alert(BaseModel):
    id: str
    type: str
    severity: str  # "Low", "Medium", "High", "Critical"
    message: str
    timestamp: str
    acknowledged: bool = False

class ScanReport(BaseModel):
    timestamp: str
    duration_seconds: float
    threat_level: str
    wifi_info: Optional[Dict[str, Any]] = None
    process_findings: List[Dict[str, Any]] = []
    network_findings: List[Dict[str, Any]] = []
    external_connection_count: int = 0
    file_integrity: List[Dict[str, Any]] = []
    anomalies: List[Dict[str, Any]] = []
    total_findings: int = 0
