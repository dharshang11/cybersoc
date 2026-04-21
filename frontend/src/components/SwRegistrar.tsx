"use client";

import { useEffect } from "react";

/** Registers the service worker once on mount. Client-only. */
export default function SwRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => console.warn("[SW] register failed", err));
  }, []);
  return null;
}
