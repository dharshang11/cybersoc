from fastapi import WebSocket
from typing import List
import json
import logging

logger = logging.getLogger("cybersoc.ws")

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: str):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.warning(f"Failed to send to client: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_json(self, data: dict):
        msg = json.dumps(data)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(msg)
            except Exception as e:
                logger.warning(f"Failed to send JSON to client: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)
        if self.active_connections:
            logger.debug(f"Broadcast to {len(self.active_connections)} clients, type={data.get('type')}")

manager = ConnectionManager()
