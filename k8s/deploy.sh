#!/bin/bash
# =============================================================================
# Ping IAM Lab - GKE Multi-Cluster Deployment Script
# =============================================================================
set -e

# Configuration
PROJECT_ID="bold-lantern-480305-k3"
REGION="asia-southeast1"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/ping-iam"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# =============================================================================
# Step 1: Configure Docker for Artifact Registry
# =============================================================================
configure_docker() {
    log_info "Configuring Docker for Artifact Registry..."
    gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet
}

# =============================================================================
# Step 2: Build and Push Container Images
# =============================================================================
build_and_push_images() {
    log_info "Building and pushing container images..."

    cd "${SCRIPT_DIR}/../ping-iam-lab"

    # Build React App
    log_info "Building react-app..."
    docker build -t ${REGISTRY}/react-app:latest ./react-app
    docker push ${REGISTRY}/react-app:latest

    # Build Backend API
    log_info "Building backend-api..."
    docker build -t ${REGISTRY}/backend-api:latest ./backend-api
    docker push ${REGISTRY}/backend-api:latest

    log_info "Images pushed successfully!"
}

# =============================================================================
# Step 3: Add Ping Identity Helm Repo
# =============================================================================
setup_helm() {
    log_info "Setting up Ping Identity Helm repository..."
    helm repo add pingidentity https://helm.pingidentity.com/ || true
    helm repo update
}

# =============================================================================
# Step 4: Deploy to GKE Asia Cluster
# =============================================================================
deploy_to_asia() {
    log_info "Deploying to gke-asia cluster..."

    # Switch context
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project ${PROJECT_ID}

    # Create namespace
    kubectl apply -f ${SCRIPT_DIR}/base/namespace.yaml

    # Create secrets (you need to substitute values first)
    # kubectl apply -f ${SCRIPT_DIR}/base/secrets.yaml

    # Deploy Ping Identity stack via Helm
    log_info "Deploying Ping Identity stack via Helm..."
    helm upgrade --install ping-iam pingidentity/ping-devops \
        -n ping-iam \
        -f ${SCRIPT_DIR}/base/ping-devops-values.yaml \
        --wait --timeout 10m

    # Deploy custom apps
    log_info "Deploying custom applications..."
    kubectl apply -f ${SCRIPT_DIR}/base/react-app.yaml
    kubectl apply -f ${SCRIPT_DIR}/base/backend-api.yaml

    # Deploy ServiceExports for MCS
    log_info "Deploying ServiceExports..."
    kubectl apply -f ${SCRIPT_DIR}/base/service-export.yaml

    # Deploy Gateway (MCI config cluster)
    log_info "Deploying Gateway API resources (MCI config cluster)..."
    kubectl apply -f ${SCRIPT_DIR}/base/gateway.yaml

    log_info "gke-asia deployment complete!"
}

# =============================================================================
# Step 5: Deploy to GKE Europe Cluster
# =============================================================================
deploy_to_europe() {
    log_info "Deploying to gke-europe cluster..."

    # Switch context
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project ${PROJECT_ID}

    # Create namespace
    kubectl apply -f ${SCRIPT_DIR}/base/namespace.yaml

    # Create secrets
    # kubectl apply -f ${SCRIPT_DIR}/base/secrets.yaml

    # Deploy Ping Identity stack via Helm
    log_info "Deploying Ping Identity stack via Helm..."
    helm upgrade --install ping-iam pingidentity/ping-devops \
        -n ping-iam \
        -f ${SCRIPT_DIR}/base/ping-devops-values.yaml \
        --wait --timeout 10m

    # Deploy custom apps
    log_info "Deploying custom applications..."
    kubectl apply -f ${SCRIPT_DIR}/base/react-app.yaml
    kubectl apply -f ${SCRIPT_DIR}/base/backend-api.yaml

    # Deploy ServiceExports for MCS
    log_info "Deploying ServiceExports..."
    kubectl apply -f ${SCRIPT_DIR}/base/service-export.yaml

    # Note: Gateway is NOT deployed to europe (only MCI config cluster)

    log_info "gke-europe deployment complete!"
}

# =============================================================================
# Step 6: Verify Deployment
# =============================================================================
verify_deployment() {
    log_info "Verifying deployment..."

    echo ""
    log_info "=== gke-asia pods ==="
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project ${PROJECT_ID}
    kubectl get pods -n ping-iam

    echo ""
    log_info "=== gke-europe pods ==="
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project ${PROJECT_ID}
    kubectl get pods -n ping-iam

    echo ""
    log_info "=== Gateway Status (from gke-asia) ==="
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project ${PROJECT_ID}
    kubectl get gateway -n ping-iam
    kubectl get httproute -n ping-iam
}

# =============================================================================
# Main
# =============================================================================
main() {
    case "${1:-all}" in
        docker)
            configure_docker
            ;;
        build)
            configure_docker
            build_and_push_images
            ;;
        helm)
            setup_helm
            ;;
        asia)
            setup_helm
            deploy_to_asia
            ;;
        europe)
            setup_helm
            deploy_to_europe
            ;;
        verify)
            verify_deployment
            ;;
        all)
            configure_docker
            build_and_push_images
            setup_helm
            deploy_to_asia
            deploy_to_europe
            verify_deployment
            ;;
        *)
            echo "Usage: $0 {docker|build|helm|asia|europe|verify|all}"
            exit 1
            ;;
    esac
}

main "$@"
