# MiniIAM - Multi-Cluster Ping Identity IAM Platform

Production-grade Identity and Access Management (IAM) application using Ping Identity stack on existing GKE multi-cluster infrastructure with Anthos Service Mesh.

## Overview

MiniIAM is an enterprise IAM application layer that runs on your existing GKE multi-cluster setup:
- **React Frontend**: Modern SPA with OIDC authentication
- **PingAccess**: Web Access Management / API Gateway
- **PingFederate**: Identity Provider (OIDC/OAuth2/SAML2)
- **PingDirectory**: LDAP directory with cross-cluster replication
- **Zero Trust Security**: Leverages your existing ASM mTLS mesh

## Infrastructure (Already Deployed)

Your existing setup:
- **2 GKE Clusters**: `gke-asia` (asia-southeast1) + `gke-europe` (europe-west1)
- **Fleet**: `bold-lantern-480305-k3-fleet`
- **VPC**: `bold-lantern-480305-k3-mesh-vpc` (single VPC, clean CIDR design)
- **ASM**: Managed Anthos Service Mesh with Traffic Director
- **Trust Domain**: `bold-lantern-480305-k3.svc.id.goog`
- **Workload Identity**: Enabled on both clusters
- **Service Mesh UI**: Healthy and showing topology

## Application Architecture

This project deploys IAM applications to your existing clusters:

```
Asia Cluster (gke-asia)              Europe Cluster (gke-europe)
┌─────────────────────────┐          ┌─────────────────────────┐
│                         │          │                         │
│  React Frontend         │          │  React Frontend         │
│  PingAccess             │          │  PingAccess             │
│  PingFederate           │          │  PingFederate           │
│  PingDirectory ◄────────┼──────────┼────► PingDirectory      │
│                         │  LDAP    │                         │
│                         │  Repl.   │                         │
└─────────────────────────┘          └─────────────────────────┘
          │                                     │
          └─────────────────┬───────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │  ASM (mTLS mesh)  │
                  │  Traffic Director │
                  └───────────────────┘
```

## Application Components

| Component | Purpose | Deployment |
|-----------|---------|------------|
| **React Frontend** | User-facing SPA with OIDC | Both clusters |
| **PingAccess** | API Gateway / Policy Engine | Both clusters |
| **PingFederate** | Identity Provider (OIDC/SAML) | Both clusters |
| **PingDirectory** | LDAP User Store | Both clusters (replicated) |

## What's Included

✅ **Production-Ready Kubernetes Manifests**
- Namespace with ASM injection labels
- RBAC (ServiceAccounts, Roles, RoleBindings)
- Secrets (with demo values - update for production)
- ConfigMaps for all components
- Deployments for Ping stack
- StatefulSet for PingDirectory with persistence
- Services (ClusterIP, headless)
- PodDisruptionBudgets for HA
- HorizontalPodAutoscaler for frontend

✅ **ASM/Istio Service Mesh Configuration**
- PeerAuthentication (STRICT mTLS)
- AuthorizationPolicies (Zero Trust)
- Gateway (Ingress with TLS)
- VirtualServices (routing rules)
- DestinationRules (traffic policies, circuit breakers)
- NetworkPolicies (defense in depth)

✅ **React Frontend Application**
- TypeScript + Vite
- OIDC client with PKCE flow
- Protected routes
- User profile display
- Multi-stage Docker build
- Security-hardened nginx

## Deployment to Your Clusters

### Prerequisites
- `kubectl` context configured for both clusters
- `gcloud` CLI authenticated
- Docker for building frontend image

### Deploy to Asia Cluster (gke-asia)

```bash
# Switch to Asia cluster
gcloud container clusters get-credentials gke-asia \
  --region asia-southeast1 \
  --project bold-lantern-480305-k3

# Build and push frontend image (to GCR or Artifact Registry)
cd frontend
docker build -t gcr.io/bold-lantern-480305-k3/miniiam-frontend:latest .
docker push gcr.io/bold-lantern-480305-k3/miniiam-frontend:latest
cd ..

# Update image reference in k8s/07-frontend.yaml
# Then apply manifests
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-rbac.yaml
kubectl apply -f k8s/02-secrets.yaml  # Update passwords first!
kubectl apply -f k8s/03-configmaps.yaml
kubectl apply -f k8s/04-pingdirectory.yaml
kubectl apply -f k8s/05-pingfederate.yaml
kubectl apply -f k8s/06-pingaccess.yaml
kubectl apply -f k8s/07-frontend.yaml
kubectl apply -f k8s/istio/
```

### Deploy to Europe Cluster (gke-europe)

```bash
# Switch to Europe cluster
gcloud container clusters get-credentials gke-europe \
  --region europe-west1 \
  --project bold-lantern-480305-k3

# Apply same manifests (image already pushed to GCR)
kubectl apply -f k8s/
kubectl apply -f k8s/istio/
```

### Configure PingDirectory Replication

After both clusters are deployed, enable LDAP replication between them:

```bash
# Get PingDirectory pod from Asia cluster
POD_ASIA=$(kubectl get pods -n miniiam -l app=pingdirectory \
  --context=gke-asia -o jsonpath='{.items[0].metadata.name}')

# Get Europe cluster PingDirectory external IP
EUROPE_IP=$(kubectl get svc pingdirectory-external -n miniiam \
  --context=gke-europe -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Enable replication from Asia to Europe
kubectl exec -it $POD_ASIA -n miniiam --context=gke-asia -- \
  /opt/out/instance/bin/dsreplication enable \
  --host1 localhost --port1 1636 \
  --bindDN1 "cn=administrator,cn=root dns,cn=config" \
  --bindPassword1 "2FederateM0re" \
  --replicationPort1 8989 \
  --host2 $EUROPE_IP --port2 1636 \
  --bindDN2 "cn=administrator,cn=root dns,cn=config" \
  --bindPassword2 "2FederateM0re" \
  --replicationPort2 8989 \
  --baseDN "dc=miniiam,dc=local" \
  --adminUID admin --adminPassword "ReplicateM0re" \
  --secureReplication --trustAll --no-prompt

# Initialize replication
kubectl exec -it $POD_ASIA -n miniiam --context=gke-asia -- \
  /opt/out/instance/bin/dsreplication initialize \
  --baseDN "dc=miniiam,dc=local" \
  --adminUID admin --adminPassword "ReplicateM0re" \
  --hostSource localhost --portSource 1636 \
  --hostDestination $EUROPE_IP --portDestination 1636 \
  --trustAll --no-prompt
```

## Project Structure

```
miniiam-ping-gke-multicluster/
├── frontend/                    # React SPA with OIDC
│   ├── src/
│   │   ├── auth/               # AuthContext, ProtectedRoute
│   │   ├── pages/              # Login, Dashboard, Profile, Callback
│   │   └── main.tsx
│   ├── Dockerfile              # Multi-stage build
│   ├── nginx.conf              # Security headers
│   └── package.json
├── k8s/                        # Kubernetes manifests
│   ├── 00-namespace.yaml       # miniiam namespace (ASM injection enabled)
│   ├── 01-rbac.yaml            # ServiceAccounts + RBAC
│   ├── 02-secrets.yaml         # **CHANGE PASSWORDS IN PRODUCTION**
│   ├── 03-configmaps.yaml      # App configuration
│   ├── 04-pingdirectory.yaml   # LDAP StatefulSet + PVC
│   ├── 05-pingfederate.yaml    # IdP Deployment
│   ├── 06-pingaccess.yaml      # API Gateway Deployment
│   ├── 07-frontend.yaml        # React SPA + HPA
│   └── istio/                  # ASM/Istio configs
│       ├── 01-peer-authentication.yaml    # STRICT mTLS
│       ├── 02-authorization-policy.yaml   # Zero Trust policies
│       ├── 03-gateway.yaml                # Ingress Gateway + TLS
│       ├── 04-destination-rules.yaml      # Circuit breakers
│       └── 05-network-policy.yaml         # Network segmentation
└── README.md
```

## Configuration Updates Needed

Before deploying, update these files:

### 1. Secrets (`k8s/02-secrets.yaml`)
```yaml
# CRITICAL: Replace demo passwords
stringData:
  root-user-password: "YOUR_SECURE_PASSWORD"
  admin-user-password: "YOUR_SECURE_PASSWORD"
  # ... etc
```

### 2. Frontend Image (`k8s/07-frontend.yaml`)
```yaml
containers:
  - name: frontend
    image: gcr.io/bold-lantern-480305-k3/miniiam-frontend:latest  # Update this
```

### 3. Domain Names (`k8s/istio/03-gateway.yaml`)
```yaml
hosts:
  - "app.miniiam.yourdomain.com"  # Replace miniiam.local
  - "pingfederate.miniiam.yourdomain.com"
  - "pingaccess.miniiam.yourdomain.com"
```

### 4. ConfigMaps (`k8s/03-configmaps.yaml`)
```yaml
data:
  BASE_URL: "https://pingfederate.miniiam.yourdomain.com"
  VIRTUAL_HOST: "app.miniiam.yourdomain.com"
```

## Post-Deployment Configuration

### 1. Configure PingFederate OIDC Client

Access PingFederate admin: `https://pingfederate.miniiam.yourdomain.com:9999`
- Username: `administrator`
- Password: (from k8s/02-secrets.yaml)

Create OAuth client:
- Client ID: `miniiam-react-client`
- Grant Type: Authorization Code
- PKCE: Required
- Redirect URI: `https://app.miniiam.yourdomain.com/callback`

### 2. Configure PingAccess Application

Access PingAccess admin: `https://pingaccess.miniiam.yourdomain.com:9000`

Create application:
- Virtual Host: `app.miniiam.yourdomain.com`
- Destination: `http://frontend.miniiam.svc.cluster.local:80`
- Apply web session policy

## Verification

Check deployment status on both clusters:

```bash
# Asia cluster
kubectl get pods -n miniiam --context=gke-asia
kubectl get svc -n miniiam --context=gke-asia

# Europe cluster
kubectl get pods -n miniiam --context=gke-europe
kubectl get svc -n miniiam --context=gke-europe

# Check ASM sidecar injection
kubectl get pods -n miniiam -o jsonpath='{.items[*].spec.containers[*].name}' | grep istio-proxy

# Verify replication
POD=$(kubectl get pods -n miniiam -l app=pingdirectory -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD -n miniiam -- \
  /opt/out/instance/bin/dsreplication status \
  --adminUID admin --adminPassword "ReplicateM0re" --no-prompt
```

## Monitoring with Your Existing ASM

Your Service Mesh UI already shows topology. After deployment, you'll see:
- Frontend → PingAccess → PingFederate → PingDirectory
- Cross-cluster traffic between PingDirectory instances
- mTLS encryption indicators
- Request rates and latencies

Access via: GKE Console → Service Mesh → Topology

## Security Notes

**CRITICAL - Update Before Production:**
1. Change ALL passwords in `k8s/02-secrets.yaml`
2. Use GCP Secret Manager or Workload Identity Federation
3. Enable GKE Binary Authorization
4. Configure Cloud Armor for DDoS protection
5. Set up Cloud Logging for audit trails

**Leverages Your Existing Security:**
- ✅ ASM mTLS (already active)
- ✅ Workload Identity (already enabled)
- ✅ VPC-native networking (already configured)
- ✅ Private GKE nodes (if you have this enabled)

## Resource Requirements

Total per cluster:
- **CPU**: ~2.5 cores (requests) / 8.5 cores (limits)
- **Memory**: ~6.5 GB (requests) / 12.5 GB (limits)
- **Storage**: 10 GB PVC for PingDirectory

Your `wi-pool` in both clusters should handle this easily.

## Troubleshooting

### Pods not starting?
```bash
kubectl describe pod <pod-name> -n miniiam
kubectl logs <pod-name> -n miniiam
```

### ASM sidecar not injected?
```bash
# Check namespace label
kubectl get namespace miniiam --show-labels | grep istio-injection

# Should show: istio-injection=enabled or istio.io/rev=asm-managed
```

### Replication not working?
```bash
# Verify network connectivity between clusters
# Your VPC peering/mesh network should allow port 8989

# Check firewall rules in bold-lantern-480305-k3-mesh-vpc
gcloud compute firewall-rules list --filter="network:bold-lantern-480305-k3-mesh-vpc"
```

### Authentication issues?
```bash
# Test LDAP connectivity
kubectl exec -it <pingfederate-pod> -n miniiam -- \
  ldapsearch -H ldap://pingdirectory.miniiam.svc.cluster.local:1389 \
  -D "cn=administrator,cn=root dns,cn=config" \
  -w "2FederateM0re" \
  -b "dc=miniiam,dc=local" "(objectClass=*)"
```

## What This Project Gives You

✅ Complete IAM application layer for your GKE setup
✅ Production-ready Kubernetes manifests
✅ ASM-integrated security (mTLS, AuthZ policies)
✅ Multi-cluster LDAP replication
✅ Modern React frontend with OIDC
✅ Zero Trust architecture
✅ Ready for your existing Service Mesh UI
✅ Designed for your VPC and network setup

**No infrastructure changes needed** - deploys directly to your existing clusters.
