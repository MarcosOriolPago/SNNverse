# SNNverse Quick Reference

## Local Development

### Start Services
```bash
docker-compose up --build
```

### Stop Services
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Access Application
- Frontend: http://localhost
- API: http://localhost:8000/api
- API Docs: http://localhost:8000/docs

---

## Docker Image Building

### Build Backend
```bash
docker build -t snnverse-backend:v1 ./back
```

### Build Frontend
```bash
docker build -t snnverse-frontend:v1 ./front
```

### Using Deployment Script
```bash
# Set variables
export REGION="europe-west1"
export PROJECT="snnverse-prod"
export REPO="snnverse-repo"

# Build and push
./deploy.sh v1

# Build only (no push)
./deploy.sh v1 --no-push

# Backend only
./deploy.sh v1 --backend-only

# Deploy to K8s
./deploy.sh v1 --deploy --update-manifest
```

---

## GCP / Artifact Registry

### Authenticate
```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

### Create Repository
```bash
gcloud artifacts repositories create snnverse-repo \
  --repository-format=docker \
  --location=europe-west1 \
  --project=snnverse-prod
```

### Push Image
```bash
docker push europe-west1-docker.pkg.dev/snnverse-prod/snnverse-repo/backend:v1
docker push europe-west1-docker.pkg.dev/snnverse-prod/snnverse-repo/frontend:v1
```

---

## Kubernetes (GKE)

### Create Cluster with GPU
```bash
gcloud container clusters create snnverse-cluster \
  --zone europe-west1-b \
  --machine-type n1-standard-4 \
  --num-nodes 3 \
  --enable-gpu \
  --gpu-type nvidia-tesla-v100
```

### Deploy Application
```bash
# Update k8s-deployment.yaml with your values
sed -i "s/REGION/europe-west1/g" k8s-deployment.yaml
sed -i "s/PROJECT/snnverse-prod/g" k8s-deployment.yaml
sed -i "s/REPO/snnverse-repo/g" k8s-deployment.yaml

# Apply configuration
kubectl apply -f k8s-deployment.yaml
```

### Check Status
```bash
# Deployments
kubectl get deployments -n snnverse

# Pods
kubectl get pods -n snnverse

# Services
kubectl get services -n snnverse

# Events
kubectl get events -n snnverse --sort-by='.lastTimestamp'
```

### View Logs
```bash
kubectl logs -n snnverse -l app=backend -f
kubectl logs -n snnverse -l app=frontend -f
```

### Describe Pod
```bash
kubectl describe pod -n snnverse <pod-name>
```

### Access Application
```bash
# Get frontend LoadBalancer IP
kubectl get service -n snnverse frontend

# Access via EXTERNAL-IP
```

### Update Deployment
```bash
# New image
kubectl set image deployment/backend -n snnverse \
  backend=europe-west1-docker.pkg.dev/snnverse-prod/snnverse-repo/backend:v2

# Monitor rollout
kubectl rollout status deployment/backend -n snnverse

# View history
kubectl rollout history deployment/backend -n snnverse

# Rollback
kubectl rollout undo deployment/backend -n snnverse
```

---

## Troubleshooting

### Check Pod Status
```bash
kubectl describe pod -n snnverse <pod-name>
```

### View Pod Logs
```bash
kubectl logs -n snnverse <pod-name>
```

### Test Backend Connectivity
```bash
kubectl exec -n snnverse <frontend-pod> -- \
  wget -O- http://backend:8000/api/health
```

### Check GPU Availability
```bash
kubectl describe nodes | grep -A 2 "nvidia.com/gpu"
```

### Check PersistentVolume
```bash
kubectl get pvc -n snnverse
kubectl describe pvc -n snnverse genn-models-pvc
```

### SSH into Pod
```bash
kubectl exec -it -n snnverse <pod-name> -- /bin/bash
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `back/Dockerfile` | Backend image with GeNN + CUDA |
| `front/Dockerfile` | Frontend image with Nginx |
| `front/nginx.conf` | Nginx configuration for SPA routing & proxies |
| `docker-compose.yml` | Local development stack |
| `k8s-deployment.yaml` | GKE deployment configuration |
| `deploy.sh` | Automation script for builds & pushes |
| `DEPLOYMENT.md` | Complete deployment guide |

---

## Environment Variables

### Backend (docker-compose.yml)
```yaml
PYTHONUNBUFFERED=1
PYTHONDONTWRITEBYTECODE=1
```

### Kubernetes (k8s-deployment.yaml)
Same as above, configured in deployment spec

---

## File Mounts

### Backend
- `/app` - Application code
- `/tmp/genn_models` - Generated model binaries (persistent in K8s)
- `/opt/genn` - GeNN installation

### Frontend  
- `/usr/share/nginx/html` - Built React app

---

## Exposed Ports

### Backend
- `8000` - FastAPI server
- `9001` - Runner TCP
- `9002` - Runner WebSocket

### Frontend
- `80` - HTTP

---

## Health Checks

### Backend
```
GET http://localhost:8000/api/health
```

### Frontend
```
GET http://localhost/index.html
```

---

## Network Diagram

```
Browser
   ↓
Frontend Service (LoadBalancer) :80
   ↓
Nginx Container
   ├─→ /api → Backend Service :8000
   ├─→ /ws  → Backend Service :9002
   └─→ /    → Static files
   ↓
Backend Service (ClusterIP)
   ↓
Backend Pod :8000 :9001 :9002
   ↓
PersistentVolume
```

---

## Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Rebuild images
docker-compose up --build

# Remove volumes
docker-compose down -v

# Execute command in container
docker-compose exec backend bash
```

---

## Size Estimates

| Component | Size |
|-----------|------|
| Backend image | ~3.5GB (CUDA + GeNN) |
| Frontend image | ~50MB |
| Built container | +500MB (runtime) |

---

For detailed documentation, see [DEPLOYMENT.md](DEPLOYMENT.md)
