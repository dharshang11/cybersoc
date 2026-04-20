#!/usr/bin/env python3
"""
═══════════════════════════════════════════
  SOC ATTACK SIMULATOR — Direct Injection
═══════════════════════════════════════════

This script DIRECTLY injects attack payloads into the backend API,
simulating what the agent would send if real attacks were running.

This GUARANTEES alerts will appear in your Alerts Center.

Usage:
    python3 attack_simulator.py
"""

import os
import requests
import time
import random
import uuid
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # dotenv optional — env vars can still be set directly

BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
API_KEY = os.getenv("API_KEY", "agent_secret_key")
HEADERS = {"api-key": API_KEY}

RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"

def banner():
    print(f"""
{RED}{BOLD}
 ╔═══════════════════════════════════════════════════════╗
 ║            🔥 SOC ATTACK SIMULATOR 🔥                ║
 ║      Direct injection into backend detection         ║
 ╚═══════════════════════════════════════════════════════╝{RESET}
    """)

def send_attack(name, payload):
    """Send a malicious payload to the backend and print result."""
    print(f"\n{RED}▶ ATTACK:{RESET} {BOLD}{name}{RESET}")
    try:
        resp = requests.post(f"{BACKEND_URL}/api/agent/ingest", json=payload, headers=HEADERS, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            alerts = data.get("alerts_generated", 0)
            if alerts > 0:
                print(f"  {RED}⚠ DETECTED! {alerts} alert(s) generated!{RESET}")
            else:
                print(f"  {GREEN}✓ Payload sent (no alert triggered){RESET}")
        else:
            print(f"  {YELLOW}Response: {resp.status_code}{RESET}")
    except Exception as e:
        print(f"  {YELLOW}Error: {e}{RESET}")

# ─────────── ATTACK PAYLOADS ───────────

def attack_nmap_scan():
    """Simulate nmap running on the system."""
    send_attack("NMAP Port Scanner Detected", {
        "metrics": {"cpu_percent": 45.2, "ram_percent": 62.1, "disk_percent": 55.0},
        "processes": [
            {"pid": 99901, "name": "nmap", "cpu_percent": 32.5},
            {"pid": 99902, "name": "Chrome", "cpu_percent": 5.1},
            {"pid": 99903, "name": "Finder", "cpu_percent": 0.3},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:42000", "raddr": "10.0.0.1:80", "status": "SYN_SENT", "pid": 99901},
            {"fd": 2, "family": 2, "type": 1, "laddr": "192.168.1.10:42001", "raddr": "10.0.0.1:443", "status": "SYN_SENT", "pid": 99901},
        ]
    })

def attack_metasploit():
    """Simulate metasploit framework running."""
    send_attack("Metasploit Framework Active", {
        "metrics": {"cpu_percent": 55.0, "ram_percent": 78.3, "disk_percent": 55.0},
        "processes": [
            {"pid": 88801, "name": "metasploit", "cpu_percent": 22.0},
            {"pid": 88802, "name": "meterpreter", "cpu_percent": 15.0},
            {"pid": 88803, "name": "ruby", "cpu_percent": 8.0},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:4444", "raddr": "10.0.0.100:443", "status": "ESTABLISHED", "pid": 88801},
        ]
    })

def attack_reverse_shell():
    """Simulate a reverse shell on port 4444."""
    send_attack("Reverse Shell on Port 4444", {
        "metrics": {"cpu_percent": 30.0, "ram_percent": 50.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 77701, "name": "netcat", "cpu_percent": 2.0},
            {"pid": 77702, "name": "bash", "cpu_percent": 0.5},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "0.0.0.0:4444", "raddr": "45.33.32.156:54321", "status": "ESTABLISHED", "pid": 77701},
            {"fd": 2, "family": 2, "type": 1, "laddr": "192.168.1.10:1337", "raddr": "198.51.100.23:80", "status": "ESTABLISHED", "pid": 77701},
        ]
    })

def attack_hashcat():
    """Simulate hashcat password cracker."""
    send_attack("Hashcat Password Cracker", {
        "metrics": {"cpu_percent": 98.5, "ram_percent": 85.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 66601, "name": "hashcat", "cpu_percent": 95.0},
        ],
        "connections": []
    })

def attack_nikto():
    """Simulate nikto web scanner."""
    send_attack("Nikto Web Vulnerability Scanner", {
        "metrics": {"cpu_percent": 40.0, "ram_percent": 55.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 55501, "name": "nikto", "cpu_percent": 18.0},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:50000", "raddr": "10.0.0.5:80", "status": "ESTABLISHED", "pid": 55501},
            {"fd": 2, "family": 2, "type": 1, "laddr": "192.168.1.10:50001", "raddr": "10.0.0.5:443", "status": "ESTABLISHED", "pid": 55501},
        ]
    })

def attack_wireshark():
    """Simulate wireshark packet capture."""
    send_attack("Wireshark Packet Sniffer", {
        "metrics": {"cpu_percent": 35.0, "ram_percent": 60.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 44401, "name": "wireshark", "cpu_percent": 12.0},
        ],
        "connections": []
    })

def attack_hydra():
    """Simulate hydra brute force."""
    send_attack("Hydra Brute Force Attack", {
        "metrics": {"cpu_percent": 70.0, "ram_percent": 65.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 33301, "name": "hydra", "cpu_percent": 55.0},
        ],
        "connections": [
            {"fd": i, "family": 2, "type": 1, "laddr": f"192.168.1.10:{50100+i}", "raddr": "10.0.0.1:22", "status": "ESTABLISHED", "pid": 33301}
            for i in range(10)
        ]
    })

def attack_cpu_spike():
    """Simulate crypto mining via extreme CPU."""
    send_attack("CPU Spike — Possible Cryptominer", {
        "metrics": {"cpu_percent": 99.2, "ram_percent": 92.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 22201, "name": "xmrig", "cpu_percent": 98.0},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:3333", "raddr": "pool.minexmr.com:4444", "status": "ESTABLISHED", "pid": 22201},
        ]
    })

def attack_gobuster():
    """Simulate gobuster directory brute force."""
    send_attack("Gobuster Directory Scanner", {
        "metrics": {"cpu_percent": 45.0, "ram_percent": 50.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 11101, "name": "gobuster", "cpu_percent": 30.0},
        ],
        "connections": [
            {"fd": i, "family": 2, "type": 1, "laddr": f"192.168.1.10:{51000+i}", "raddr": "10.0.0.5:80", "status": "ESTABLISHED", "pid": 11101}
            for i in range(15)
        ]
    })

def attack_sqlmap():
    """Simulate sqlmap SQL injection."""
    send_attack("SQLMap SQL Injection Attack", {
        "metrics": {"cpu_percent": 50.0, "ram_percent": 55.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 10001, "name": "sqlmap", "cpu_percent": 20.0},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:52000", "raddr": "10.0.0.5:3306", "status": "ESTABLISHED", "pid": 10001},
        ]
    })

def attack_suspicious_ports():
    """Simulate connections to known malware C2 ports."""
    send_attack("Connections to Malware C2 Ports", {
        "metrics": {"cpu_percent": 25.0, "ram_percent": 40.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 9901, "name": "curl", "cpu_percent": 2.0},
        ],
        "connections": [
            {"fd": 1, "family": 2, "type": 1, "laddr": "192.168.1.10:60000", "raddr": "evil-server.com:4444", "status": "ESTABLISHED", "pid": 9901},
            {"fd": 2, "family": 2, "type": 1, "laddr": "192.168.1.10:60001", "raddr": "c2-server.net:5555", "status": "ESTABLISHED", "pid": 9901},
            {"fd": 3, "family": 2, "type": 1, "laddr": "192.168.1.10:60002", "raddr": "backdoor.io:1337", "status": "ESTABLISHED", "pid": 9901},
        ]
    })

def attack_mass_connections():
    """Simulate DDoS with 60+ connections."""
    send_attack("DDoS — Mass Connection Flood", {
        "metrics": {"cpu_percent": 85.0, "ram_percent": 75.0, "disk_percent": 55.0},
        "processes": [
            {"pid": 8801, "name": "python3", "cpu_percent": 60.0},
        ],
        "connections": [
            {"fd": i, "family": 2, "type": 1, "laddr": f"192.168.1.10:{40000+i}", "raddr": f"10.0.0.{1+i%254}:80", "status": "ESTABLISHED", "pid": 8801}
            for i in range(55)
        ]
    })

# ─────────── MAIN ───────────

def main():
    banner()

    print(f"{CYAN}Target backend: {BACKEND_URL}{RESET}")

    # Wake up the backend (Render free tier can cold-start in 30-60s)
    print(f"{YELLOW}Pinging backend (may take up to 60s on cold start)...{RESET}")
    backend_up = False
    for attempt in range(1, 13):  # 12 attempts * 5s = 60s
        try:
            r = requests.get(f"{BACKEND_URL}/api/agent/health", timeout=10)
            if r.status_code == 200:
                backend_up = True
                break
        except Exception:
            pass
        print(f"  ...attempt {attempt}/12 — backend waking up")
        time.sleep(5)

    if not backend_up:
        print(f"{RED}✗ Cannot reach backend at {BACKEND_URL}{RESET}")
        print(f"  Check that your Render service is deployed and the URL is correct.")
        sys.exit(1)
    print(f"{GREEN}✓ Backend is online{RESET}")

    attacks = [
        attack_nmap_scan,
        attack_metasploit,
        attack_reverse_shell,
        attack_hashcat,
        attack_nikto,
        attack_wireshark,
        attack_hydra,
        attack_cpu_spike,
        attack_gobuster,
        attack_sqlmap,
        attack_suspicious_ports,
        attack_mass_connections,
    ]
    
    print(f"\n{BOLD}Launching {len(attacks)} attack simulations...{RESET}")
    print(f"{YELLOW}Watch your SOC Dashboard → Alerts Center!{RESET}")
    print(f"{'─' * 50}\n")
    
    for i, attack_fn in enumerate(attacks, 1):
        print(f"\n{'═' * 50}")
        print(f"  Attack {i}/{len(attacks)}")
        print(f"{'═' * 50}")
        
        try:
            attack_fn()
        except KeyboardInterrupt:
            print(f"\n{YELLOW}Stopped.{RESET}")
            sys.exit(0)
        
        time.sleep(2)
    
    print(f"\n{'═' * 50}")
    print(f"{GREEN}{BOLD}")
    print(f"  ✅ ALL 12 ATTACKS COMPLETE!")
    print(f"     Open your SOC dashboard and scroll")
    print(f"     to the ALERTS CENTER page.{RESET}")
    print(f"{'═' * 50}\n")

if __name__ == "__main__":
    main()
