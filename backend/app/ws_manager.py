import asyncio
import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, request_id: str, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._connections[request_id].add(ws)

    async def disconnect(self, request_id: str, ws: WebSocket):
        async with self._lock:
            self._connections[request_id].discard(ws)
            if not self._connections[request_id]:
                self._connections.pop(request_id, None)

    async def broadcast(self, request_id: str, event: str, status: str, extra: dict | None = None):
        payload = {
            "event": event,
            "request_id": request_id,
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        if extra:
            payload.update(extra)
        dead = []
        for ws in list(self._connections.get(request_id, [])):
            try:
                await ws.send_text(json.dumps(payload))
            except Exception:
                dead.append(ws)
        for ws in dead:
            await self.disconnect(request_id, ws)


manager = ConnectionManager()
