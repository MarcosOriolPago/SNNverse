#!/usr/bin/env python
import uvicorn
from app.main import sio_app

if __name__ == "__main__":
    print("Starting SNNverse Backend...")
    print("Server: http://localhost:8000")
    print("Press Ctrl+C to stop\n")
    
    uvicorn.run(
        sio_app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )