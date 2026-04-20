"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Shield, Activity, HardDrive, Cpu, AlertTriangle,
  Wifi, Loader, Search, Radio, FileSearch, Zap,
  CheckCircle, XCircle, Eye, Globe, Server
} from "lucide-react";
import styles from "./page.module.css";
import GestureControl from "../components/GestureControl";

const ThreatGlobe = dynamic(() => import("../components/ThreatGlobe"), { ssr: false });

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws";

// ─── TYPES ───
interface SystemMetric { cpu_percent: number; ram_percent: number; disk_percent: number; ram_used_gb?: number; ram_total_gb?: number; disk_used_gb?: number; disk_total_gb?: number; }
interface ProcessObj { pid: number; name: string; cpu_percent: number; }
interface NetworkConn { laddr: string; raddr: string; status: string; pid: number; }
interface WifiInfo { ssid: string; bssid: string; rssi: string; channel: string; security: string; }
interface Alert { id: string; type: string; severity: "Low" | "Medium" | "High" | "Critical"; message: string; timestamp: string; }
interface ScanReport {
  timestamp: string; duration_seconds: number; threat_level: string;
  wifi_info: WifiInfo | null; process_findings: any[]; network_findings: any[];
  external_connection_count: number; file_integrity: any[]; anomalies: any[];
  total_findings: number;
}

// ─── MOTIVATIONAL QUOTES ───
const CYBER_QUOTES = [
  "\"Security is not a product, but a process.\" — Bruce Schneier",
  "\"The only truly secure system is one that is powered off.\" — Gene Spafford",
  "\"In the world of cyber, the best defense is a good offense.\"",
  "\"Every expert was once a beginner. Keep learning, keep defending.\"",
  "\"Hackers don't break in — they log in. Stay vigilant.\"",
  "\"The chain is only as strong as its weakest link. Patch everything.\"",
  "\"Cybersecurity is a shared responsibility. Protect. Detect. Respond.\"",
  "\"Your firewall is your first line of defense. Your brain is the last.\"",
  "\"Trust no one. Verify everything. Zero Trust is the future.\"",
  "\"A breach is not a matter of if, but when. Be ready.\"",
  "\"The best incident response is prevention.\"",
  "\"In cyberspace, the attacker only has to be right once. You have to be right every time.\"",
];

export default function SOCDashboard() {
  const [metrics, setMetrics] = useState<SystemMetric | null>(null);
  const [processes, setProcesses] = useState<ProcessObj[]>([]);
  const [connections, setConnections] = useState<NetworkConn[]>([]);
  const [wifiInfo, setWifiInfo] = useState<WifiInfo | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [connected, setConnected] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanReport, setScanReport] = useState<ScanReport | null>(null);
  const [scanStatus, setScanStatus] = useState("");
  const [activePage, setActivePage] = useState(0);
  const [showMotivation, setShowMotivation] = useState(false);
  const [motivationQuote, setMotivationQuote] = useState("");
  const [insaneAlert, setInsaneAlert] = useState<Alert | null>(null);
  const [totalAttacks, setTotalAttacks] = useState(0);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);
  const insaneRef = useRef<Alert | null>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => { insaneRef.current = insaneAlert; }, [insaneAlert]);

  // ─── KEYBOARD LISTENER (close overlays with any key) ───
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (showMotivation) { setShowMotivation(false); return; }
      if (insaneAlert) { setInsaneAlert(null); return; }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showMotivation, insaneAlert]);

  // ─── WEBSOCKET ───
  const connectWS = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) return;
    const socket = new WebSocket(WS_URL);
    socketRef.current = socket;
    socket.onopen = () => setConnected(true);
    socket.onclose = () => { setConnected(false); reconnectRef.current = setTimeout(connectWS, 2000); };
    socket.onerror = () => socket.close();
    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "LIVE_METRICS") {
          setMetrics(msg.data.metrics);
          setProcesses((msg.data.processes || []).slice(0, 20));
          setConnections((msg.data.connections || []).slice(0, 30));
          if (msg.data.wifi_info) setWifiInfo(msg.data.wifi_info);
        } else if (msg.type === "NEW_ALERTS") {
          const newAlerts: Alert[] = msg.data;
          setAlerts(prev => [...newAlerts, ...prev].slice(0, 200));
          setTotalAttacks(prev => prev + newAlerts.length);
          const critical = newAlerts.find(a => a.severity === "Critical");
          if (critical && !insaneRef.current) setInsaneAlert(critical);
        } else if (msg.type === "SCAN_STATUS") {
          setScanActive(true);
          setScanStatus(msg.data.message || "Scanning...");
        } else if (msg.type === "SCAN_REPORT") {
          setScanReport(msg.data);
          setScanActive(false);
          setScanStatus("");
          scrollToPage(2);
        }
      } catch (e) { console.error("[WS]", e); }
    };
  }, []);

  useEffect(() => {
    connectWS();
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [connectWS]);

  // ─── SCROLL OBSERVER ───
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = pageRefs.current.indexOf(entry.target as HTMLDivElement);
            if (idx !== -1) setActivePage(idx);
          }
        });
      },
      { threshold: 0.6 }
    );
    pageRefs.current.forEach(ref => { if (ref) observer.observe(ref); });
    return () => observer.disconnect();
  }, []);

  const scrollToPage = (idx: number) => {
    pageRefs.current[idx]?.scrollIntoView({ behavior: "smooth" });
  };

  const triggerDeepScan = useCallback(() => {
    setScanActive(true);
    setScanStatus("Requesting scan from endpoint agent...");
    socketRef.current?.readyState === WebSocket.OPEN &&
      socketRef.current.send(JSON.stringify({ type: "TRIGGER_DEEP_SCAN" }));
  }, []);

  // ─── GESTURE HANDLER ───
  const handleGesture = useCallback((gesture: string) => {
    if (gesture === "Open Palm") {
      triggerDeepScan();
    } else if (gesture === "Fist") {
      if (showMotivation) { setShowMotivation(false); return; }
      if (insaneAlert) { setInsaneAlert(null); return; }
      setScanActive(false);
      scrollToPage(0);
    } else if (gesture === "Thumbs Up") {
      const quote = CYBER_QUOTES[Math.floor(Math.random() * CYBER_QUOTES.length)];
      setMotivationQuote(quote);
      setShowMotivation(true);
    } else if (gesture === "Index Finger") {
      scrollToPage(3);
    }
  }, [showMotivation, insaneAlert, triggerDeepScan]);

  const getBarColor = (v: number) => v > 90 ? "var(--severity-critical)" : v > 70 ? "var(--severity-high)" : v > 50 ? "var(--severity-medium)" : "var(--severity-low)";
  const getSevColor = (s: string) => ({ Critical: "var(--severity-critical)", High: "var(--severity-high)", Medium: "var(--severity-medium)", Low: "var(--severity-low)" }[s] || "var(--text-secondary)");
  const getSevClass = (s: string) => ({ Critical: styles.sevCritical, High: styles.sevHigh, Medium: styles.sevMedium, Low: styles.sevLow }[s] || "");

  const pages = ["THREAT MAP", "SYSTEM MONITOR", "DEEP SCAN", "ALERTS"];

  return (
    <>

      {/* ═══════════ PAGE 1: HERO + GLOBE ═══════════ */}
      <div className={`${styles.page} ${styles.heroPage}`} ref={el => { pageRefs.current[0] = el; }}>
        <div className={styles.heroContent}>
          <div className={styles.heroTop}>
            <div className={styles.heroLogo}>SOC</div>
            <div className={styles.heroStatus}>
              <div className={`${styles.statusDot} ${!connected ? styles.statusDotOff : ""}`} />
              {connected ? "NEURAL LINK ACTIVE" : "DISCONNECTED"}
            </div>
          </div>

          <div className={styles.heroCenter}>
            {/* Left stats */}
            <div className={styles.heroSide}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>CPU LOAD</div>
                <div className={styles.statValue}>{metrics ? `${metrics.cpu_percent.toFixed(1)}%` : "—"}</div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${metrics?.cpu_percent || 0}%`, backgroundColor: getBarColor(metrics?.cpu_percent || 0), transition: "width 0.8s ease" }} />
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>MEMORY</div>
                <div className={styles.statValue}>{metrics ? `${metrics.ram_percent.toFixed(1)}%` : "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{metrics?.ram_used_gb || "—"} / {metrics?.ram_total_gb || "—"} GB</div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${metrics?.ram_percent || 0}%`, backgroundColor: getBarColor(metrics?.ram_percent || 0), transition: "width 0.8s ease" }} />
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>DISK USAGE</div>
                <div className={styles.statValue}>{metrics ? `${metrics.disk_percent.toFixed(1)}%` : "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{metrics?.disk_used_gb || "—"} / {metrics?.disk_total_gb || "—"} GB</div>
                <div className={styles.statBar}>
                  <div className={styles.statBarFill} style={{ width: `${metrics?.disk_percent || 0}%`, backgroundColor: getBarColor(metrics?.disk_percent || 0), transition: "width 0.8s ease" }} />
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>WIFI NETWORK</div>
                <div className={styles.statValue} style={{ fontSize: 16, color: "var(--severity-low)" }}>{wifiInfo?.ssid || "—"}</div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>{wifiInfo?.rssi || ""} · CH {wifiInfo?.channel || "—"}</div>
              </div>
            </div>

            {/* Globe */}
            <div className={styles.heroGlobe}>
              <ThreatGlobe attackCount={totalAttacks} connectionCount={connections.length} />
            </div>

            {/* Right stats */}
            <div className={styles.heroSide}>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>THREATS DETECTED</div>
                <div className={styles.statValue}>{totalAttacks.toLocaleString()}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>ACTIVE ALERTS</div>
                <div className={styles.statValue} style={{ color: alerts.length > 0 ? "var(--severity-critical)" : "var(--severity-low)" }}>{alerts.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>CONNECTIONS</div>
                <div className={styles.statValue} style={{ color: "var(--severity-low)" }}>{connections.length}</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statLabel}>PROCESSES</div>
                <div className={styles.statValue}>{processes.length}</div>
              </div>
            </div>
          </div>

          <div className={styles.heroBottom}>
            {scanActive && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--neon-red)" }}>
                <Loader size={14} style={{ animation: "spin 1s linear infinite" }} /> DEEP SCAN IN PROGRESS
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════ PAGE 2: SYSTEM MONITOR ═══════════ */}
      <div className={`${styles.page}`} style={{ background: "linear-gradient(180deg, #080303, #050505)" }} ref={el => { pageRefs.current[1] = el; }}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}><Server size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />SYSTEM MONITOR</div>
        </div>
        <div className={styles.pageBody}>
          <div className={styles.grid2}>
            <div className={styles.panel}>
              <div className={styles.panelTitle}><Activity size={14} />ACTIVE PROCESSES ({processes.length})</div>
              <table className={styles.table}>
                <thead><tr><th>PID</th><th>PROCESS</th><th>CPU%</th></tr></thead>
                <tbody>
                  {processes.slice(0, 15).map((p, i) => (
                    <tr key={`p-${p.pid}-${i}`}>
                      <td>{p.pid}</td>
                      <td>{p.name}</td>
                      <td style={{ color: p.cpu_percent > 50 ? "var(--severity-critical)" : p.cpu_percent > 20 ? "var(--severity-medium)" : "inherit" }}>{p.cpu_percent.toFixed(1)}%</td>
                    </tr>
                  ))}
                  {processes.length === 0 && <tr><td colSpan={3} style={{ color: "var(--text-secondary)" }}>Awaiting data...</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
              <div className={styles.panel}>
                <div className={styles.panelTitle}><Wifi size={14} />WIFI</div>
                {wifiInfo ? (
                  <table className={styles.table}>
                    <tbody>
                      <tr><td>SSID</td><td style={{ color: "var(--severity-low)" }}>{wifiInfo.ssid}</td></tr>
                      <tr><td>BSSID</td><td>{wifiInfo.bssid}</td></tr>
                      <tr><td>Signal</td><td>{wifiInfo.rssi}</td></tr>
                      <tr><td>Channel</td><td>{wifiInfo.channel}</td></tr>
                      <tr><td>Protocol</td><td>{wifiInfo.security}</td></tr>
                    </tbody>
                  </table>
                ) : <p style={{ color: "var(--text-secondary)", padding: 10 }}>Waiting...</p>}
              </div>
              <div className={styles.panel} style={{ flex: 1 }}>
                <div className={styles.panelTitle}><Radio size={14} />NETWORK ({connections.length})</div>
                <table className={styles.table}>
                  <thead><tr><th>LOCAL</th><th>REMOTE</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {connections.slice(0, 8).map((c, i) => (
                      <tr key={`n-${i}`}>
                        <td style={{ fontSize: 11 }}>{c.laddr || "—"}</td>
                        <td style={{ fontSize: 11, color: c.raddr ? "var(--severity-low)" : "var(--text-secondary)" }}>{c.raddr || "*"}</td>
                        <td style={{ fontSize: 11, color: c.status === "ESTABLISHED" ? "var(--severity-low)" : "var(--text-secondary)" }}>{c.status}</td>
                      </tr>
                    ))}
                    {connections.length === 0 && <tr><td colSpan={3} style={{ color: "var(--text-secondary)" }}>No connections</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ PAGE 3: DEEP SCAN ═══════════ */}
      <div className={`${styles.page}`} style={{ background: "linear-gradient(180deg, #050505, #080303)" }} ref={el => { pageRefs.current[2] = el; }}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}><Search size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />DEEP SCAN</div>
          <button onClick={triggerDeepScan} disabled={scanActive}
            style={{ background: "transparent", border: "1px solid var(--neon-red)", color: "var(--neon-red)", padding: "8px 20px", fontFamily: "inherit", cursor: scanActive ? "not-allowed" : "pointer", opacity: scanActive ? 0.5 : 1, borderRadius: 4 }}>
            {scanActive ? "SCANNING..." : "🖐️ SCAN NOW"}
          </button>
        </div>
        <div className={styles.pageBody}>
          {scanActive && (
            <div className={`${styles.panel} ${styles.scanProgress}`} style={{ animation: "pulseGlow 2s infinite alternate" }}>
              <Loader size={48} style={{ animation: "spin 1s linear infinite", color: "var(--neon-red)" }} />
              <p style={{ marginTop: 15, fontSize: 16, color: "var(--neon-red)" }}>SCANNING SYSTEM...</p>
              <p style={{ color: "var(--text-secondary)", marginTop: 5 }}>{scanStatus}</p>
            </div>
          )}
          {!scanActive && !scanReport && (
            <div className={`${styles.panel} ${styles.scanProgress}`}>
              <FileSearch size={48} style={{ color: "var(--text-secondary)" }} />
              <p style={{ marginTop: 15, color: "var(--text-secondary)" }}>No scan report yet. Show 🖐️ Open Palm or click SCAN NOW.</p>
            </div>
          )}
          {!scanActive && scanReport && (
            <>
              <div className={styles.panel}>
                <div className={styles.panelTitle}><Zap size={14} />SCAN SUMMARY</div>
                <div className={styles.grid3} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                  <div><div className={styles.statLabel}>THREAT LEVEL</div><div style={{ fontSize: 22, fontWeight: "bold", color: getSevColor(scanReport.threat_level), fontFamily: "Orbitron" }}>{scanReport.threat_level}</div></div>
                  <div><div className={styles.statLabel}>FINDINGS</div><div style={{ fontSize: 22, fontWeight: "bold", color: "var(--neon-red)", fontFamily: "Orbitron" }}>{scanReport.total_findings}</div></div>
                  <div><div className={styles.statLabel}>SCAN TIME</div><div style={{ fontSize: 22, fontWeight: "bold", fontFamily: "Orbitron" }}>{scanReport.duration_seconds}s</div></div>
                  <div><div className={styles.statLabel}>EXT CONNECTIONS</div><div style={{ fontSize: 22, fontWeight: "bold", fontFamily: "Orbitron" }}>{scanReport.external_connection_count}</div></div>
                </div>
              </div>
              <div className={styles.grid2}>
                <div className={styles.panel}>
                  <div className={styles.panelTitle}><Eye size={14} />PROCESS INSPECTION ({scanReport.process_findings.length})</div>
                  {scanReport.process_findings.length > 0 ? (
                    <table className={styles.table}>
                      <thead><tr><th>PID</th><th>NAME</th><th>CPU</th><th>MEM</th><th>SEVERITY</th></tr></thead>
                      <tbody>{scanReport.process_findings.map((f: any, i: number) => (
                        <tr key={i}><td>{f.pid}</td><td>{f.name}</td><td>{f.cpu}%</td><td>{f.memory}%</td><td style={{ color: getSevColor(f.severity) }}>{f.severity}</td></tr>
                      ))}</tbody>
                    </table>
                  ) : <p style={{ color: "var(--severity-low)", padding: 8 }}><CheckCircle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }} />No suspicious processes.</p>}
                </div>
                <div className={styles.panel}>
                  <div className={styles.panelTitle}><FileSearch size={14} />FILE INTEGRITY</div>
                  <table className={styles.table}>
                    <thead><tr><th>FILE</th><th>EXISTS</th><th>HASH</th><th>MODIFIED</th></tr></thead>
                    <tbody>{scanReport.file_integrity.map((f: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontSize: 10 }}>{f.path.split("/").pop()}</td>
                        <td>{f.exists ? <CheckCircle size={12} style={{ color: "var(--severity-low)" }} /> : <XCircle size={12} style={{ color: "var(--text-secondary)" }} />}</td>
                        <td style={{ fontSize: 9, fontFamily: "monospace" }}>{f.hash || "—"}</td>
                        <td style={{ fontSize: 10 }}>{f.modified ? new Date(f.modified).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
              <div className={styles.panel}>
                <div className={styles.panelTitle}><AlertTriangle size={14} />ANOMALIES ({scanReport.anomalies.length})</div>
                <table className={styles.table}>
                  <thead><tr><th>TYPE</th><th>SEVERITY</th><th>DETAILS</th></tr></thead>
                  <tbody>{scanReport.anomalies.map((a: any, i: number) => (
                    <tr key={i}><td>{a.type}</td><td style={{ color: getSevColor(a.severity) }}>{a.severity}</td><td>{a.message}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══════════ PAGE 4: ALERTS ═══════════ */}
      <div className={`${styles.page}`} style={{ background: "linear-gradient(180deg, #080303, #050505)" }} ref={el => { pageRefs.current[3] = el; }}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitle}><AlertTriangle size={18} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} />ALERTS CENTER ({alerts.length})</div>
        </div>
        <div className={styles.pageBody} style={{ overflowY: "auto" }}>
          {alerts.length === 0 && (
            <div className={styles.panel} style={{ textAlign: "center", padding: 40 }}>
              <Shield size={48} style={{ color: "var(--severity-low)" }} />
              <p style={{ marginTop: 15, color: "var(--severity-low)", fontSize: 16 }}>SYSTEM NOMINAL — NO THREATS DETECTED</p>
              <p style={{ color: "var(--text-secondary)", marginTop: 5, fontSize: 12 }}>Run the attack_simulator.py to test alert detection.</p>
            </div>
          )}
          {alerts.map((a) => (
            <div key={a.id} className={styles.alertRow} style={{ borderLeftColor: getSevColor(a.severity), borderLeftWidth: 3 }}>
              <div className={styles.alertIcon} style={{ backgroundColor: `${getSevColor(a.severity)}15`, border: `1px solid ${getSevColor(a.severity)}33` }}>
                <AlertTriangle size={20} style={{ color: getSevColor(a.severity) }} />
              </div>
              <div className={styles.alertContent}>
                <div className={styles.alertSeverity} style={{ color: getSevColor(a.severity) }}>{a.severity} — {a.type.toUpperCase().replace(/_/g, " ")}</div>
                <div className={styles.alertMessage}>{a.message}</div>
                <div className={styles.alertTime}>{new Date(a.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GESTURE WIDGET */}
      <GestureControl onGesture={handleGesture} />

      {/* INSANE MODE */}
      {insaneAlert && (
        <div className={`${styles.overlay} ${styles.overlayInsane}`}>
          <div className={`${styles.overlayTitle} glitch-text`} style={{ color: "var(--severity-critical)" }}>⚠ CRITICAL THREAT</div>
          <div className={styles.overlayBody} style={{ color: "var(--text-primary)" }}>
            {insaneAlert.type.toUpperCase().replace(/_/g, " ")}<br />
            <span style={{ fontSize: 16, color: "var(--text-secondary)" }}>{insaneAlert.message}</span>
          </div>
          <button onClick={() => setInsaneAlert(null)}
            style={{ marginTop: 30, background: "transparent", border: "2px solid var(--severity-critical)", color: "var(--severity-critical)", padding: "12px 30px", fontFamily: "Orbitron", fontSize: 14, cursor: "pointer", letterSpacing: 2 }}>
            ACKNOWLEDGE
          </button>
          <div className={styles.overlayHint}>✊ Fist gesture to dismiss</div>
        </div>
      )}

      {/* MOTIVATION OVERLAY */}
      {showMotivation && (
        <div className={`${styles.overlay} ${styles.overlayMotivation}`} onClick={() => setShowMotivation(false)}>
          <div style={{ fontSize: 24, color: "var(--severity-low)", fontStyle: "italic", maxWidth: 700, lineHeight: 1.8, textAlign: "center", fontFamily: "'Share Tech Mono', monospace" }}>
            {motivationQuote}
          </div>
        </div>
      )}

      {/* SCANLINE */}
      <div className="scanline-overlay" />
    </>
  );
}
