"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import {
  pushSupported,
  getPushSubscription,
  enablePush,
  disablePush,
} from "../../lib/push";

type Status = "unsupported" | "off" | "on" | "busy";

export default function PushBell() {
  const [status, setStatus] = useState<Status>("busy");
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const sub = await getPushSubscription();
        if (!cancelled) setStatus(sub ? "on" : "off");
      } catch {
        if (!cancelled) setStatus("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function toggle() {
    if (status === "unsupported") return;
    setStatus("busy");
    setHint(null);
    try {
      if (status === "on") {
        const res = await disablePush();
        setStatus(res.ok ? "off" : "on");
        if (!res.ok) setHint(res.reason || "Failed");
      } else {
        const res = await enablePush();
        setStatus(res.ok ? "on" : "off");
        if (!res.ok) setHint(res.reason || "Failed");
      }
    } catch (e: any) {
      setStatus("off");
      setHint(e?.message || "Failed");
    }
  }

  if (status === "unsupported") return null;

  const Icon = status === "on" ? BellRing : status === "busy" ? Bell : BellOff;
  const color = status === "on" ? "#00ffcc" : "#999";
  const label = status === "on" ? "ALERTS ON" : status === "busy" ? "…" : "ALERTS OFF";

  return (
    <button
      onClick={toggle}
      disabled={status === "busy"}
      title={hint || (status === "on" ? "Disable critical-alert push" : "Enable critical-alert push")}
      style={{
        background: "transparent",
        border: `1px solid ${color}55`,
        color,
        padding: "0.3rem 0.55rem",
        borderRadius: 3,
        cursor: status === "busy" ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: "0.72rem",
        letterSpacing: 1,
      }}
    >
      <Icon size={12} />
      {label}
    </button>
  );
}
