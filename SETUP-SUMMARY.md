# SNNverse Docker & Kubernetes Setup - Summary

## What Has Been Created

Your SNNverse application is now fully containerized with Docker and ready for production deployment on Google Cloud Platform (GCP) using Kubernetes (GKE).

### 📦 New Files Created

1. **[back/Dockerfile](back/Dockerfile)** - Multi-stage Docker build for backend
   - NVIDIA CUDA 11.8 base image
   - GeNN + CMake + Python + CUDA Toolkit
   - Optimized for GPU computing
   - Health checks included

2. **[front/Dockerfile](front/Dockerfile)** - Multi-stage Docker build for frontend
   - Node 20 Alpine for building
   - Nginx Alpine for serving
   - Optimized bundle size

3. **[front/nginx.conf](front/nginx.conf)** - Production Nginx configuration
   - SPA routing (React Router support)
   - API proxy to backend (/api → backend:8000)
   - WebSocket proxy (/ws → backend:9002)
   - Gzip compression
   - Security headers
   - Static asset caching

4. **[docker-compose.yml](docker-compose.yml)** - Local development stack
   - Backend service with GPU support (optional)
   - Frontend service
   - Shared network
   - Health checks
   - Persistent volume for models
   - Easy `docker-compose up --build` to start

5. **[k8s-deployment.yaml](k8s-deployment.yaml)** - Kubernetes configuration
   - Backend deployment (1 replica) with GPU support
   - Frontend deployment (2 replicas)
   - PersistentVolumeClaim for model storage (10Gi)
   - Services with proper networking
   - NetworkPolicy for security
   - Health checks and readiness probes
   - Resource limits and requests

6. **[deploy.sh](deploy.sh)** - Automated deployment helper script
   - Builds images with correct tagging
   - Pushes to Google Artifact Registry
   - Updates Kubernetes manifests
   - Can deploy to GKE
   - Includes error checking and colored output

7. **[DEPLOYMENT.md](DEPLOYMENT.md)** - Comprehensive deployment guide (15KB+)
   - Prerequisites
   - Local development setup
   - Production deployment steps (GCP/GKE)
   - Architecture diagrams
   - Network configuration
   - Storage considerations
   - Troubleshooting guide
   - Performance tuning
   - Security best practices

8. **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Quick command reference
   - Common Docker commands
   - GCP/Artifact Registry commands
   - Kubernetes commands
   - Troubleshooting snippets
   - Network diagram

9. **[back/.dockerignore](back/.dockerignore)** - Backend build optimization
   - Excludes unnecessary files
   - Reduces image size
   - Faster builds

10. **[front/.dockerignore](front/.dockerignore)** - Frontend build optimization
    - Excludes unnecessary files
    - Faster builds

---

## 🚀 Quick Start

### Local Development (with GPU)

```bash
# Navigate to project root
cd /home/marcos/marcos/snns/SNNverse

# Start the stack
docker-compose up --build

# Access application
# Frontend: http://localhost
# API: http://localhost:8000/api
# API Docs: http://localhost:8000/docs
```

### Local Development (CPU only)

Edit `docker-compose.yml` and comment out the `deploy.resources` section in the backend service, then:

```bash
docker-compose up --build
```

---

## 🏗️ Production Deployment (GCP/GKE)

### 1. Set Environment Variables

```bash
export REGION="europe-west1"
export PROJECT="snnverse-prod"
export REPO="snnverse-repo"
```

### 2. Authenticate with GCP

```bash
gcloud auth configure-docker ${REGION}-docker.pkg.dev
```

### 3. Build & Push Images

Using the automated script:

```bash
./deploy.sh v1              # Build and push v1
./deploy.sh v1 --no-push    # Build only (no push)
./deploy.sh v1 --deploy     # Build, push, and deploy to K8s
```

Or manually:

```bash
# Backend
docker build -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:v1 ./back
docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:v1

# Frontend
docker build -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:v1 ./front
docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:v1
```

### 4. Create GKE Cluster

```bash
gcloud container clusters create snnverse-cluster \
  --zone europe-west1-b \
  --machine-type n1-standard-4 \
  --num-nodes 3 \
  --enable-gpu \
  --gpu-type nvidia-tesla-v100
```

### 5. Deploy to Kubernetes

```bash
# Update manifest with your values
sed -i "s/REGION/${REGION}/g" k8s-deployment.yaml
sed -i "s/PROJECT/${PROJECT}/g" k8s-deployment.yaml
sed -i "s/REPO/${REPO}/g" k8s-deployment.yaml

# Deploy
kubectl apply -f k8s-deployment.yaml

# Check status
kubectl get all -n snnverse
```

---

## 📋 Key Features

### Backend (Docker)
✅ NVIDIA CUDA 11.8 with cuDNN  
✅ GeNN (GPU-enhanced neuronal networks)  
✅ CMake & C++ compiler  
✅ Python 3.10 with all dependencies  
✅ FastAPI web server on port 8000  
✅ WebSocket runners on ports 9001/9002  
✅ Multi-stage build for optimized size  
✅ Health checks included  

### Frontend (Docker)
✅ React + TypeScript build optimization  
✅ Vite build system  
✅ Nginx with gzip compression  
✅ Security headers  
✅ SPA routing support  
✅ Static asset caching  
✅ API & WebSocket proxying  

### Kubernetes Deployment
✅ GPU support with NVIDIA resource requests  
✅ Persistent storage for model artifacts  
✅ Replicas for high availability  
✅ Health checks and auto-restart  
✅ NetworkPolicy for security  
✅ Resource limits and requests  
✅ LoadBalancer for external access  
✅ Automatic rollback capability  

---

## 📊 Architecture

```
┌─────────────────────────────────────┐
│       Internet / Browser            │
└──────────────────┬──────────────────┘
                   │
           ┌───────▼────────┐
           │  LoadBalancer  │
           │  (K8s Service) │
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │    Frontend     │
           │  (Nginx)        │
           │  x2 Replicas    │
           └───────┬────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    HTTP API             WebSocket
        │                     │
        └──────────┬──────────┘
                   │
           ┌───────▼──────────┐
           │    Backend       │
           │ (FastAPI/GeNN)   │
           │ x1 Replica       │
           │ +GPU (V100)      │
           └───────┬──────────┘
                   │
           ┌───────▼──────────┐
           │ PersistentVolume │
           │ /tmp/genn_models │
           │  (10GB)          │
           └──────────────────┘
```

---

## 🔧 File Structure

```
SNNverse/
├── back/
│   ├── Dockerfile              ← Multi-stage backend build
│   ├── .dockerignore           ← Build optimization
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   └── routes.py
│   │   └── core/
│   │       └── ...
│   └── ...
├── front/
│   ├── Dockerfile              ← Multi-stage frontend build
│   ├── .dockerignore           ← Build optimization
│   ├── nginx.conf              ← Nginx config (SPA + proxies)
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   └── ...
│   └── ...
├── docker-compose.yml          ← Local dev stack
├── k8s-deployment.yaml         ← GKE deployment config
├── deploy.sh                   ← Automation script
├── DEPLOYMENT.md               ← Complete deployment guide
├── QUICK-REFERENCE.md          ← Command reference
└── README.md
```

---

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Complete guide (>500 lines)
  - All steps for local and production deployment
  - Troubleshooting guide
  - Performance tuning
  - Security best practices

- **[QUICK-REFERENCE.md](QUICK-REFERENCE.md)** - Command cheat sheet
  - Common Docker commands
  - GCP/GKE commands
  - Troubleshooting snippets

---

## 🚨 Important Notes

### Image Sizes
- **Backend**: ~3.5GB (CUDA 11.8 is large!)
- **Frontend**: ~50MB
- First build will take 10-20 minutes for backend

### Storage
- Models stored in `/tmp/genn_models` (ephemeral in containers)
- In Kubernetes, uses PersistentVolumeClaim (persists across pod restarts)
- You can increase PVC size in `k8s-deployment.yaml` (currently 10Gi)

### GPU Support
- Backend requires NVIDIA GPU for full functionality
- Local testing: NVIDIA Container Toolkit required
- GKE: Automatically handled with `--enable-gpu` flag

### Networking
- Frontend proxies API requests to backend automatically
- WebSocket connection routed through Nginx
- No need for CORS configuration (single domain)

---

## ✅ Next Steps

1. **Test Locally**
   ```bash
   docker-compose up --build
   # Verify frontend and API are accessible
   ```

2. **Create GCP Project** (if not already done)
   ```bash
   gcloud projects create snnverse-prod
   gcloud auth application-default login
   ```

3. **Set Up Artifact Registry**
   ```bash
   gcloud artifacts repositories create snnverse-repo \
     --repository-format=docker \
     --location=europe-west1
   ```

4. **Build & Push Images**
   ```bash
   ./deploy.sh v1
   ```

5. **Create GKE Cluster**
   ```bash
   gcloud container clusters create snnverse-cluster \
     --zone europe-west1-b \
     --enable-gpu \
     --gpu-type nvidia-tesla-v100
   ```

6. **Deploy to Kubernetes**
   ```bash
   ./deploy.sh v1 --deploy --update-manifest
   ```

7. **Monitor Deployment**
   ```bash
   kubectl get all -n snnverse
   kubectl logs -n snnverse -l app=backend -f
   ```

---

## 🆘 Troubleshooting

### Docker Build Fails
- Check internet connection (cloning GeNN repo)
- Ensure sufficient disk space (20GB+)
- Review logs: `docker build -t test ./back 2>&1 | tail -50`

### Local Docker Compose Error
- Verify Docker daemon is running
- Check port 80 and 8000 are not in use
- NVIDIA GPU issue? Try without GPU: comment out `deploy.resources`

### Kubernetes Issues
- Check pod status: `kubectl describe pod -n snnverse <pod-name>`
- View logs: `kubectl logs -n snnverse <pod-name>`
- See detailed guide in [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 📧 Support Resources

- GeNN Documentation: https://genn-team.github.io/
- Docker Documentation: https://docs.docker.com/
- Kubernetes Documentation: https://kubernetes.io/docs/
- GCP GKE Documentation: https://cloud.google.com/kubernetes-engine/docs

---

**Your SNNverse application is now ready for containerized deployment!** 🎉

For detailed instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)  
For quick commands, see [QUICK-REFERENCE.md](QUICK-REFERENCE.md)
