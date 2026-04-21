"""Authentication helpers: password hashing, JWT, TOTP."""
import os
import base64
import io
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Header, status
from passlib.context import CryptContext
from jose import jwt, JWTError
import pyotp
import qrcode

from database import find_user_by_email

# ─────────────────── CONFIG ───────────────────

SECRET_KEY = os.getenv("SECRET_KEY", "change-me-to-something-secret-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 12

TOTP_ISSUER = "CyberSOC"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ─────────────────── PASSWORD HASHING ───────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


# ─────────────────── JWT ───────────────────

def create_access_token(email: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    payload = {"sub": email, "role": role, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


# ─────────────────── TOTP ───────────────────

def generate_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    try:
        totp = pyotp.TOTP(secret)
        # Accept +-1 step for clock drift tolerance
        return totp.verify(code, valid_window=1)
    except Exception:
        return False


def build_totp_uri(secret: str, email: str) -> str:
    return pyotp.totp.TOTP(secret).provisioning_uri(name=email, issuer_name=TOTP_ISSUER)


def build_totp_qr_data_url(secret: str, email: str) -> str:
    """Return a base64 PNG data URL of the TOTP QR code for Google Authenticator."""
    uri = build_totp_uri(secret, email)
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


# ─────────────────── FASTAPI DEPENDENCIES ───────────────────

async def get_current_user(authorization: str = Header(None)) -> dict:
    """Extract + verify JWT from Authorization header. Returns user dict from DB."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]
    payload = decode_access_token(token)
    email = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = await find_user_by_email(email)
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_role(required_role: str):
    """Returns a dependency that requires the user to have the given role (or admin)."""
    async def _checker(user: dict = Depends(get_current_user)) -> dict:
        role = user.get("role", "analyst")
        if role != required_role and role != "admin":
            raise HTTPException(status_code=403, detail=f"Requires {required_role} role")
        return user
    return _checker
