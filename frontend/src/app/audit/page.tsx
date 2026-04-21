"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScrollText, RefreshCw, ArrowLeft, AlertTriangle } from "lucide-react";
import AuthGuard from "../../components/auth/AuthGuard";
import UserBar from "../../components/auth/UserBar";
import { authFetch, StoredUser } from "../../lib/auth";

interface AuditEntry {
  _id?: string;
  timestamp: string;
  user_email: string;
  action: string;
  detail?: string;
  severity?: string;
}

export default function AuditPage() {
  return (
    <AuthGuard>{(user) => <AuditInner user={user} />}</AuthGuard>
  );
}

function AuditInner({ user }: { user: StoredUser }) {
  const router = useRouter();
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await authFetch("/api/audit?limit=300");
      if (res.status === 403) {
        setErr("Admin role required to view audit log");
        setEntries([]);
      } else if (!res.ok) {
        setErr(`Request failed (${res.status})`);
      } else {
        const data = await res.json();
        setEntries(data.data || []);
      }
    } catch (e: any) {
      setErr(e.message || "Could not load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const severityColor = (s?: string) => {
    if (s === "critical") return "#ff0033";
    if (s === "warning") return "#ffcc00";
    return "#00ffcc";
  };

  return (
    <>
      <UserBar user={user} />
      <div style={{ minHeight: "100vh", background: "#050505", padding: "4rem 2rem 2rem", color: "#f0f0f0", fontFamily: '"Share Tech Mono", monospace' }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
            <Link href="/" style={{ color: "#ff1a1a", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}>
              <ArrowLeft size={14} /> BACK TO SOC
            </Link>
            <h1 style={{ fontFamily: '"Orbitron", sans-serif', letterSpacing: 3, fontSize: "1.6rem", textShadow: "0 0 20px rgba(255,26,26,0.4)" }}>
              <ScrollText size={20} style={{ display: "inline", marginRight: 10, verticalAlign: "middle" }} />
              AUDIT LOG
            </h1>
            <button onClick={load} disabled={loading} style={{
              background: "transparent", border: "1px solid #ff1a1a", color: "#ff1a1a",
              padding: "0.5rem 1rem", cursor: "pointer", fontFamily: "inherit", borderRadius: 4,
              display: "flex", alignItems: "center", gap: 6
            }}>
              <RefreshCw size={12} style={loading ? { animation: "spin 1s linear infinite" } : undefined} />
              {loading ? "LOADING..." : "REFRESH"}
            </button>
          </div>

          {err && (
            <div style={{
              background: "rgba(255,0,51,0.15)",
              border: "1px solid #ff0033", color: "#ff3355",
              padding: "1rem", borderRadius: 4, marginBottom: "1rem",
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <AlertTriangle size={18} />
              {err}
            </div>
          )}

          {user.role !== "admin" ? (
            <div style={{ color: "#999", textAlign: "center", padding: "3rem" }}>
              This page is restricted to administrators.
            </div>
          ) : (
            <div style={{
              background: "rgba(15,5,5,0.85)",
              border: "1px solid rgba(255,30,30,0.2)",
              borderRadius: 6, overflow: "hidden",
            }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(255,26,26,0.1)", fontSize: "0.7rem", letterSpacing: 2, color: "#999" }}>
                    <th style={thStyle}>TIMESTAMP</th>
                    <th style={thStyle}>USER</th>
                    <th style={thStyle}>ACTION</th>
                    <th style={thStyle}>DETAIL</th>
                    <th style={thStyle}>SEV</th>
                  </tr>
                </thead>
                <tbody>
                  {!loading && entries.length === 0 && !err && (
                    <tr><td colSpan={5} style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
                      No audit entries yet.
                    </td></tr>
                  )}
                  {entries.map((e, i) => (
                    <tr key={e._id || i} style={{ borderTop: "1px solid rgba(255,30,30,0.1)", fontSize: "0.8rem" }}>
                      <td style={tdStyle}>{new Date(e.timestamp).toLocaleString()}</td>
                      <td style={{ ...tdStyle, color: "#00ffcc" }}>{e.user_email}</td>
                      <td style={{ ...tdStyle, color: "#ff3355", fontWeight: 700 }}>{e.action}</td>
                      <td style={{ ...tdStyle, color: "#ccc" }}>{e.detail || "—"}</td>
                      <td style={{ ...tdStyle }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 3, fontSize: "0.7rem", fontWeight: 700,
                          background: `${severityColor(e.severity)}22`,
                          border: `1px solid ${severityColor(e.severity)}`,
                          color: severityColor(e.severity),
                          letterSpacing: 1,
                        }}>
                          {(e.severity || "info").toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.75rem 1rem", textAlign: "left", fontWeight: 700, textTransform: "uppercase",
};
const tdStyle: React.CSSProperties = {
  padding: "0.6rem 1rem", verticalAlign: "top",
};
