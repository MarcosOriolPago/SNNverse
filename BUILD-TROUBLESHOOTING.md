# SNNverse Docker Build Troubleshooting Guide

## Common Build Issues and Solutions

### Issue: "Failed to clone GeNN repository"

**Error Message:**
```
fatal: unable to access 'https://github.com/genn-team/genn.git/': Could not resolve host
```

**Solutions:**
1. Check internet connection
2. Verify GitHub is accessible: `ping github.com`
3. Check proxy settings if behind corporate firewall
4. Try building with explicit network mode:
   ```bash
   docker build --network=host -t snnverse-backend:v1 ./back
   ```
5. Build with BuildKit enabled:
   ```bash
   DOCKER_BUILDKIT=1 docker build -t snnverse-backend:v1 ./back
   ```

---

### Issue: "No space left on device"

**Error Message:**
```
E: Unable to locate package python3-dev
No space left on device
```

**Solutions:**
1. Check Docker disk usage:
   ```bash
   docker system df
   ```

2. Clean up Docker resources:
   ```bash
   # Remove unused images
   docker image prune -a --force
   
   # Remove unused containers
   docker container prune --force
   
   # Remove unused volumes
   docker volume prune --force
   
   # Full cleanup
   docker system prune -a --volumes --force
   ```

3. Increase Docker's disk space:
   - **Linux**: Check filesystem: `df -h /var/lib/docker`
   - **Docker Desktop**: Settings → Resources → Disk image size

4. Required space:
   - Backend build: ~20GB
   - Frontend build: ~2GB
   - Temporary files: ~5GB
   - **Total recommended**: 30GB+

---

### Issue: "pip install fails with SSL certificate error"

**Error Message:**
```
SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed
```

**Solutions:**
1. Update CA certificates in Dockerfile (already included):
   ```dockerfile
   RUN apt-get install -y --no-install-recommends ca-certificates
   ```

2. Rebuild without cache:
   ```bash
   docker build --no-cache -t snnverse-backend:v1 ./back
   ```

3. Try with different pip index:
   ```bash
   pip install -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt
   ```

---

### Issue: "NVIDIA CUDA base image not found"

**Error Message:**
```
ERROR: manifest not found
```

**Solutions:**
1. Check Docker login for NVIDIA registry:
   ```bash
   docker login nvcr.io
   ```

2. Pull image manually first:
   ```bash
   docker pull nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
   ```

3. Alternative: Use official CUDA image:
   ```dockerfile
   FROM nvcr.io/nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
   ```

4. If unavailable, use compatible version:
   ```dockerfile
   FROM nvidia/cuda:12.0.0-cudnn8-devel-ubuntu22.04
   ```

---

### Issue: "Python package installation timeout"

**Error Message:**
```
WARNING: pip is being invoked by an old script wrapper.
ERROR: pip's dependency resolver does not currently work with packages
```

**Solutions:**
1. Increase pip timeout:
   ```dockerfile
   RUN pip install --default-timeout=100 -r requirements.txt
   ```

2. Install key packages separately:
   ```dockerfile
   RUN pip install --no-cache-dir numpy
   RUN pip install --no-cache-dir torch
   RUN pip install --no-cache-dir pygenn>=5.0.0
   ```

3. Use Alpine with additional packages:
   ```bash
   apt-get install -y libffi-dev libssl-dev build-essential
   ```

---

### Issue: "GeNN build fails with CMake error"

**Error Message:**
```
CMake Error: The source directory does not contain a CMakeLists.txt file
```

**Solutions:**
1. Verify git clone succeeded:
   ```dockerfile
   RUN git clone https://github.com/genn-team/genn.git ${GENN_PATH} && \
       ls -la ${GENN_PATH}/
   ```

2. Check GeNN version compatibility:
   ```dockerfile
   RUN cd ${GENN_PATH} && git checkout v5.0.0  # Specific version
   ```

3. Install build essentials first:
   ```dockerfile
   RUN apt-get install -y build-essential cmake git
   ```

4. Build with verbose output:
   ```dockerfile
   RUN cd ${GENN_PATH} && python3 setup.py develop --verbose
   ```

---

### Issue: "Build takes too long (30+ minutes)"

**Solutions:**
1. Use BuildKit for faster builds:
   ```bash
   DOCKER_BUILDKIT=1 docker build -t snnverse-backend:v1 ./back
   ```

2. Build backend only (skip frontend initially):
   ```bash
   docker build -t snnverse-backend:v1 ./back
   ```

3. Cache intermediate layers:
   - Don't use `--no-cache` unless necessary
   - Order Dockerfile commands by change frequency (rarely-changing first)

4. Use Docker layer caching:
   ```bash
   # Subsequent builds will be faster
   docker build -t snnverse-backend:v1 ./back
   docker build -t snnverse-backend:v2 ./back  # Uses cached layers
   ```

---

### Issue: "Frontend build fails with Node/npm error"

**Error Message:**
```
ERR! code E403
ERR! 403 Forbidden
```

**Solutions:**
1. Clear npm cache:
   ```dockerfile
   RUN npm cache clean --force
   RUN npm install
   ```

2. Use yarn instead:
   ```dockerfile
   RUN yarn install
   RUN yarn build
   ```

3. Use different npm registry:
   ```dockerfile
   RUN npm config set registry https://registry.npmmirror.com
   ```

---

### Issue: "Docker context too large"

**Error Message:**
```
error: failed to solve with frontend dockerfile.v0:
failed to build LLB: path /home/user/project is too large
```

**Solutions:**
1. Create/update `.dockerignore`:
   ```
   node_modules
   dist
   __pycache__
   .git
   ```

2. Remove large unnecessary files:
   ```bash
   rm -rf ./back/__pycache__
   rm -rf ./front/node_modules
   rm -rf ./.git
   ```

3. Build from a clean directory:
   ```bash
   cd /tmp
   cp -r /home/marcos/snns/SNNverse .
   cd SNNverse
   docker build -t snnverse-backend:v1 ./back
   ```

---

## Build Performance Optimization Tips

### 1. Use Multi-stage Builds ✅
Already implemented in your Dockerfiles

### 2. Order Dockerfile commands by change frequency
```dockerfile
# Rarely changes - put first
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# System packages - don't change often
RUN apt-get update && apt-get install ...

# Python packages - change more often
RUN pip install -r requirements.txt

# Application code - changes frequently
COPY . .
```

### 3. Use .dockerignore ✅
Already created for your project

### 4. Leverage layer caching
- Don't add `--no-cache` unnecessarily
- Change frequently-changed layers last

### 5. Use smaller base images
```dockerfile
# Current (large but has CUDA)
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

# For CPU-only (much smaller)
FROM python:3.10-slim
```

---

## Build Commands Reference

### Standard Build
```bash
docker build -t snnverse-backend:v1 ./back
```

### Build without cache (force rebuild)
```bash
docker build --no-cache -t snnverse-backend:v1 ./back
```

### Build with BuildKit (faster)
```bash
DOCKER_BUILDKIT=1 docker build -t snnverse-backend:v1 ./back
```

### Build with verbose output
```bash
docker build --progress=plain -t snnverse-backend:v1 ./back
```

### Build with specific build args
```bash
docker build \
  --build-arg GENN_VER=5.0.0 \
  -t snnverse-backend:v1 ./back
```

### View build history
```bash
docker history snnverse-backend:v1
```

### Check image size
```bash
docker images snnverse-backend:v1
```

---

## Testing Image Locally

### Run container interactively
```bash
docker run -it --gpus all snnverse-backend:v1 /bin/bash
```

### Test Python imports
```bash
docker run --rm snnverse-backend:v1 \
  python -c "import pygenn; print(pygenn.__version__)"
```

### Test API
```bash
# Start container
docker run -p 8000:8000 snnverse-backend:v1

# In another terminal
curl http://localhost:8000/docs
```

### Check installed packages
```bash
docker run --rm snnverse-backend:v1 pip list
```

---

## Debugging Build Failures

### 1. Build step-by-step
```bash
# Create a test Dockerfile with just the failing part
cat > Dockerfile.test << 'EOF'
FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
RUN apt-get update && apt-get install -y python3-dev
RUN python3 --version
EOF

docker build -t test -f Dockerfile.test .
```

### 2. Inspect intermediate images
```bash
# Build stops at failed step
docker build -t snnverse-backend:v1 ./back

# Find the last successful layer from output
# docker run -it <LAYER_ID> /bin/bash

# Inspect what's in the image
docker inspect snnverse-backend:v1
```

### 3. Build with verbose logging
```bash
DOCKER_BUILDKIT=0 docker build --progress=plain \
  -t snnverse-backend:v1 ./back 2>&1 | tee build.log

# Review log for errors
grep -i error build.log
```

### 4. Test requirements.txt separately
```bash
# Create minimal Dockerfile
cat > Dockerfile.req << 'EOF'
FROM python:3.10
COPY requirements.txt .
RUN pip install -r requirements.txt
EOF

docker build -t test -f Dockerfile.req .
```

---

## When All Else Fails

### 1. Complete Docker reset (⚠️ WARNING: destructive)
```bash
# Stop all containers
docker stop $(docker ps -aq)

# Remove all containers
docker rm $(docker ps -aq)

# Remove all images
docker rmi $(docker images -q)

# Remove all volumes
docker volume rm $(docker volume ls -q)

# Clean system
docker system prune -a --volumes --force

# Restart Docker daemon
sudo systemctl restart docker
```

### 2. Use Docker in Docker
```bash
# Build in isolated environment
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
  -v $(pwd):/workspace -w /workspace \
  docker:latest \
  docker build -t snnverse-backend:v1 ./back
```

### 3. Build on different machine
- Use cloud build service (Google Cloud Build, GitHub Actions, etc.)
- Build on a machine with more resources
- Use cloud-hosted CI/CD pipeline

---

## Getting Help

### Check Logs
```bash
# View last 100 lines
docker build -t test ./back 2>&1 | tail -100

# Save full log
docker build -t test ./back > build.log 2>&1
cat build.log
```

### Useful Information to Gather
When reporting issues:
- Full build output (save to file)
- Docker version: `docker --version`
- Docker system info: `docker system info | head -20`
- Disk space: `df -h`
- Memory: `free -h`
- Available GPUs: `docker run --rm --gpus all nvidia/cuda:11.8.0-base nvidia-smi`

### Relevant Issue Trackers
- GeNN Issues: https://github.com/genn-team/genn/issues
- Docker Issues: https://github.com/moby/moby/issues
- NVIDIA Container Toolkit: https://github.com/NVIDIA/nvidia-docker/issues

---

## Quick Reference: Build Checklist

- [ ] Docker installed and running
- [ ] 30GB+ free disk space
- [ ] Internet connection stable
- [ ] No other heavy Docker builds running
- [ ] `.dockerignore` files in place
- [ ] `requirements.txt` dependencies are pinned
- [ ] `package.json` dependencies are resolved
- [ ] Base image tags are correct/available
- [ ] Proxy settings configured (if behind corporate firewall)
- [ ] GPU driver compatible with CUDA 11.8 (if using GPU)

---

For more help, see the main [DEPLOYMENT.md](DEPLOYMENT.md) file or [QUICK-REFERENCE.md](QUICK-REFERENCE.md).
