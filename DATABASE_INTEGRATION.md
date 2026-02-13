# SNNverse Database & Scaling Integration Guide

## Overview

This document describes the integration of PostgreSQL and MinIO artifact storage into SNNverse for cloud-scalable neuromorphic simulation.

## Architecture Changes

### Database Layer (`models.py`, `database.py`)

#### SQLAlchemy Models

Three core models provide persistence:

1. **User**
   - `user_id` (UUID, PK)
   - `username` (unique)
   - `password_hash`
   - `created_at`, `updated_at`

2. **Network**
   - `network_id` (UUID, PK)
   - `user_id` (FK → User)
   - `name`, `description`
   - `metadata_json` (JSONB) - Frontend node/edge config
   - `compiled_code_url` (S3/MinIO path)
   - `model_sha` (GeNN model checksum - SHA256)
   - `backend_used`, `is_example`
   - `created_at`, `updated_at`, `last_compiled_at`

3. **SimulationStat**
   - `stat_id` (UUID, PK)
   - `user_id` (FK → User)
   - `network_id` (FK → Network)
   - `duration_ms`, `spike_count`, `num_timesteps`
   - `wall_time_ms`, `memory_peak_mb`
   - `backend_used`, `status`
   - `used_precompiled` (bool - tracks warm-starts)
   - `created_at`

#### Connection Pooling

`DatabaseManager` handles:
- QueuePool with configurable size/overflow
- Connection pre-ping for stale connection detection
- Session factory with autocommit=False
- Context manager for transaction safety

```python
from app.core.database import get_db_manager

db = get_db_manager()  # Initializes connection pool
with db.session_context() as session:
    user = session.query(User).filter_by(username="john").first()
```

### Artifact Storage (`artifact_storage.py`)

#### ModelArchiver

Compresses compiled GeNN code:

```python
# Archive after successful build
zip_path, model_sha = archiver.archive_model("/path/to/model_CODE")
# Returns: ("/tmp/snn_archives/model_CODE_abc12345.zip", "sha256hash...")
```

Features:
- SHA256 hashing of entire model directory
- Preserves directory structure in zip
- Validates extracted artifacts

#### ArtifactStorageClient

Uploads/downloads to S3/MinIO:

```python
storage = get_storage_client()

# Upload compiled model
s3_url = storage.upload_model(zip_path, network_id, model_sha)
# Returns: "s3://snnverse-models/models/network-uuid_abc12345.zip"

# Download for warm-start
storage.download_model(s3_url, "/tmp/local_copy.zip")
```

Supports both AWS S3 and MinIO with path-style URLs.

### Decoupled Building (Refactored `genn_builder.py`)

#### Key Improvements

1. **Thread-Safe Compilation**
   ```python
   # Global lock prevents concurrent builds
   _build_lock = threading.Lock()
   
   def build_from_json(self, payload, ...):
       with _build_lock:
           return self._build_from_json_impl(payload, ...)
   ```
   Prevents C++ generation segfaults from memory contention.

2. **Stack & Environment Safety**
   ```python
   set_unlimited_stack()  # resource.setrlimit(RLIMIT_STACK, ...)
   verify_environment()   # Sets GENN_PATH, LD_LIBRARY_PATH
   ```
   Called on first builder instantiation.

3. **Integrated Artifact Pipeline**
   ```python
   model.build()  # GeNN compilation
   model_sha = archiver.compute_model_sha(code_dir)
   zip_path, sha = archiver.archive_model(code_dir)
   url = storage_client.upload_model(zip_path, network_id, sha)
   _save_network_to_db(payload, url, sha)  # Persist metadata
   ```

4. **Warm-Start Escalation**
   ```python
   # On new container instance
   builder = GeNNNetworkBuilder(network_id=network_id, user_id=user_id)
   
   # Try warm-start first
   if builder.warm_start_from_db(network_id, user_id):
       # Precompiled model loaded from artifact storage
       builder.load_model(num_recording_timesteps=1000)
   else:
       # Fall back to full build
       builder.build_from_json(payload)
       builder.load_model(num_recording_timesteps=1000)
   ```

   The `warm_start_from_db()` method:
   - Queries database for `compiled_code_url`
   - Downloads .zip from S3/MinIO
   - Extracts to local `/tmp/genn_models`
   - Verifies SHA256 matches
   - Loads precompiled runner (no compilation needed)

## Environment Configuration

Create a `.env` file in project root:

```bash
# Database (PostgreSQL)
DB_HOST=postgres
DB_PORT=5432
DB_USER=snnverse_user
DB_PASSWORD=snnverse_password
DB_NAME=snnverse_db
DB_POOL_SIZE=10
DB_MAX_OVERFLOW=20
DB_POOL_RECYCLE=3600

# Storage (MinIO)
STORAGE_TYPE=minio
STORAGE_ENDPOINT_URL=http://minio:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
STORAGE_BUCKET=snnverse-models
STORAGE_REGION=us-east-1
STORAGE_PATH_STYLE=true

# For AWS S3 (alternative):
# STORAGE_TYPE=s3
# STORAGE_ENDPOINT_URL=https://s3.amazonaws.com
# STORAGE_REGION=us-east-1
```

## Docker Compose Integration

Updated `docker-compose.yml` now includes:

### PostgreSQL Service
```yaml
postgres:
  image: postgres:15-alpine
  environment:
    POSTGRES_USER: snnverse_user
    POSTGRES_PASSWORD: snnverse_password
    POSTGRES_DB: snnverse_db
  volumes:
    - postgres_data:/var/lib/postgresql/data
  healthcheck: pg_isready
```

### MinIO Service
```yaml
minio:
  image: minio/minio:latest
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /minio_data --console-address ":9001"
  volumes:
    - minio_data:/minio_data
```

### Backend Service Dependencies
```yaml
backend:
  depends_on:
    postgres:
      condition: service_healthy
    minio:
      condition: service_healthy
  environment:
    DB_HOST: postgres
    STORAGE_ENDPOINT_URL: http://minio:9000
```

### Named Volumes
```yaml
volumes:
  postgres_data:
  minio_data:
  genn_models:
  snn_archives:
```

## Usage Examples

### Starting Infrastructure

```bash
# With environment config
docker-compose --env-file .env up -d

# Check service health
docker-compose ps
# postgres ✓ healthy
# minio   ✓ healthy
# backend ✓ healthy
```

### Building & Persisting a Network

```python
from app.core.genn_builder import GeNNNetworkBuilder
from app.core.database import get_db_manager
import uuid

user_id = uuid.uuid4()
network_id = uuid.uuid4()

payload = {
    "name": "Example Network",
    "nodes": [...],
    "edges": [...]
}

builder = GeNNNetworkBuilder(
    network_id=network_id,
    user_id=user_id,
    model_id="example_net"
)

# Build, archive, upload, and persist to DB (all in one call)
code_path, metadata = builder.build_from_json(payload, save_to_db=True)

# Metadata now includes:
# {
#   "name": "example_net",
#   "model_sha": "abc123...",
#   "network_id": "uuid...",
#   ...
# }
```

### Warm-Starting on New Container

```python
# Simulates deployment on new instance
builder = GeNNNetworkBuilder(
    network_id=network_id,
    user_id=user_id,
    model_id="loaded_net"
)

# Quick check - returns True if artifact exists
if builder.warm_start_from_db(network_id, user_id):
    print("✓ Loaded from artifact (no compilation)")
    builder.load_model(num_recording_timesteps=1000)
else:
    print("⚠ Artifact not available, building from scratch")
    builder.build_from_json(payload)
    builder.load_model(num_recording_timesteps=1000)
```

### Recording Simulation Stats

```python
from app.core.models import SimulationStat
from app.core.database import get_db_manager
from datetime import datetime

db = get_db_manager()

with db.session_context() as session:
    stat = SimulationStat(
        user_id=user_id,
        network_id=network_id,
        duration_ms=150.5,
        spike_count=4250,
        wall_time_ms=145.2,
        memory_peak_mb=512.3,
        backend_used="cpu",
        status="completed",
        used_precompiled=True,  # Warm-start was used
        num_timesteps=1000
    )
    session.add(stat)
    session.commit()

# Query analytics
with db.session_context() as session:
    avg_duration = session.query(
        func.avg(SimulationStat.duration_ms)
    ).filter_by(network_id=network_id).scalar()
```

## Reliability Features

### Stack Limit Safety

Every worker process automatically sets:
```python
resource.setrlimit(resource.RLIMIT_STACK, (resource.RLIM_INFINITY, hard_limit))
```

Prevents segmentation faults during intense C++ generation.

### Singleton Safety

Thread-local build lock ensures:
- Only one `model.build()` per worker process
- Prevents memory corruption from concurrent C++ compilation
- Queues additional build requests

```python
with _build_lock:
    # Only one thread executes this at a time
    self.model.build()
```

### Environment Verification

On first GeNN builder instantiation:
```python
verify_environment()
# Sets GENN_PATH if missing
# Updates LD_LIBRARY_PATH to include GeNN libs
# Tests connection to database before compilation
```

### Connection Pooling

PostgreSQL connections are:
- Pre-pinged before use (detects stale connections)
- Recycled after 1 hour
- Limited to 10 active + 20 overflow
- Automatically closed when sessions exit

## Troubleshooting

### Database Connection Issues

```python
# Check connection string
from app.core.database import DatabaseConfig
config = DatabaseConfig()
print(config.connection_string)
# postgresql+psycopg2://user:password@postgres:5432/snnverse_db

# Test connection
db = get_db_manager()
with db.session_context() as session:
    session.execute("SELECT 1")
```

### MinIO Connectivity

```bash
# Access MinIO console
# http://localhost:9001
# Login: minioadmin / minioadmin

# Check bucket
docker exec snnverse-minio mc ls minio/snnverse-models
```

### Artifact Upload Failures

If `compiled_code_url` is None after build:
1. Check MinIO health: `docker logs snnverse-minio`
2. Verify S3 credentials in environment
3. Check /tmp/snn_archives for local zip file
4. Builder will fall back to `file://` URL if S3 unavailable

## Performance Considerations

### Query Optimization

Indexed columns for fast lookups:
- `Network.user_id` + `Network.name` (compound index)
- `Network.model_sha` (model deduplication)
- `SimulationStat.user_id` + `SimulationStat.created_at` (analytics)

### Connection Pool Tuning

For high-concurrency deployments:
```bash
# Increase pool size
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
```

### Artifact Cleanup

Periodically remove old zip files:
```bash
# Keep last 5 versions per network
find /tmp/snn_archives -name "*.zip" -mtime +7 -delete
```

## Future Enhancements

1. **Incremental Compilation**: Cache unchanged model components
2. **Distributed Building**: Offload GeNN compilation to specialized workers
3. **Model Versioning**: Track multiple compiled versions per network
4. **Auto-Scaling**: Trigger warm-starts on new Kubernetes pods
5. **Compression Formats**: Support different archive formats (tar.gz, etc.)

## API Integration Points

To integrate into FastAPI routes:

```python
from fastapi import Depends
from app.core.database import get_db_session
from app.core.models import Network

@app.post("/api/network/compile")
async def compile_network(
    payload: NetworkPayload,
    session: Session = Depends(get_db_session)
):
    builder = GeNNNetworkBuilder(
        network_id=payload.network_id,
        user_id=payload.user_id
    )
    
    code_path, metadata = builder.build_from_json(
        payload.dict(),
        save_to_db=True
    )
    
    return {
        "status": "success",
        "code_path": code_path,
        "model_sha": metadata["model_sha"],
        "compiled_code_url": session.query(Network)
            .filter_by(network_id=payload.network_id)
            .first()
            .compiled_code_url
    }
```

---

**Last Updated**: February 2026
**Version**: 1.0.0
