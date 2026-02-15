# Docker Deployment Guide

This project provides two Docker configurations:

## Local Development (x86/Ubuntu)

Use the standard `docker-compose.yml` for local development on x86_64 Ubuntu systems:

```bash
# Build and start all services
docker-compose up --build

# Stop services
docker-compose down
```

**Configuration:**
- Uses `back/Dockerfile.cpu` for x86 CPU-only backend
- Optimized for local development performance
- Resource limits: 4GB RAM, 2 CPUs for backend

## ARM Deployment (Oracle VM Free Tier)

Use `docker-compose.arm.yml` for deployment on ARM-based systems like Oracle Cloud free tier VMs:

```bash
# Build and start all services
docker-compose -f docker-compose.arm.yml up --build

# Stop services
docker-compose -f docker-compose.arm.yml down
```

**Configuration:**
- Uses `back/Dockerfile.arm` for ARM64 CPU-only backend
- Optimized for Oracle VM free tier constraints
- Resource limits: 2GB RAM, 1.5 CPUs for backend (conservative limits for stability)
- Reduced PostgreSQL and MinIO memory footprints

## Key Differences

### Backend Image
- **Local (x86)**: `back/Dockerfile.cpu` - Standard Ubuntu 22.04 with x86_64 optimizations
- **ARM**: `back/Dockerfile.arm` - Ubuntu 22.04 with ARM64 compatibility

### Resource Allocation
- **Local**: Higher limits for better development performance
- **ARM**: Conservative limits optimized for Oracle VM free tier (1-4 GB RAM, 1-4 vCPUs)

### Frontend
Both configurations use the same frontend `Dockerfile` which is multi-arch compatible (node:20-alpine and nginx:alpine support both x86_64 and ARM64).

## Environment Variables

Create a `.env` file in the project root to customize:

```env
# Database
DB_USER=snnverse_user
DB_PASSWORD=snnverse_password
DB_NAME=snnverse_db

# Storage (MinIO)
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin
```

## Architecture

All Docker configurations are **CPU-only** and do not require GPU/NVIDIA drivers:
- PyTorch CPU versions are used
- GeNN is built with CPU-only support
- No CUDA dependencies

## Troubleshooting

### Building on ARM
If you encounter build issues on ARM:
1. Ensure Docker BuildKit is enabled: `export DOCKER_BUILDKIT=1`
2. Allow longer build times (GeNN compilation can take 10-20 minutes on ARM)

### Memory Issues
If services crash on Oracle VM free tier:
1. Check available memory: `free -h`
2. Reduce resource limits in `docker-compose.arm.yml`
3. Consider disabling unused services temporarily

### Port Conflicts
All services use `network_mode: host` for simplicity. If you encounter port conflicts:
- PostgreSQL: 5432
- MinIO: 9000, 9090
- Backend: 8000, 9001, 9002
- Frontend: 80

Uncomment the `ports` sections and comment out `network_mode: host` in the compose files to use bridge networking instead.
