import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017/cybersoc")

# Set very short timeouts so DB failures don't block the app
client = AsyncIOMotorClient(
    MONGO_URL,
    serverSelectionTimeoutMS=1000,
    connectTimeoutMS=1000,
    socketTimeoutMS=1000
)
db = client.get_database("cybersoc")

_db_available = None

async def test_db_connection():
    global _db_available
    try:
        await client.server_info()
        _db_available = True
        print("[DB] Connected to MongoDB!")
    except Exception as e:
        _db_available = False
        print(f"[DB] MongoDB unavailable — running without persistence. ({type(e).__name__})")

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
        return []
    try:
        collection = db.get_collection(collection_name)
        cursor = collection.find().sort("_id", -1).limit(limit)
        return await cursor.to_list(length=limit)
    except Exception:
        return []
