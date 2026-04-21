"""
Web Push notifications via VAPID + pywebpush.

- VAPID keys are read from env (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY). If not
  present, we generate an ephemeral keypair at import time so the app still
  starts — but the frontend will need the env-configured public key to
  persist subscriptions across restarts.

- send_push_to_all(...) fans out to every stored subscription. Dead/expired
  endpoints (410/404) are removed from storage so the list doesn't grow
  stale.
"""
import os
import json
import base64
import asyncio
from typing import Optional, Dict, Any

from pywebpush import webpush, WebPushException
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from database import get_push_subscriptions, remove_push_subscription


# ─────────────────── VAPID KEYS ───────────────────

VAPID_PUBLIC_KEY = os.getenv("VAPID_PUBLIC_KEY", "").strip()
VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
VAPID_SUBJECT = os.getenv("VAPID_SUBJECT", "mailto:admin@cybersoc.local").strip()


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _generate_ephemeral_vapid_keys():
    """Generate a P-256 keypair for VAPID. Used only when env keys are missing."""
    private_key = ec.generate_private_key(ec.SECP256R1())

    # Private key as base64url-encoded raw 32 bytes
    private_numbers = private_key.private_numbers()
    private_value = private_numbers.private_value.to_bytes(32, byteorder="big")
    priv_b64 = _b64url(private_value)

    # Public key as uncompressed 65-byte point (0x04 || X || Y)
    public_bytes = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint,
    )
    pub_b64 = _b64url(public_bytes)

    return pub_b64, priv_b64


if not VAPID_PUBLIC_KEY or not VAPID_PRIVATE_KEY:
    print("[PUSH] VAPID keys not set in env — generating ephemeral keys. "
          "Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in production.")
    VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY = _generate_ephemeral_vapid_keys()


def get_vapid_public_key() -> str:
    """Return the VAPID public key (base64url-encoded, used by the browser to subscribe)."""
    return VAPID_PUBLIC_KEY


# ─────────────────── SEND ───────────────────

def _send_one_sync(sub: Dict[str, Any], payload: str) -> Optional[int]:
    """Blocking webpush call — intended to run in a thread pool."""
    try:
        webpush(
            subscription_info={
                "endpoint": sub["endpoint"],
                "keys": sub.get("keys", {}),
            },
            data=payload,
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
        )
        return None
    except WebPushException as e:
        # 410 Gone or 404 Not Found — subscription is dead, purge it.
        status = getattr(getattr(e, "response", None), "status_code", None)
        return status
    except Exception as e:
        print(f"[PUSH] send error: {e}")
        return None


async def send_push_to_all(title: str, body: str, data: Optional[Dict[str, Any]] = None):
    """
    Send a push notification to every stored subscription.
    Removes any subscription that reports 404/410.
    """
    subs = await get_push_subscriptions()
    if not subs:
        return {"sent": 0, "removed": 0}

    payload = json.dumps({
        "title": title,
        "body": body,
        "data": data or {},
    })

    loop = asyncio.get_event_loop()
    results = await asyncio.gather(*[
        loop.run_in_executor(None, _send_one_sync, sub, payload) for sub in subs
    ])

    sent = 0
    removed = 0
    for sub, status in zip(subs, results):
        if status in (404, 410):
            try:
                await remove_push_subscription(sub.get("endpoint", ""))
                removed += 1
            except Exception:
                pass
        else:
            sent += 1

    print(f"[PUSH] dispatched: sent={sent} removed={removed} title={title!r}")
    return {"sent": sent, "removed": removed}
