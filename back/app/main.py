import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes import router
from .api.auth import router as auth_router

# Global state for GeNN model building
current_builder = None
model_info = None

# --- Setup ---
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

app.include_router(router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])

# --- Main Entry Point ---

if __name__ == "__main__":    
    print("=" * 60)
    print("SNNverse Backend with GeNN Integration (Python Runtime)")
    print("=" * 60)
    print(f"Server starting on http://0.0.0.0:8000")
    print("=" * 60)
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
