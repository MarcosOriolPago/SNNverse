"""
SpikeVerse Backend — Main Entry Point

Starts the FastAPI server with CORS and route registration.
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .api.routes import router
from .api.auth import router as auth_router

app = FastAPI(title="SpikeVerse Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    print(f"Validation error: {exc}")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )


app.include_router(router, prefix="/api")
app.include_router(auth_router, prefix="/api/auth", tags=["Authentication"])


if __name__ == "__main__":
    print("=" * 60)
    print("SpikeVerse Backend v2.0 (Refactored)")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
