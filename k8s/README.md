# Ping IAM Lab - GKE Multi-Cluster Deployment

## Architecture

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │                    Google Cloud Platform                     │
                    │                                                              │
                    │  ┌──────────────────────────────────────────────────────┐   │
                    │  │           External Application Load Balancer          │   │
                    │  │                   (35.186.236.153)                    │   │
                    │  └───────────────────────┬──────────────────────────────┘   │
                    │                          │                                   │
                    │          ┌───────────────┴───────────────┐                  │
                    │          ▼                               ▼                  │
                    │  ┌───────────────┐               ┌───────────────┐         │
                    │  │   gke-asia    │               │  gke-europe   │         │
                    │  │ (asia-se1)    │               │ (europe-w1)   │         │
                    │  │               │               │               │         │
                    │  │ ┌───────────┐ │               │ ┌───────────┐ │         │
                    │  │ │  Gateway  │ │               │ │           │ │         │
                    │  │ │ (MCI Hub) │ │               │ │           │ │         │
                    │  │ └───────────┘ │               │ └───────────┘ │         │
                    │  │               │               │               │         │
                    │  │ ┌───────────┐ │  ◄── MCS ──►  │ ┌───────────┐ │         │
                    │  │ │ Ping IAM  │ │               │ │ Ping IAM  │ │         │
                    │  │ │   Stack   │ │               │ │   Stack   │ │         │
                    │  │ └───────────┘ │               │ └───────────┘ │         │
                    │  └───────────────┘               └───────────────┘         │
                    │                                                              │
                    └──────────────────────────────────────────────────────────────┘
```

## Prerequisites

1. **GKE Clusters Running**: Both `gke-asia` and `gke-europe` clusters deployed via Terraform
2. **Docker Desktop**: Installed and running
3. **gcloud CLI**: Authenticated with `gcloud auth login`
4. **kubectl**: Installed with `gke-gcloud-auth-plugin`
5. **Helm 3**: Installed
6. **Ping Identity DevOps Credentials**: Get at https://devops.pingidentity.com/get-started/devopsRegistration/

## Install gke-gcloud-auth-plugin

Run in **elevated** PowerShell (Run as Administrator):
```powershell
gcloud components install gke-gcloud-auth-plugin
```

## Deployment Steps

### Quick Deploy (PowerShell)

```powershell
# Full deployment
.\deploy.ps1 all

# Or step by step:
.\deploy.ps1 docker   # Configure Docker auth
.\deploy.ps1 build    # Build and push images
.\deploy.ps1 helm     # Add Helm repo
.\deploy.ps1 asia     # Deploy to gke-asia
.\deploy.ps1 europe   # Deploy to gke-europe
.\deploy.ps1 verify   # Check deployment status
```

### Manual Deployment

#### 1. Configure Docker for Artifact Registry
```powershell
gcloud auth configure-docker asia-southeast1-docker.pkg.dev
```

#### 2. Build and Push Custom Images
```powershell
cd ping-iam-lab

# React App
docker build -t asia-southeast1-docker.pkg.dev/bold-lantern-480305-k3/ping-iam/react-app:latest ./react-app
docker push asia-southeast1-docker.pkg.dev/bold-lantern-480305-k3/ping-iam/react-app:latest

# Backend API
docker build -t asia-southeast1-docker.pkg.dev/bold-lantern-480305-k3/ping-iam/backend-api:latest ./backend-api
docker push asia-southeast1-docker.pkg.dev/bold-lantern-480305-k3/ping-iam/backend-api:latest
```

#### 3. Add Ping Identity Helm Repository
```powershell
helm repo add pingidentity https://helm.pingidentity.com/
helm repo update
```

#### 4. Deploy to gke-asia (MCI Config Cluster)
```powershell
gcloud container clusters get-credentials gke-asia --region asia-southeast1 --project bold-lantern-480305-k3

# Create namespace
kubectl apply -f base/namespace.yaml

# Create secrets (update values first!)
kubectl apply -f base/secrets.yaml

# Deploy Ping stack
helm upgrade --install ping-iam pingidentity/ping-devops -n ping-iam -f base/ping-devops-values.yaml --wait

# Deploy custom apps
kubectl apply -f base/react-app.yaml
kubectl apply -f base/backend-api.yaml

# Export services for MCS
kubectl apply -f base/service-export.yaml

# Deploy Gateway (only on MCI config cluster)
kubectl apply -f base/gateway.yaml
```

#### 5. Deploy to gke-europe
```powershell
gcloud container clusters get-credentials gke-europe --region europe-west1 --project bold-lantern-480305-k3

kubectl apply -f base/namespace.yaml
kubectl apply -f base/secrets.yaml
helm upgrade --install ping-iam pingidentity/ping-devops -n ping-iam -f base/ping-devops-values.yaml --wait
kubectl apply -f base/react-app.yaml
kubectl apply -f base/backend-api.yaml
kubectl apply -f base/service-export.yaml
# Note: NO gateway.yaml for europe - MCI uses gke-asia as config cluster
```

## Verify Deployment

```powershell
# Check pods in both clusters
kubectl get pods -n ping-iam --context gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
kubectl get pods -n ping-iam --context gke_bold-lantern-480305-k3_europe-west1_gke-europe

# Check Gateway status (gke-asia only)
kubectl get gateway -n ping-iam --context gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
kubectl get httproute -n ping-iam --context gke_bold-lantern-480305-k3_asia-southeast1_gke-asia

# Check ServiceExports
kubectl get serviceexport -n ping-iam --context gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
```

## Access Points

| Component | URL |
|-----------|-----|
| Load Balancer IP | `35.186.236.153` |
| React App | `http://35.186.236.153/` |
| PingFederate Admin | `https://<node-ip>:9999` |
| PingAccess Admin | `https://<node-ip>:9000` |

## File Structure

```
k8s/
├── base/
│   ├── namespace.yaml          # ping-iam namespace with Istio label
│   ├── secrets.yaml            # Ping credentials (update before use)
│   ├── ping-devops-values.yaml # Helm values for ping-devops chart
│   ├── react-app.yaml          # React frontend deployment
│   ├── backend-api.yaml        # Backend API deployment
│   ├── gateway.yaml            # Gateway API (MCI config cluster only)
│   ├── service-export.yaml     # MCS ServiceExport definitions
│   └── kustomization.yaml      # Kustomize config
├── deploy.sh                   # Bash deployment script
├── deploy.ps1                  # PowerShell deployment script
└── README.md                   # This file
```

## Troubleshooting

### Pod stuck in Pending
Check node resources:
```powershell
kubectl describe pod <pod-name> -n ping-iam
kubectl top nodes
```

### ServiceExport not working
Verify MCS is enabled:
```powershell
gcloud container fleet multi-cluster-services describe --project bold-lantern-480305-k3
```

### Gateway not getting IP
Check Gateway status:
```powershell
kubectl describe gateway ping-iam-gateway -n ping-iam
```
