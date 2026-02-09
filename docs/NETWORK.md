# Network Configuration Guide

## Overview

This document explains the network architecture, DNS configuration, and traffic routing in the multi-cluster GKE environment.

---

## Network Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              NETWORK LAYERS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Layer 1: External (Internet)                                               │
│  ├── GKE Gateway API (Google L7 Load Balancer)                              │
│  ├── External IP: 34.36.200.69                                              │
│  └── Protocol: HTTP/HTTPS                                                   │
│                                                                              │
│  Layer 2: Service Mesh (Istio)                                              │
│  ├── Envoy Sidecar Proxies (per pod)                                        │
│  ├── mTLS encryption (service-to-service)                                   │
│  └── PERMISSIVE mode for GCP LB ingress                                     │
│                                                                              │
│  Layer 3: Multi-Cluster Services (MCS)                                      │
│  ├── ServiceExport/ServiceImport                                            │
│  ├── clusterset.local DNS domain                                            │
│  └── Cross-cluster service discovery                                        │
│                                                                              │
│  Layer 4: Pod Network                                                       │
│  ├── gke-asia: 10.30.0.0/16                                                 │
│  └── gke-europe: 10.50.0.0/16                                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## DNS Resolution

### Local Cluster DNS
```
<service>.<namespace>.svc.cluster.local
```
Example: `pingdirectory.ping-iam.svc.cluster.local`

### Cross-Cluster DNS (MCS)
```
<service>.<namespace>.svc.clusterset.local
```
Example: `pingdirectory.ping-iam.svc.clusterset.local`

### DNS Flow
```
Pod in gke-europe wants to reach pingaccess-admin:

1. App calls: pingaccess-admin.ping-iam.svc.cluster.local
                    │
                    ▼
2. ExternalName Service redirects to:
   pingaccess-admin.ping-iam.svc.clusterset.local
                    │
                    ▼
3. MCS resolves to gke-asia ServiceImport
                    │
                    ▼
4. Traffic routed to gke-asia cluster
```

---

## Service Types

### ClusterIP Services (Local)
| Service | Port | Purpose |
|---------|------|---------|
| pingdirectory | 1389, 1636, 1443 | Directory access |
| pingfederate-engine | 9031 | OIDC runtime |
| pingfederate-admin | 9999 | Admin console |
| pingaccess-engine | 3000 | API Gateway runtime |
| pingaccess-admin | 9000 | Admin console |
| react-app | 80 | Frontend |
| backend-api | 8080 | REST API |

### Headless Services (StatefulSet)
| Service | Purpose |
|---------|---------|
| pingdirectory-cluster | Pod-to-pod replication |
| pingaccess-admin-cluster | Cluster coordination |
| pingfederate-cluster | Cluster coordination |

### ExternalName Services (gke-europe only)
| Service | Target |
|---------|--------|
| pingaccess-admin | pingaccess-admin.ping-iam.svc.clusterset.local |
| pingfederate-admin | pingfederate-admin.ping-iam.svc.clusterset.local |
| pingaccess-admin-cluster | pingaccess-admin-cluster.ping-iam.svc.clusterset.local |

---

## ServiceExport Configuration

### File: `k8s/base/service-export.yaml`

Services exported for cross-cluster discovery:

| Service | Exported From | Purpose |
|---------|---------------|---------|
| pingdirectory | Both clusters | Directory access |
| pingdirectory-cluster | Both clusters | Replication |
| pingfederate-admin | gke-asia | Admin access |
| pingfederate-engine | Both clusters | OIDC runtime |
| pingaccess-admin | gke-asia | Admin access |
| pingaccess-admin-cluster | gke-asia | Cluster coordination |
| pingaccess-engine | Both clusters | API Gateway |
| react-app | Both clusters | Frontend |
| backend-api | Both clusters | API |

---

## GKE Gateway Configuration

### File: `k8s/base/gateway.yaml`

### Gateway Resource
```yaml
apiVersion: gateway.networking.k8s.io/v1beta1
kind: Gateway
metadata:
  name: ping-iam-gateway
  namespace: ping-iam
spec:
  gatewayClassName: gke-l7-global-external-managed-mc
  listeners:
    - name: http
      protocol: HTTP
      port: 80
```

### HTTPRoutes

| Route | Path | Backend |
|-------|------|---------|
| pingaccess-main-route | `/*` | pingaccess-engine:3000 |
| pingfederate-oidc-route | `/.well-known/*` | pingfederate-engine:9031 |
| pingfederate-oidc-route | `/pf/*` | pingfederate-engine:9031 |
| pingfederate-oidc-route | `/as/*` | pingfederate-engine:9031 |

### Health Check Policies
```yaml
# PingAccess Engine
type: HTTPS
port: 3000
requestPath: /pa/heartbeat.ping

# PingFederate Engine
type: HTTPS
port: 9031
requestPath: /pf/heartbeat.ping
```

---

## Istio Configuration

### File: `k8s/base/istio-config.yaml`

### PeerAuthentication Policies

| Policy | Selector | Mode | Purpose |
|--------|----------|------|---------|
| pingdirectory-ldap-permissive | pingdirectory | PERMISSIVE | Allow LDAP bypass |
| pingaccess-engine-permissive | pingaccess-engine | PERMISSIVE | Allow GCP LB |
| pingfederate-engine-permissive | pingfederate-engine | PERMISSIVE | Allow GCP LB |

### Port-Level mTLS Disable
```yaml
portLevelMtls:
  "1389": { mode: DISABLE }  # LDAP
  "1636": { mode: DISABLE }  # LDAPS
  "8989": { mode: DISABLE }  # Replication
```

### DestinationRules

| Rule | Host | TLS Mode |
|------|------|----------|
| pingdirectory-local | *.cluster.local | ISTIO_MUTUAL (except LDAP ports) |
| pingdirectory-clusterset | *.clusterset.local | DISABLE |

---

## Port Summary

### External Ports (via Gateway)
| Port | Protocol | Endpoint |
|------|----------|----------|
| 80 | HTTP | External Gateway |

### Internal Ports
| Service | Port | Protocol | Envoy |
|---------|------|----------|-------|
| PingDirectory | 1389 | LDAP | Bypassed |
| PingDirectory | 1636 | LDAPS | Bypassed |
| PingDirectory | 1443 | HTTPS | Proxied |
| PingDirectory | 8989 | TCP | Bypassed |
| PingFederate Engine | 9031 | HTTPS | Proxied |
| PingFederate Admin | 9999 | HTTPS | Proxied |
| PingAccess Engine | 3000 | HTTPS | Proxied |
| PingAccess Admin | 9000 | HTTPS | Proxied |
| React App | 80 | HTTP | Proxied |
| Backend API | 8080 | HTTP | Proxied |

---

## Network Policies

### Current State
- No NetworkPolicy configured (open within namespace)
- Istio mTLS provides service-level security

### Recommended for Production
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-ping-components
  namespace: ping-iam
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ping-iam
        - namespaceSelector:
            matchLabels:
              name: istio-system
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: ping-iam
    - to:
        - namespaceSelector:
            matchLabels:
              name: kube-system
      ports:
        - port: 53
          protocol: UDP
```

---

## Firewall Rules

### GKE Auto-Created Rules
| Rule | Source | Destination | Ports |
|------|--------|-------------|-------|
| gke-master-to-nodes | GKE Master | Nodes | 443, 10250 |
| gke-nodes-internal | Nodes | Nodes | All |
| health-check | GCP Health Check IPs | Nodes | Service ports |

### Required for MCS
| Rule | Source | Destination | Ports |
|------|--------|-------------|-------|
| mcs-cross-cluster | gke-asia nodes | gke-europe nodes | All |
| mcs-cross-cluster | gke-europe nodes | gke-asia nodes | All |

---

## Traffic Flow Diagrams

### External Traffic (North-South)
```
Internet
    │
    ▼
┌─────────────────────────────┐
│  Google Cloud L7 LB         │
│  IP: 34.36.200.69           │
│  Port: 80                   │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  GKE Gateway (HTTPRoute)    │
│  ├── /* → PingAccess        │
│  └── /.well-known/* → PF    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  Pod (Envoy Sidecar)        │
│  ├── TLS termination        │
│  └── Forward to app         │
└─────────────────────────────┘
```

### Internal Traffic (East-West)
```
┌─────────────────┐     mTLS      ┌─────────────────┐
│  PingAccess     │◀────────────▶│  PingFederate   │
│  Pod            │               │  Pod            │
│  ┌───────────┐  │               │  ┌───────────┐  │
│  │ Envoy     │  │               │  │ Envoy     │  │
│  │ Sidecar   │  │               │  │ Sidecar   │  │
│  └───────────┘  │               │  └───────────┘  │
└─────────────────┘               └─────────────────┘
```

### Cross-Cluster Traffic
```
┌─────────────────────────────────────────────────────────────────────┐
│                         GKE Fleet                                    │
│                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────┐          │
│  │      gke-asia          │    │      gke-europe        │          │
│  │                        │    │                        │          │
│  │  pingdirectory-0 ◀─────┼────┼────▶ pingdirectory-0   │          │
│  │  (SEED)          REPL  │    │      (REPLICA)         │          │
│  │                        │    │                        │          │
│  │  ServiceExport ────────┼────┼────▶ ServiceImport     │          │
│  │                  MCS   │    │                        │          │
│  └────────────────────────┘    └────────────────────────┘          │
│                                                                      │
│  DNS: *.ping-iam.svc.clusterset.local                               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Troubleshooting

### Check DNS Resolution
```bash
# From a pod in gke-europe
kubectl exec -it <pod> -n ping-iam -- nslookup pingaccess-admin.ping-iam.svc.clusterset.local
```

### Check ServiceImport
```bash
kubectl get serviceimport -n ping-iam
```

### Check Gateway Health
```bash
kubectl get gateway -n ping-iam
gcloud compute backend-services get-health <backend-name> --global
```

### Check Istio Config
```bash
kubectl get peerauthentication -n ping-iam
kubectl get destinationrule -n ping-iam
```
