import os
import time
import subprocess
import hashlib
import psutil
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
API_KEY = os.getenv("API_KEY", "agent_secret_key")
POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "2"))
HEADERS = {"api-key": API_KEY}

# WiFi cache (system_profiler is slow, refresh every 30s)
_wifi_cache = {"data": None, "last_update": 0}
WIFI_REFRESH_INTERVAL = 30

# Process CPU tracking — need 2 calls to get real cpu_percent
_prev_cpu = {}

# Suspicious processes (exact name match only)
SUSPICIOUS_NAMES = {"nmap", "netcat", "hashcat", "mimikatz", "wireshark",
                    "hydra", "sqlmap", "metasploit", "meterpreter",
                    "ettercap", "aircrack-ng", "burpsuite", "nikto", "gobuster",
                    "ncat", "masscan", "responder", "crackmapexec", "evil-winrm"}

# ─────────────────────── SYSTEM METRICS ───────────────────────

def get_system_metrics():
    """Get LIVE system metrics — cpu with actual measurement interval."""
    cpu = psutil.cpu_percent(interval=0.5)  # blocks 0.5s for REAL live reading
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    return {
        "cpu_percent": cpu,
        "ram_percent": mem.percent,
        "ram_used_gb": round(mem.used / (1024**3), 2),
        "ram_total_gb": round(mem.total / (1024**3), 2),
        "disk_percent": disk.percent,
        "disk_used_gb": round(disk.used / (1024**3), 1),
        "disk_total_gb": round(disk.total / (1024**3), 1),
    }

def get_processes(limit=25):
    """Get REAL dynamic process list — captures every running app."""
    global _prev_cpu
    
    current = {}
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent']):
        try:
            pid = p.info['pid']
            name = p.info['name'] or "unknown"
            mem = p.info['memory_percent'] or 0.0
            
            # cpu_percent(interval=None) uses delta from last call
            try:
                cpu = p.cpu_percent(interval=None)
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                cpu = 0.0
            
            # Skip kernel/idle processes
            if name in ("kernel_task", "idle", "syslogd", "launchd") and cpu < 1:
                continue
            
            current[pid] = {
                "pid": pid,
                "name": name,
                "cpu_percent": round(cpu, 1),
                "memory_percent": round(mem, 1)
            }
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    
    # Sort: first by CPU desc, then by memory desc
    all_procs = sorted(current.values(), 
                       key=lambda x: (x['cpu_percent'], x['memory_percent']), 
                       reverse=True)
    
    # Return top processes but ensure variety — include apps by name
    result = []
    seen_names = set()
    for p in all_procs:
        if len(result) >= limit:
            break
        key = p['name']
        if key not in seen_names or p['cpu_percent'] > 1:
            result.append({
                "pid": p['pid'],
                "name": p['name'],
                "cpu_percent": p['cpu_percent']
            })
            seen_names.add(key)
    
    return result

# ─────────────────────── NETWORK (macOS compatible) ───────────────────────

def get_wifi_info():
    """Get WiFi SSID and details on macOS (cached, refreshed every 30s)."""
    global _wifi_cache
    now = time.time()
    if _wifi_cache["data"] and (now - _wifi_cache["last_update"]) < WIFI_REFRESH_INTERVAL:
        return _wifi_cache["data"]

    info = {"ssid": "Unknown", "bssid": "Unknown", "rssi": "N/A", "channel": "N/A", "security": "N/A"}
    try:
        result = subprocess.run(
            ["system_profiler", "SPAirPortDataType"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            output = result.stdout
            in_current = False
            ssid_found = False
            for line in output.split("\n"):
                stripped = line.strip()
                if "Current Network Information:" in stripped:
                    in_current = True
                    continue
                if in_current and not ssid_found and stripped.endswith(":"):
                    info["ssid"] = stripped.rstrip(":")
                    ssid_found = True
                    continue
                if ssid_found:
                    if stripped.startswith("PHY Mode:"):
                        info["security"] = stripped.split(":", 1)[1].strip()
                    elif stripped.startswith("Channel:"):
                        info["channel"] = stripped.split(":", 1)[1].strip()
                    elif stripped.startswith("BSSID:"):
                        info["bssid"] = stripped.split(":", 1)[1].strip()
                    elif stripped.startswith("Signal / Noise:"):
                        info["rssi"] = stripped.split(":", 1)[1].strip()
                if ssid_found and stripped == "" and info["channel"] != "N/A":
                    break
            if "MAC Address:" in output:
                for line in output.split("\n"):
                    if "MAC Address:" in line:
                        mac = line.split(":", 1)[1].strip()
                        if info["bssid"] == "Unknown":
                            info["bssid"] = mac
                        break
    except Exception as e:
        print(f"[!] WiFi info error: {e}")

    _wifi_cache["data"] = info
    _wifi_cache["last_update"] = time.time()
    return info

def get_connections_via_lsof(limit=30):
    """Use lsof -i to get network connections (works without root on macOS)."""
    conns = []
    try:
        result = subprocess.run(["lsof", "-i", "-n", "-P"], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")
            for line in lines[1:limit+1]:
                parts = line.split()
                if len(parts) >= 9:
                    name = parts[0]
                    pid = parts[1]
                    protocol = parts[7] if len(parts) > 7 else ""
                    address = parts[8] if len(parts) > 8 else ""
                    status = parts[9] if len(parts) > 9 else "NONE"
                    status = status.strip("()")
                    local_addr = ""
                    remote_addr = ""
                    if "->" in address:
                        local_addr, remote_addr = address.split("->", 1)
                    else:
                        local_addr = address
                    conns.append({
                        "process": name,
                        "pid": int(pid) if pid.isdigit() else 0,
                        "protocol": protocol,
                        "local_addr": local_addr,
                        "remote_addr": remote_addr,
                        "status": status
                    })
    except Exception as e:
        print(f"[!] lsof error: {e}")
    return conns

# ─────────────────────── DEEP SCAN ───────────────────────

def deep_scan_processes():
    findings = []
    for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_percent', 'exe', 'username']):
        try:
            info = p.info
            name = (info['name'] or "").lower()
            cpu = info['cpu_percent'] or 0
            mem = info['memory_percent'] or 0
            exe = info['exe'] or "N/A"
            user = info['username'] or "N/A"
            is_suspicious = name in SUSPICIOUS_NAMES
            is_hog = cpu > 80 or mem > 50
            if is_suspicious or is_hog:
                findings.append({
                    "pid": info['pid'], "name": info['name'],
                    "cpu": round(cpu, 1), "memory": round(mem, 1),
                    "executable": exe, "user": user,
                    "reason": "SUSPICIOUS_NAME" if is_suspicious else "HIGH_RESOURCE",
                    "severity": "Critical" if is_suspicious else "High"
                })
        except (psutil.AccessDenied, psutil.NoSuchProcess):
            pass
    return findings

def deep_scan_network():
    findings = []
    conns = get_connections_via_lsof(100)
    external_count = 0
    suspicious_ports = [4444, 5555, 6666, 1337, 31337, 8888, 9999, 12345, 54321]
    for c in conns:
        remote = c.get("remote_addr", "")
        if remote and not remote.startswith("127.0.0.1") and remote != "" and remote != "*":
            external_count += 1
            try:
                port = int(remote.split(":")[-1]) if ":" in remote else 0
                if port in suspicious_ports:
                    findings.append({
                        "type": "suspicious_port", "process": c["process"],
                        "pid": c["pid"], "remote": remote, "port": port,
                        "severity": "Critical",
                        "message": f"{c['process']} (PID:{c['pid']}) connected to suspicious port {port}"
                    })
            except ValueError:
                pass
    if external_count > 50:
        findings.append({
            "type": "high_connection_count", "count": external_count,
            "severity": "High",
            "message": f"Abnormally high external connection count: {external_count}"
        })
    return findings, external_count

def deep_scan_file_integrity():
    files_to_check = [
        "/etc/hosts", "/etc/passwd", "/etc/resolv.conf",
        os.path.expanduser("~/.ssh/authorized_keys"),
        os.path.expanduser("~/.bash_profile"),
        os.path.expanduser("~/.zshrc"),
    ]
    results = []
    for fpath in files_to_check:
        entry = {"path": fpath, "exists": False, "hash": None, "size": None, "modified": None}
        if os.path.exists(fpath):
            entry["exists"] = True
            try:
                stat = os.stat(fpath)
                entry["size"] = stat.st_size
                entry["modified"] = datetime.fromtimestamp(stat.st_mtime).isoformat()
                with open(fpath, "rb") as f:
                    entry["hash"] = hashlib.sha256(f.read()).hexdigest()[:16]
            except (PermissionError, OSError):
                entry["hash"] = "ACCESS_DENIED"
        results.append(entry)
    return results

def deep_scan_anomalies():
    anomalies = []
    proc_count = len(list(psutil.process_iter()))
    if proc_count > 400:
        anomalies.append({"type": "high_process_count", "value": proc_count, "severity": "Medium",
                          "message": f"Unusually high process count: {proc_count}"})
    swap = psutil.swap_memory()
    if swap.percent > 80:
        anomalies.append({"type": "high_swap", "value": round(swap.percent, 1), "severity": "Medium",
                          "message": f"Swap usage critically high: {swap.percent:.1f}%"})
    boot_time = datetime.fromtimestamp(psutil.boot_time())
    uptime_hours = (datetime.now() - boot_time).total_seconds() / 3600
    anomalies.append({"type": "uptime_info", "value": round(uptime_hours, 1), "severity": "Low",
                      "message": f"System uptime: {uptime_hours:.1f} hours (booted: {boot_time.strftime('%Y-%m-%d %H:%M')})"})
    try:
        io = psutil.disk_io_counters()
        if io:
            anomalies.append({"type": "disk_io", "read_gb": round(io.read_bytes / (1024**3), 2),
                              "write_gb": round(io.write_bytes / (1024**3), 2), "severity": "Low",
                              "message": f"Disk I/O: {io.read_bytes/(1024**3):.2f} GB read, {io.write_bytes/(1024**3):.2f} GB written"})
    except Exception:
        pass
    return anomalies

def run_full_deep_scan():
    print("[*] ===== STARTING DEEP SYSTEM SCAN =====")
    start = time.time()
    proc_findings = deep_scan_processes()
    net_findings, ext_conn_count = deep_scan_network()
    file_checks = deep_scan_file_integrity()
    anomalies = deep_scan_anomalies()
    wifi = get_wifi_info()
    elapsed = round(time.time() - start, 2)
    print(f"[*] ===== DEEP SCAN COMPLETE ({elapsed}s) =====")
    all_severities = [f.get("severity", "Low") for f in proc_findings + net_findings + anomalies]
    if "Critical" in all_severities: threat_level = "Critical"
    elif "High" in all_severities: threat_level = "High"
    elif "Medium" in all_severities: threat_level = "Medium"
    else: threat_level = "Low"
    return {
        "timestamp": datetime.utcnow().isoformat(), "duration_seconds": elapsed,
        "threat_level": threat_level, "wifi_info": wifi,
        "process_findings": proc_findings, "network_findings": net_findings,
        "external_connection_count": ext_conn_count, "file_integrity": file_checks,
        "anomalies": anomalies,
        "total_findings": len(proc_findings) + len(net_findings) + len(anomalies)
    }

# ─────────────────────── MAIN LOOP ───────────────────────

def run_agent():
    print(f"[*] Starting SOC Agent... sending to {BACKEND_URL}")
    
    # Prime psutil's cpu tracking (first call returns 0 for everything)
    psutil.cpu_percent(interval=None)
    for p in psutil.process_iter():
        try:
            p.cpu_percent(interval=None)
        except:
            pass
    print("[*] CPU counters primed. Starting telemetry loop...")
    time.sleep(1)
    
    while True:
        try:
            connections_raw = get_connections_via_lsof()
            connections = []
            for c in connections_raw:
                connections.append({
                    "fd": c.get("pid", 0), "family": 2, "type": 1,
                    "laddr": c.get("local_addr", ""),
                    "raddr": c.get("remote_addr", ""),
                    "status": c.get("status", "NONE"),
                    "pid": c.get("pid", 0)
                })
            wifi = get_wifi_info()
            procs = get_processes()
            
            payload = {
                "metrics": get_system_metrics(),
                "processes": procs,
                "connections": connections,
                "wifi_info": wifi
            }

            response = requests.post(f"{BACKEND_URL}/api/agent/ingest", json=payload, headers=HEADERS, timeout=15)
            if response.status_code == 200:
                resp_data = response.json()
                alerts = resp_data.get("alerts_generated", 0)
                scan_requested = resp_data.get("scan_requested", False)
                top_proc = procs[0]['name'] if procs else "none"
                print(f"[+] Sent | Alerts: {alerts} | Procs: {len(procs)} | Top: {top_proc} | WiFi: {wifi.get('ssid', 'N/A')}")
                if scan_requested:
                    print("[!] Deep scan requested!")
                    scan_report = run_full_deep_scan()
                    scan_resp = requests.post(f"{BACKEND_URL}/api/agent/scan-report", json=scan_report, headers=HEADERS, timeout=30)
                    if scan_resp.status_code == 200:
                        print(f"[+] Scan report sent. Threat: {scan_report['threat_level']}")
            else:
                print(f"[-] Failed: {response.status_code}")
        except requests.exceptions.ConnectionError:
            print("[-] Backend unreachable. Retrying...")
        except requests.exceptions.Timeout:
            print("[-] Request timed out (backend may be cold-starting). Retrying...")
        except Exception as e:
            print(f"[-] Error: {e}")
        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    run_agent()
