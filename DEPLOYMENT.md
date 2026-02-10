# SNNverse Deployment Guide

Complete guide for building and deploying SNNverse with Docker and Kubernetes.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Production Deployment](#production-deployment)
4. [Architecture](#architecture)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Local Development
- Docker 20.10+
- Docker Compose 2.0+
- NVIDIA Container Toolkit (for GPU support)
- 8GB+ RAM
- 20GB+ free disk space

### Production Deployment (GKE)
- Google Cloud SDK (`gcloud`)
- `kubectl` 1.25+
- GKE cluster with GPU-enabled nodes
- Access to Google Artifact Registry
- NVIDIA drivers on GKE nodes (automatic on GPU images)

## Local Development

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd SNNverse
   ```

2. **Start the stack with GPU support**
   ```bash
   docker-compose up --build
   ```

   For CPU-only testing:
   ```bash
   # Edit docker-compose.yml and comment out the deploy.resources section
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost
   - Backend API: http://localhost:8000/api
   - API Documentation: http://localhost:8000/docs

### Docker Compose Configuration

The `docker-compose.yml` includes:
- **Backend Service**: FastAPI + GeNN + CUDA
- **Frontend Service**: React + Nginx
- **Volumes**: `genn_models` for persistent model storage
- **Health Checks**: Automated service health monitoring
- **GPU Support**: Optional NVIDIA GPU resource allocation

### Environment Variables

For custom configuration, modify the `environment` section in `docker-compose.yml`:

```yaml
environment:
  - PYTHONUNBUFFERED=1
  - PYTHONDONTWRITEBYTECODE=1
  # Add additional variables as needed
```

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Filter by time
docker-compose logs --since 10m -f
```

### Stopping and Cleaning Up

```bash
# Stop all services
docker-compose down

# Remove volumes (clears persisted data)
docker-compose down -v

# Remove all containers and images
docker-compose down -v --rmi all
```

## Production Deployment

### 1. Authentication Setup

Configure Google Artifact Registry authentication:

```bash
# Install gcloud authentication plugin
gcloud auth configure-docker europe-west1-docker.pkg.dev

# Verify authentication
docker login -u _json_key --password-stdin europe-west1-docker.pkg.dev < key.json
```

### 2. Set Environment Variables

```bash
export REGION="europe-west1"
export PROJECT="snnverse-prod"
export REPO="snnverse-repo"
export IMAGE_TAG="v1"
```

### 3. Create Artifact Registry Repository

```bash
gcloud artifacts repositories create ${REPO} \
  --repository-format=docker \
  --location=${REGION} \
  --project=${PROJECT}
```

### 4. Build and Push Images

#### Backend Image

```bash
docker build \
  -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${IMAGE_TAG} \
  ./back

docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${IMAGE_TAG}
```

#### Frontend Image

```bash
docker build \
  -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${IMAGE_TAG} \
  ./front

docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${IMAGE_TAG}
```

#### Push Both (Automated Script)

```bash
#!/bin/bash
set -e

REGION="europe-west1"
PROJECT="snnverse-prod"
REPO="snnverse-repo"
IMAGE_TAG="${1:-v1}"

echo "Building and pushing images with tag: $IMAGE_TAG"

# Backend
echo "Building backend..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${IMAGE_TAG} ./back
echo "Pushing backend..."
docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${IMAGE_TAG}

# Frontend
echo "Building frontend..."
docker build -t ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${IMAGE_TAG} ./front
echo "Pushing frontend..."
docker push ${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${IMAGE_TAG}

echo "Done! Images pushed with tag: $IMAGE_TAG"
```

Save as `deploy.sh`, then run:
```bash
chmod +x deploy.sh
./deploy.sh v1
```

### 5. Create GKE Cluster with GPU Support

```bash
gcloud container clusters create snnverse-cluster \
  --zone europe-west1-b \
  --machine-type n1-standard-4 \
  --num-nodes 3 \
  --enable-gpu \
  --gpu-type nvidia-tesla-v100 \
  --enable-ip-alias \
  --network "default" \
  --cluster-secondary-range-name pods \
  --services-secondary-range-name services
```

### 6. Deploy to Kubernetes

Update the image references in `k8s-deployment.yaml`:

```bash
# Replace placeholders
sed -i "s/REGION/${REGION}/g" k8s-deployment.yaml
sed -i "s/PROJECT/${PROJECT}/g" k8s-deployment.yaml
sed -i "s/REPO/${REPO}/g" k8s-deployment.yaml

# Apply configuration
kubectl apply -f k8s-deployment.yaml
```

### 7. Verify Deployment

```bash
# Check deployments
kubectl get deployments -n snnverse

# Check pods
kubectl get pods -n snnverse

# Check services
kubectl get services -n snnverse

# View pod logs
kubectl logs -n snnverse -l app=backend -f
kubectl logs -n snnverse -l app=frontend -f

# Describe a pod for troubleshooting
kubectl describe pod -n snnverse <pod-name>
```

### 8. Access the Application

```bash
# Get LoadBalancer IP
kubectl get service -n snnverse frontend
# Access via the EXTERNAL-IP address
```

### 9. Update Deployments

For a new version:

```bash
export NEW_TAG="v2"
./deploy.sh ${NEW_TAG}

# Update the YAML
sed -i "s/:v1/:${NEW_TAG}/g" k8s-deployment.yaml

# Rollout new version
kubectl set image deployment/backend -n snnverse \
  backend=${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${NEW_TAG}

kubectl set image deployment/frontend -n snnverse \
  frontend=${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${NEW_TAG}

# Monitor rollout
kubectl rollout status deployment/backend -n snnverse
kubectl rollout status deployment/frontend -n snnverse
```

### 10. Rollback Deployment

```bash
# View rollout history
kubectl rollout history deployment/backend -n snnverse

# Rollback to previous version
kubectl rollout undo deployment/backend -n snnverse

# Rollback to specific revision
kubectl rollout undo deployment/backend -n snnverse --to-revision=2
```

## Architecture

### Service Architecture

```
┌─────────────────────────────────────┐
│          Internet / Browser          │
└──────────────────┬──────────────────┘
                   │
           ┌───────▼────────┐
           │  LoadBalancer  │
           │  (Kubernetes)  │
           └───────┬────────┘
                   │
           ┌───────▼────────┐
           │   Frontend      │
           │   (Nginx)       │
           │   Replicas: 2   │
           └───────┬────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    ┌───▼────┐        ┌───────▼─────┐
    │  /api  │        │    /ws      │
    │Proxy   │        │ WebSocket   │
    └───┬────┘        └───────┬─────┘
        │                     │
        └──────────┬──────────┘
                   │
           ┌───────▼──────────┐
           │    Backend       │
           │ (FastAPI/GeNN)   │
           │   Replicas: 1    │
           │  Ports: 8000     │
           │  9001, 9002      │
           └───────┬──────────┘
                   │
           ┌───────▼──────────┐
           │ PersistentVolume │
           │  /tmp/genn_models│
           └──────────────────┘
```

### Network Configuration

- **Frontend → Backend API**: HTTP proxy via Nginx
- **Frontend → WebSocket**: WebSocket proxy via Nginx
- **Backend → PersistentVolume**: Local mount
- **Inter-pod Communication**: Kubernetes DNS (backend:8000)

### Storage

**PersistentVolume Claim** (`genn_models`):
- Size: 10Gi (adjustable in k8s-deployment.yaml)
- Access Mode: ReadWriteOnce
- Mount Point: `/tmp/genn_models` in backend pod
- Purpose: Persist compiled GeNN models across pod restarts

## Troubleshooting

### Backend Pod Fails to Start

```bash
# Check pod events
kubectl describe pod -n snnverse <backend-pod-name>

# Check logs
kubectl logs -n snnverse <backend-pod-name>

# Check GPU availability
kubectl describe nodes | grep -A 5 "nvidia.com/gpu"
```

**Common Issues:**
- GPU not requested: Ensure `nvidia.com/gpu: 1` in resource limits
- Image not found: Verify image tag and repository path
- CrashLoopBackOff: Check logs for Python/GeNN errors

### Frontend Pod Fails to Connect to Backend

```bash
# Test connectivity from frontend pod
kubectl exec -n snnverse <frontend-pod-name> -- \
  wget -O- http://backend:8000/api/health

# Check service discovery
kubectl get svc -n snnverse
```

**Solutions:**
- Verify backend service name and port in nginx.conf
- Check NetworkPolicy allows inter-pod communication
- Ensure backend pod is running and healthy

### WebSocket Connection Issues

```bash
# Verify runner ports are exposed
kubectl get svc -n snnverse backend

# Test WebSocket from pod
kubectl exec -n snnverse <frontend-pod-name> -- \
  nc -zv backend 9002
```

**Solutions:**
- Ensure ports 9001, 9002 exposed in backend service
- Check nginx.conf WebSocket proxy configuration
- Verify backend pod has WebSocket listeners

### PersistentVolume Issues

```bash
# Check PVC status
kubectl get pvc -n snnverse
kubectl describe pvc -n snnverse genn-models-pvc

# Check mounted volumes in pod
kubectl exec -n snnverse <backend-pod-name> -- df -h
```

**Solutions:**
- Verify PVC has sufficient storage
- Check pod has volumeMounts configured
- Ensure storage class exists (default usually works)

### GPU Not Available

```bash
# Check node GPU allocation
kubectl describe nodes | grep -A 2 "nvidia.com/gpu"

# Check if NVIDIA device plugin is running
kubectl get daemonset -A | grep nvidia
```

**Solutions:**
- Install NVIDIA GPU device plugin on cluster
- Ensure nodes have GPU drivers installed
- Check node selectors match available GPU nodes

### Image Pull Errors

```bash
# Check image pull secrets
kubectl get secrets -n snnverse

# Test image pull
kubectl run test --image=<your-image> --restart=Never -n snnverse
```

**Solutions:**
- Verify Artifact Registry authentication
- Check image exists and tag is correct
- Create image pull secret if using private registry

## Performance Tuning

### Backend Resource Limits

Adjust in `k8s-deployment.yaml`:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
    memory: 4Gi
    cpu: 2
  requests:
    nvidia.com/gpu: 1
    memory: 2Gi
    cpu: 1
```

### Frontend Replicas

Increase for higher traffic:

```yaml
spec:
  replicas: 3  # Change from 2
```

### Nginx Configuration

Edit `front/nginx.conf` for tuning:

```nginx
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
```

## Security Considerations

1. **NetworkPolicy**: Restricts traffic between pods
2. **Security Headers**: Added in nginx.conf
3. **HTTPS**: Consider adding TLS termination
4. **RBAC**: Implement Kubernetes RBAC for API access
5. **Secret Management**: Use Google Secret Manager for credentials

### Adding HTTPS/TLS

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create certificate issuer and ingress with TLS
# (Requires separate Ingress configuration)
```

## Maintenance

### Regular Updates

```bash
# Update images
./deploy.sh v2

# Update Kubernetes manifests
kubectl apply -f k8s-deployment.yaml

# Monitor rollout
kubectl rollout status deployment/backend -n snnverse
```

### Backup PersistentVolume

```bash
# Snapshot the volume (GCP specific)
gcloud compute disks snapshot <disk-name> \
  --snapshot-names=snnverse-backup-$(date +%Y%m%d)
```

### Monitor Logs

```bash
# Stream all logs
kubectl logs -n snnverse -f --all-containers=true -l app=backend

# Search for errors
kubectl logs -n snnverse -l app=backend | grep ERROR
```

## Support

For issues or questions:
1. Check logs: `kubectl logs -n snnverse <pod-name>`
2. Review events: `kubectl describe pod -n snnverse <pod-name>`
3. Check deployment status: `kubectl get all -n snnverse`
4. Review this guide's troubleshooting section
