import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cybersoc")

# Set very short timeouts so DB failures don't block the app
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=2000,
    connectTimeoutMS=2000,
    socketTimeoutMS=2000
)
db = client.get_database("cybersoc")

_db_available = None

# In-memory fallback so auth still works without Mongo (useful for local dev + demo)
_memory_users = {}       # email -> user dict
_memory_audit = []       # list of audit entries
_memory_push_subs = []   # list of push subscription dicts


async def test_db_connection():
    global _db_available
    try:
        await client.server_info()
        _db_available = True
        print("[DB] Connected to MongoDB!")
        # Ensure indexes for users (unique email)
        try:
            await db.users.create_index("email", unique=True)
        except Exception:
            pass
    except Exception as e:
        _db_available = False
        print(f"[DB] MongoDB unavailable — using in-memory store. ({type(e).__name__})")


async def insert_log(collection_name: str, document: dict):
    if _db_available is False:
        return None
    try:
        collection = db.get_collection(collection_name)
        result = await collection.insert_one(document)
        return str(result.inserted_id)
    except Exception:
        return None


async def get_logs(collection_name: str, limit: int = 100):
    if _db_available is False:
        if collection_name == "audit_log":
            return list(reversed(_memory_audit[-limit:]))
        return []
    try:
        collection = db.get_collection(collection_name)
        cursor = collection.find().sort("_id", -1).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception:
        return []


# ─────────────────── USERS ───────────────────

async def find_user_by_email(email: str):
    email = (email or "").lower().strip()
    if _db_available is False:
        return _memory_users.get(email)
    try:
        user = await db.users.find_one({"email": email})
        return user
    except Exception:
        return None


async def create_user(user_doc: dict):
    user_doc["email"] = user_doc["email"].lower().strip()
    user_doc["created_at"] = datetime.utcnow().isoformat()
    if _db_available is False:
        if user_doc["email"] in _memory_users:
            return None
        _memory_users[user_doc["email"]] = user_doc
        return "memory-" + user_doc["email"]
    try:
        result = await db.users.insert_one(user_doc)
        return str(result.inserted_id)
    except Exception:
        return None


async def update_user(email: str, updates: dict):
    email = email.lower().strip()
    if _db_available is False:
        user = _memory_users.get(email)
        if user:
            user.update(updates)
            return True
        return False
    try:
        await db.users.update_one({"email": email}, {"$set": updates})
        return True
    except Exception:
        return False


# ─────────────────── AUDIT LOG ───────────────────

async def add_audit(user_email: str, action: str, detail: str = "", severity: str = "info"):
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "user_email": user_email,
        "action": action,
        "detail": detail,
        "severity": severity,
    }
    if _db_available is False:
        _memory_audit.append(entry)
        if len(_memory_audit) > 500:
            del _memory_audit[:100]
        return "memory-audit"
    try:
        result = await db.audit_log.insert_one(entry)
        return str(result.inserted_id)
    except Exception:
        return None


# ─────────────────── PUSH SUBSCRIPTIONS ───────────────────

async def add_push_subscription(sub: dict):
    if _db_available is False:
        # De-dup by endpoint
        if not any(s.get("endpoint") == sub.get("endpoint") for s in _memory_push_subs):
            _memory_push_subs.append(sub)
        return True
    try:
        await db.push_subscriptions.update_one(
            {"endpoint": sub["endpoint"]}, {"$set": sub}, upsert=True
        )
        return True
    except Exception:
        return False


async def get_push_subscriptions():
    if _db_available is False:
        return list(_memory_push_subs)
    try:
        cursor = db.push_subscriptions.find()
        return await cursor.to_list(length=500)
    except Exception:
        return []


async def remove_push_subscription(endpoint: str):
    if _db_available is False:
        global _memory_push_subs
        _memory_push_subs = [s for s in _memory_push_subs if s.get("endpoint") != endpoint]
        return True
    try:
        await db.push_subscriptions.delete_one({"endpoint": endpoint})
        return True
    except Exception:
        return False
