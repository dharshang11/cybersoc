// Browser-side Web Push helpers.
import { API_URL, authFetch } from "./auth";

/** Convert base64url VAPID public key → Uint8Array for PushManager. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Std = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64Std);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i);
  return output;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "Push not supported in this browser" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "Permission denied" };

  const keyRes = await fetch(`${API_URL}/api/push/public-key`);
  if (!keyRes.ok) return { ok: false, reason: "Could not fetch VAPID key" };
  const { public_key } = await keyRes.json();
  if (!public_key) return { ok: false, reason: "Server returned empty VAPID key" };

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(public_key) as any,
    });
  }

  const subJSON = sub.toJSON();
  const res = await authFetch("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({
      endpoint: subJSON.endpoint,
      keys: subJSON.keys || {},
    }),
  });
  if (!res.ok) return { ok: false, reason: `Subscribe failed (${res.status})` };
  return { ok: true };
}

export async function disablePush(): Promise<{ ok: boolean; reason?: string }> {
  if (!pushSupported()) return { ok: false, reason: "Push not supported" };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { ok: true };

  const subJSON = sub.toJSON();
  try {
    await authFetch("/api/push/unsubscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint: subJSON.endpoint, keys: subJSON.keys || {} }),
    });
  } catch {
    /* best-effort server-side cleanup */
  }
  try {
    await sub.unsubscribe();
  } catch {
    /* ignore */
  }
  return { ok: true };
}
