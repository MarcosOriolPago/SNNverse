#!/bin/bash

# SNNverse Deployment Helper Script
# Automates Docker image building and pushing to Google Artifact Registry

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
REGION="${REGION:-europe-west1}"
PROJECT="${PROJECT:-snnverse-prod}"
REPO="${REPO:-snnverse-repo}"
IMAGE_TAG="${1:-v1}"
BUILD_BACKEND=true
BUILD_FRONTEND=true
PUSH_IMAGES=true

# Functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    local missing=0
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        missing=1
    else
        print_success "Docker found: $(docker --version)"
    fi
    
    # Check gcloud (for authentication)
    if ! command -v gcloud &> /dev/null; then
        print_warning "gcloud CLI not found - required for GCP operations"
    else
        print_success "gcloud found: $(gcloud --version | head -n 1)"
    fi
    
    if [ $missing -eq 1 ]; then
        print_error "Please install missing prerequisites"
        exit 1
    fi
}

verify_credentials() {
    print_header "Verifying GCP Credentials"
    
    if [ "$PUSH_IMAGES" = true ]; then
        echo "Testing Docker authentication with Artifact Registry..."
        if ! docker run --rm -i gcr.io/cloud-builders/docker version > /dev/null 2>&1; then
            print_warning "Docker not authenticated with GCP. Run:"
            echo "  gcloud auth configure-docker ${REGION}-docker.pkg.dev"
            read -p "Continue anyway? (y/n) " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                exit 1
            fi
        else
            print_success "Docker authenticated with GCP"
        fi
    fi
}

build_image() {
    local name=$1
    local path=$2
    local tag=$3
    
    local image="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/${name}:${tag}"
    
    echo -e "\n${BLUE}Building ${name}...${NC}"
    echo "Image: $image"
    
    if docker build -t "$image" "$path"; then
        print_success "${name} built successfully"
        echo "$image"
        return 0
    else
        print_error "${name} build failed"
        return 1
    fi
}

push_image() {
    local image=$1
    
    echo -e "\n${BLUE}Pushing image...${NC}"
    echo "Image: $image"
    
    if docker push "$image"; then
        print_success "Image pushed successfully"
        return 0
    else
        print_error "Image push failed"
        return 1
    fi
}

build_and_push() {
    print_header "Building and Pushing Docker Images"
    echo "Configuration:"
    echo "  Region: $REGION"
    echo "  Project: $PROJECT"
    echo "  Repository: $REPO"
    echo "  Tag: $IMAGE_TAG"
    echo ""
    
    local backend_image=""
    local frontend_image=""
    
    # Build backend
    if [ "$BUILD_BACKEND" = true ]; then
        backend_image=$(build_image "backend" "./back" "$IMAGE_TAG") || exit 1
        if [ "$PUSH_IMAGES" = true ]; then
            push_image "$backend_image" || exit 1
        fi
    fi
    
    # Build frontend
    if [ "$BUILD_FRONTEND" = true ]; then
        frontend_image=$(build_image "frontend" "./front" "$IMAGE_TAG") || exit 1
        if [ "$PUSH_IMAGES" = true ]; then
            push_image "$frontend_image" || exit 1
        fi
    fi
    
    print_header "Build Complete"
    if [ "$BUILD_BACKEND" = true ]; then
        echo -e "Backend:  ${GREEN}${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/backend:${IMAGE_TAG}${NC}"
    fi
    if [ "$BUILD_FRONTEND" = true ]; then
        echo -e "Frontend: ${GREEN}${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/frontend:${IMAGE_TAG}${NC}"
    fi
    
    if [ "$PUSH_IMAGES" = false ]; then
        print_warning "Images were built but NOT pushed (--no-push flag used)"
    fi
}

update_k8s_manifest() {
    print_header "Updating Kubernetes Manifest"
    
    if [ ! -f "k8s-deployment.yaml" ]; then
        print_error "k8s-deployment.yaml not found"
        return 1
    fi
    
    echo "Updating image references in k8s-deployment.yaml..."
    
    # Backup original
    cp k8s-deployment.yaml "k8s-deployment.yaml.backup.$(date +%s)"
    print_success "Backup created"
    
    # Update image references
    sed -i "s|REGION|${REGION}|g" k8s-deployment.yaml
    sed -i "s|PROJECT|${PROJECT}|g" k8s-deployment.yaml
    sed -i "s|REPO|${REPO}|g" k8s-deployment.yaml
    
    print_success "Manifest updated"
}

deploy_to_k8s() {
    print_header "Deploying to Kubernetes"
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Cannot deploy to Kubernetes."
        return 1
    fi
    
    # Check if cluster is accessible
    if ! kubectl cluster-info > /dev/null 2>&1; then
        print_error "Cannot access Kubernetes cluster. Run 'kubectl config current-context' to verify."
        return 1
    fi
    
    echo "Current context: $(kubectl config current-context)"
    read -p "Continue with deployment? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Deployment cancelled"
        return 0
    fi
    
    echo "Applying Kubernetes configuration..."
    if kubectl apply -f k8s-deployment.yaml; then
        print_success "Kubernetes manifests applied"
        
        echo ""
        echo "Deployment status:"
        kubectl get deployments -n snnverse
        
        echo ""
        echo "Pods:"
        kubectl get pods -n snnverse
        
        return 0
    else
        print_error "Failed to apply Kubernetes configuration"
        return 1
    fi
}

show_usage() {
    cat << EOF
SNNverse Deployment Helper

USAGE:
  $0 [TAG] [OPTIONS]

ARGUMENTS:
  TAG                    Docker image tag (default: v1)

OPTIONS:
  --no-push             Build images but don't push to registry
  --no-pull             Skip checking/pulling latest base images
  --backend-only        Only build backend image
  --frontend-only       Only build frontend image
  --deploy              Deploy to Kubernetes after building/pushing
  --update-manifest     Update k8s-deployment.yaml with current values
  --help                Show this help message

ENVIRONMENT VARIABLES:
  REGION                GCP region (default: europe-west1)
  PROJECT               GCP project ID (default: snnverse-prod)
  REPO                  Artifact Registry repository name (default: snnverse-repo)

EXAMPLES:
  # Build and push v1 images
  $0 v1

  # Build v2 images locally without pushing
  $0 v2 --no-push

  # Build backend only and deploy to K8s
  $0 v3 --backend-only --deploy

  # Update manifest and deploy with custom region
  REGION=us-central1 $0 v1 --deploy --update-manifest

EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-push)
            PUSH_IMAGES=false
            shift
            ;;
        --backend-only)
            BUILD_FRONTEND=false
            shift
            ;;
        --frontend-only)
            BUILD_BACKEND=false
            shift
            ;;
        --deploy)
            DEPLOY_K8S=true
            shift
            ;;
        --update-manifest)
            UPDATE_MANIFEST=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        -*)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            IMAGE_TAG=$1
            shift
            ;;
    esac
done

# Main execution
main() {
    print_header "SNNverse Deployment Helper"
    
    check_prerequisites
    verify_credentials
    build_and_push
    
    if [ "$UPDATE_MANIFEST" = true ]; then
        update_k8s_manifest
    fi
    
    if [ "$DEPLOY_K8S" = true ]; then
        deploy_to_k8s
    fi
    
    print_success "All done!"
}

# Run main
main
