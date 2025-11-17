from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse
import uuid
import os
from trainer import run_experiment
from typing import Optional


app = FastAPI()
OUT_DIR = "/tmp/snn_playground_outputs"
os.makedirs(OUT_DIR, exist_ok=True)

@app.post("/run")
async def run(name: Optional[str] = "demo", steps: Optional[int] = 50):
    """
    Kick off a short experiment. Returns a job id and will produce:
      - <jobid>_raster.png
      - <jobid>_log.txt
    Synchronous: we run the job and return file on completion (small jobs). For larger jobs, change to background tasks + polling.
    """
    job_id = str(uuid.uuid4())[:8]
    out_png = os.path.join(OUT_DIR, f"{job_id}_raster.png")
    out_log = os.path.join(OUT_DIR, f"{job_id}_log.txt")

    try:
        # run_experiment returns (success, message)
        success, msg = run_experiment(out_png, out_log, steps=int(steps), name=name)
        if not success:
            return JSONResponse({"job_id": job_id, "status": "failed", "message": msg}, status_code=500)
    except Exception as e:
        return JSONResponse({"job_id": job_id, "status": "error", "message": str(e)}, status_code=500)

    return FileResponse(out_png, media_type="image/png", filename=f"{job_id}_raster.png")

@app.get("/health")
async def health():
    return {"status": "ok"}
