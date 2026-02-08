from typing import Dict, Set
from fastapi import WebSocket


class ConnectionService:
    def __init__(self):
        self.active_sockets: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_sockets.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_sockets.discard(websocket)

    async def broadcast(self, data: Dict):
        if not self.active_sockets: return
        
        to_remove = []
        for ws in self.active_sockets:
            try: await ws.send_json(data)
            except: to_remove.append(ws)
            
        for ws in to_remove:
            self.active_sockets.discard(ws)