"""WebSocket connection manager for real-time station updates."""

from fastapi import WebSocket
import json


class ConnectionManager:
    """Manages WebSocket connections and broadcasts station updates."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_station_update(self, station_data: dict):
        """Broadcast station availability update to all connected clients."""
        message = json.dumps({
            "type": "station_update",
            "data": station_data
        })
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)

    async def broadcast_booking_update(self, booking_data: dict):
        """Broadcast new booking notification."""
        message = json.dumps({
            "type": "booking_update",
            "data": booking_data
        })
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()
