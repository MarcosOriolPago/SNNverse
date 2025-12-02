"""
Entry point for running backend as a module:
    python -m back.app
"""

from .main_genn import sio_app
import uvicorn

if __name__ == "__main__":
    print("=" * 60)
    print("SNNverse Backend with GeNN Integration")
    print("=" * 60)
    print(f"Server starting on http://0.0.0.0:8000")
    print("=" * 60)
    
    uvicorn.run(sio_app, host="0.0.0.0", port=8000)
