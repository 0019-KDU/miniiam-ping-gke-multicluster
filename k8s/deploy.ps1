# =============================================================================
# Ping IAM Lab - GKE Multi-Cluster Deployment Script (PowerShell)
# =============================================================================
param(
    [Parameter(Position=0)]
    [ValidateSet("docker", "build", "helm", "asia", "europe", "verify", "all", "destroy")]
    [string]$Action = "all"
)

$ErrorActionPreference = "Stop"

# Configuration
$PROJECT_ID = "bold-lantern-480305-k3"
$REGION = "asia-southeast1"
$REGISTRY = "${REGION}-docker.pkg.dev/${PROJECT_ID}/ping-iam"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PING_IAM_LAB = Join-Path $SCRIPT_DIR "..\ping-iam-lab"

function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# =============================================================================
# Configure Docker for Artifact Registry
# =============================================================================
function Configure-Docker {
    Write-Info "Configuring Docker for Artifact Registry..."
    gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
}

# =============================================================================
# Build and Push Container Images
# =============================================================================
function Build-And-Push-Images {
    Write-Info "Building and pushing container images..."

    Push-Location $PING_IAM_LAB

    try {
        # Build React App
        Write-Info "Building react-app..."
        docker build -t "${REGISTRY}/react-app:latest" ./react-app
        docker push "${REGISTRY}/react-app:latest"

        # Build Backend API
        Write-Info "Building backend-api..."
        docker build -t "${REGISTRY}/backend-api:latest" ./backend-api
        docker push "${REGISTRY}/backend-api:latest"

        Write-Info "Images pushed successfully!"
        Write-Info "  - ${REGISTRY}/react-app:latest"
        Write-Info "  - ${REGISTRY}/backend-api:latest"
    }
    finally {
        Pop-Location
    }
}

# =============================================================================
# Add Ping Identity Helm Repo
# =============================================================================
function Setup-Helm {
    Write-Info "Setting up Ping Identity Helm repository..."
    helm repo add pingidentity https://helm.pingidentity.com/ 2>$null
    helm repo update
    Write-Info "Helm repo ready. Available charts:"
    helm search repo pingidentity
}

# =============================================================================
# Deploy to GKE Asia Cluster (MCI Config Cluster)
# =============================================================================
function Deploy-To-Asia {
    Write-Info "Deploying to gke-asia cluster (MCI Config Cluster)..."

    # Switch context
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project $PROJECT_ID

    # Create namespace with Istio sidecar injection label
    Write-Info "Creating namespace..."
    kubectl apply -f "$SCRIPT_DIR\base\namespace.yaml"

    # Check if devops-secret exists
    $secretExists = kubectl get secret devops-secret -n ping-iam 2>$null
    if (-not $secretExists) {
        Write-Warn "DevOps secret not found. Please create it first:"
        Write-Host ""
        Write-Host "  kubectl create secret generic devops-secret \" -ForegroundColor Cyan
        Write-Host "    --from-literal=PING_IDENTITY_DEVOPS_USER=your-email@example.com \" -ForegroundColor Cyan
        Write-Host "    --from-literal=PING_IDENTITY_DEVOPS_KEY=your-devops-key \" -ForegroundColor Cyan
        Write-Host "    -n ping-iam" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Get credentials at: https://devops.pingidentity.com/get-started/devopsRegistration/" -ForegroundColor Yellow
        return
    }

    # Deploy Ping Identity stack via Helm
    Write-Info "Deploying Ping Identity stack via Helm..."
    helm upgrade --install ping-iam pingidentity/ping-devops `
        --namespace ping-iam `
        --values "$SCRIPT_DIR\base\ping-devops-values.yaml" `
        --wait --timeout 15m

    # Deploy custom apps (React + Backend API)
    Write-Info "Deploying custom applications..."
    kubectl apply -f "$SCRIPT_DIR\base\react-app.yaml"
    kubectl apply -f "$SCRIPT_DIR\base\backend-api.yaml"

    # Deploy ServiceExports for MCS
    Write-Info "Deploying ServiceExports for Multi-Cluster Services..."
    kubectl apply -f "$SCRIPT_DIR\base\service-export.yaml"

    # Deploy Gateway (only on MCI config cluster)
    Write-Info "Deploying Gateway API resources..."
    kubectl apply -f "$SCRIPT_DIR\base\gateway.yaml"

    Write-Info "gke-asia deployment complete!"
}

# =============================================================================
# Deploy to GKE Europe Cluster
# =============================================================================
function Deploy-To-Europe {
    Write-Info "Deploying to gke-europe cluster..."

    # Switch context
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project $PROJECT_ID

    # Create namespace
    Write-Info "Creating namespace..."
    kubectl apply -f "$SCRIPT_DIR\base\namespace.yaml"

    # Check if devops-secret exists
    $secretExists = kubectl get secret devops-secret -n ping-iam 2>$null
    if (-not $secretExists) {
        Write-Warn "DevOps secret not found. Please create it first:"
        Write-Host ""
        Write-Host "  kubectl create secret generic devops-secret \" -ForegroundColor Cyan
        Write-Host "    --from-literal=PING_IDENTITY_DEVOPS_USER=your-email@example.com \" -ForegroundColor Cyan
        Write-Host "    --from-literal=PING_IDENTITY_DEVOPS_KEY=your-devops-key \" -ForegroundColor Cyan
        Write-Host "    -n ping-iam" -ForegroundColor Cyan
        Write-Host ""
        return
    }

    # Deploy Ping Identity stack via Helm
    Write-Info "Deploying Ping Identity stack via Helm..."
    helm upgrade --install ping-iam pingidentity/ping-devops `
        --namespace ping-iam `
        --values "$SCRIPT_DIR\base\ping-devops-values.yaml" `
        --wait --timeout 15m

    # Deploy custom apps
    Write-Info "Deploying custom applications..."
    kubectl apply -f "$SCRIPT_DIR\base\react-app.yaml"
    kubectl apply -f "$SCRIPT_DIR\base\backend-api.yaml"

    # Deploy ServiceExports for MCS
    Write-Info "Deploying ServiceExports..."
    kubectl apply -f "$SCRIPT_DIR\base\service-export.yaml"

    # NOTE: Gateway is NOT deployed to europe - only MCI config cluster (asia)

    Write-Info "gke-europe deployment complete!"
}

# =============================================================================
# Verify Deployment
# =============================================================================
function Verify-Deployment {
    Write-Info "Verifying deployment..."

    Write-Host ""
    Write-Info "=== Helm Releases ==="

    Write-Host "`n--- gke-asia ---" -ForegroundColor Cyan
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project $PROJECT_ID 2>$null
    helm list -n ping-iam

    Write-Host "`n--- gke-europe ---" -ForegroundColor Cyan
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project $PROJECT_ID 2>$null
    helm list -n ping-iam

    Write-Host ""
    Write-Info "=== Pods Status ==="

    Write-Host "`n--- gke-asia ---" -ForegroundColor Cyan
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project $PROJECT_ID 2>$null
    kubectl get pods -n ping-iam -o wide

    Write-Host "`n--- gke-europe ---" -ForegroundColor Cyan
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project $PROJECT_ID 2>$null
    kubectl get pods -n ping-iam -o wide

    Write-Host ""
    Write-Info "=== Services ==="
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project $PROJECT_ID 2>$null
    kubectl get svc -n ping-iam

    Write-Host ""
    Write-Info "=== Gateway Status (gke-asia) ==="
    kubectl get gateway -n ping-iam
    kubectl get httproute -n ping-iam

    Write-Host ""
    Write-Info "=== ServiceExports ==="
    kubectl get serviceexport -n ping-iam 2>$null

    Write-Host ""
    Write-Info "=== Load Balancer IP ==="
    Write-Host "35.186.236.153" -ForegroundColor Yellow
}

# =============================================================================
# Destroy Deployment
# =============================================================================
function Destroy-Deployment {
    Write-Warn "Destroying Ping IAM deployment from both clusters..."

    # Destroy from gke-asia
    Write-Info "Removing from gke-asia..."
    gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project $PROJECT_ID 2>$null
    helm uninstall ping-iam -n ping-iam 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\gateway.yaml" 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\service-export.yaml" 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\react-app.yaml" 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\backend-api.yaml" 2>$null
    kubectl delete namespace ping-iam 2>$null

    # Destroy from gke-europe
    Write-Info "Removing from gke-europe..."
    gcloud container clusters get-credentials gke-europe --region europe-west1 --project $PROJECT_ID 2>$null
    helm uninstall ping-iam -n ping-iam 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\service-export.yaml" 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\react-app.yaml" 2>$null
    kubectl delete -f "$SCRIPT_DIR\base\backend-api.yaml" 2>$null
    kubectl delete namespace ping-iam 2>$null

    Write-Info "Deployment destroyed!"
}

# =============================================================================
# Main
# =============================================================================
Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Ping IAM Lab - GKE Multi-Cluster Deploy   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host ""

switch ($Action) {
    "docker" {
        Configure-Docker
    }
    "build" {
        Configure-Docker
        Build-And-Push-Images
    }
    "helm" {
        Setup-Helm
    }
    "asia" {
        Setup-Helm
        Deploy-To-Asia
    }
    "europe" {
        Setup-Helm
        Deploy-To-Europe
    }
    "verify" {
        Verify-Deployment
    }
    "destroy" {
        Destroy-Deployment
    }
    "all" {
        Configure-Docker
        Build-And-Push-Images
        Setup-Helm
        Deploy-To-Asia
        Deploy-To-Europe
        Verify-Deployment
    }
}

Write-Host ""
