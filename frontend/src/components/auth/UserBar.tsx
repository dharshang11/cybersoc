"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCog, ShieldCheck, Activity, ScrollText } from "lucide-react";
import { clearAuth, StoredUser } from "../../lib/auth";
import PushBell from "./PushBell";

interface UserBarProps {
  user: StoredUser;
}

export default function UserBar({ user }: UserBarProps) {
  const router = useRouter();
  const isAdmin = user.role === "admin";

  function handleLogout() {
    clearAuth();
    router.push("/login");
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 12,
        right: 12,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: "0.6rem",
        padding: "0.5rem 0.8rem",
        background: "rgba(15, 5, 5, 0.85)",
        border: "1px solid rgba(255, 30, 30, 0.3)",
        borderRadius: 6,
        backdropFilter: "blur(8px)",
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: "0.8rem",
        color: "#f0f0f0",
        boxShadow: "0 0 20px rgba(255, 26, 26, 0.15)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.15rem 0.5rem",
          borderRadius: 3,
          background: isAdmin ? "rgba(255, 0, 51, 0.18)" : "rgba(0, 255, 204, 0.12)",
          border: `1px solid ${isAdmin ? "#ff0033" : "#00ffcc"}`,
          color: isAdmin ? "#ff3355" : "#00ffcc",
          fontSize: "0.7rem",
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        {isAdmin ? <ShieldCheck size={12} /> : <Activity size={12} />}
        {user.role.toUpperCase()}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <UserCog size={14} style={{ color: "#999" }} />
        <span style={{ color: "#ccc" }}>{user.name}</span>
      </div>

      <PushBell />

      {isAdmin && (
        <Link
          href="/audit"
          title="View audit log"
          style={{
            color: "#00ffcc",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "0.3rem 0.5rem",
            border: "1px solid rgba(0, 255, 204, 0.3)",
            borderRadius: 3,
            fontSize: "0.75rem",
            letterSpacing: 1,
          }}
        >
          <ScrollText size={12} />
          AUDIT
        </Link>
      )}

      <button
        onClick={handleLogout}
        title="Sign out"
        style={{
          background: "transparent",
          border: "1px solid rgba(255, 30, 30, 0.3)",
          color: "#ff1a1a",
          padding: "0.3rem 0.5rem",
          borderRadius: 3,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          fontFamily: '"Share Tech Mono", monospace',
          fontSize: "0.75rem",
          letterSpacing: 1,
          transition: "all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255, 30, 30, 0.2)";
          e.currentTarget.style.borderColor = "#ff1a1a";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.borderColor = "rgba(255, 30, 30, 0.3)";
        }}
      >
        <LogOut size={12} />
        EXIT
      </button>
    </div>
  );
}
