# Istio Service Mesh Configuration Guide

## Overview

This document explains how Istio service mesh is configured and enforced in the Ping IAM multi-cluster GKE environment.

---

## What is Istio?

Istio is a service mesh that provides:
- **Traffic Management** - Control traffic flow between services
- **Security** - mTLS encryption, authentication, authorization
- **Observability** - Metrics, logs, traces for all service-to-service traffic
- **Policy Enforcement** - Access control and rate limiting

---

## How Istio Works in This Project

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ISTIO IN PING IAM PROJECT                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Istio Control Plane                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │    istiod    │  │   Pilot      │  │   Citadel    │                  │ │
│  │  │ (Discovery)  │  │ (Config)     │  │ (Certs)      │                  │ │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                         │
│                                    │ Push config                             │
│                                    ▼                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        Data Plane (Per Pod)                             │ │
│  │                                                                          │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │  Pod: pingaccess-engine-xxx                                      │   │ │
│  │  │  ┌──────────────────────┐    ┌──────────────────────┐           │   │ │
│  │  │  │   Envoy Sidecar      │◀──▶│   PingAccess App     │           │   │ │
│  │  │  │   (istio-proxy)      │    │   (Port 3000)        │           │   │ │
│  │  │  │                      │    │                      │           │   │ │
│  │  │  │  • TLS termination   │    │                      │           │   │ │
│  │  │  │  • mTLS encryption   │    │                      │           │   │ │
│  │  │  │  • Traffic routing   │    │                      │           │   │ │
│  │  │  │  • Policy enforce    │    │                      │           │   │ │
│  │  │  └──────────────────────┘    └──────────────────────┘           │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Istio Features Used

### 1. Automatic Sidecar Injection

Every pod in the `ping-iam` namespace gets an Envoy sidecar automatically injected.

```
┌───────────────────────────────────────────────────────────────┐
│  Pod Before Injection              Pod After Injection        │
│  ┌─────────────────────┐          ┌─────────────────────┐    │
│  │  app-container      │    →     │  app-container      │    │
│  └─────────────────────┘          │  istio-proxy        │    │
│                                   │  istio-init         │    │
│                                   └─────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

**Enable for namespace:**
```bash
kubectl label namespace ping-iam istio-injection=enabled
```

### 2. Mutual TLS (mTLS)

Service-to-service communication is automatically encrypted using mTLS.

```
┌─────────────────┐                    ┌─────────────────┐
│  PingAccess     │      mTLS          │  PingFederate   │
│  ┌───────────┐  │◀──────────────────▶│  ┌───────────┐  │
│  │ Envoy     │  │  • Encrypted       │  │ Envoy     │  │
│  │ Sidecar   │  │  • Authenticated   │  │ Sidecar   │  │
│  └───────────┘  │  • Auto cert mgmt  │  └───────────┘  │
└─────────────────┘                    └─────────────────┘
```

### 3. PeerAuthentication Policies

Control how pods accept traffic - with or without mTLS.

| Mode | Description |
|------|-------------|
| **STRICT** | Only mTLS traffic allowed |
| **PERMISSIVE** | Accept both mTLS and plain text |
| **DISABLE** | No mTLS, plain text only |

### 4. DestinationRules

Configure how traffic is routed to services.

### 5. ServiceEntries

Allow Istio to recognize external services (like clusterset.local).

---

## Configuration File: istio-config.yaml

**Location:** `k8s/base/istio-config.yaml`

### PeerAuthentication Policies

#### PingDirectory - PERMISSIVE with Port-Level Disable

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: pingdirectory-ldap-permissive
  namespace: ping-iam
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: pingdirectory
  mtls:
    mode: PERMISSIVE
  portLevelMtls:
    "1389":    # LDAP - No mTLS
      mode: DISABLE
    "1636":    # LDAPS - No mTLS (already TLS)
      mode: DISABLE
    "8989":    # Replication - No mTLS
      mode: DISABLE
```

**Why DISABLE for these ports?**
- LDAP/LDAPS protocols don't support Istio mTLS wrapper
- Replication uses native PingDirectory encryption
- These protocols would break if mTLS was enforced

#### PingAccess Engine - PERMISSIVE

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: pingaccess-engine-permissive
  namespace: ping-iam
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: pingaccess-engine
  mtls:
    mode: PERMISSIVE
```

**Why PERMISSIVE?**
- GCP Load Balancer health checks don't support mTLS
- External traffic from Gateway API needs direct access
- Internal mesh traffic still uses mTLS when available

#### PingFederate Engine - PERMISSIVE

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: pingfederate-engine-permissive
  namespace: ping-iam
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: pingfederate-engine
  mtls:
    mode: PERMISSIVE
```

**Why PERMISSIVE?**
- Same reason as PingAccess - GCP LB health checks
- OIDC endpoints exposed via Gateway need access

---

### DestinationRules

#### Local Cluster Traffic

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: pingdirectory-local
  namespace: ping-iam
spec:
  host: pingdirectory.ping-iam.svc.cluster.local
  trafficPolicy:
    tls:
      mode: ISTIO_MUTUAL
    portLevelSettings:
      - port:
          number: 1389
        tls:
          mode: DISABLE
      - port:
          number: 1636
        tls:
          mode: DISABLE
      - port:
          number: 8989
        tls:
          mode: DISABLE
```

**Explanation:**
- Default: Use Istio mTLS (`ISTIO_MUTUAL`)
- LDAP ports: Disable mTLS (protocol incompatible)

#### Cross-Cluster Traffic (MCS)

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: pingdirectory-clusterset
  namespace: ping-iam
spec:
  host: pingdirectory.ping-iam.svc.clusterset.local
  trafficPolicy:
    tls:
      mode: DISABLE
```

**Why DISABLE for clusterset.local?**
- MCS handles cross-cluster networking
- Istio mTLS can't traverse the MCS gateway
- Traffic is already encrypted by GKE's network fabric

#### Wildcard Rule for All Services

```yaml
apiVersion: networking.istio.io/v1beta1
kind: DestinationRule
metadata:
  name: mcs-gateway-pingdirectory
  namespace: ping-iam
spec:
  host: "*.ping-iam.svc.cluster.local"
  trafficPolicy:
    portLevelSettings:
      - port:
          number: 1389
        tls:
          mode: DISABLE
      - port:
          number: 1636
        tls:
          mode: DISABLE
      - port:
          number: 8989
        tls:
          mode: DISABLE
```

---

### ServiceEntries

#### PingDirectory Clusterset Entry

```yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: pingdirectory-clusterset-entry
  namespace: ping-iam
spec:
  hosts:
    - pingdirectory.ping-iam.svc.clusterset.local
  location: MESH_INTERNAL
  resolution: DNS
  ports:
    - number: 1389
      name: tcp-ldap
      protocol: TCP
    - number: 1636
      name: tcp-ldaps
      protocol: TCP
    - number: 8989
      name: tcp-replication
      protocol: TCP
    - number: 1443
      name: https
      protocol: HTTPS
```

**Why ServiceEntry?**
- Istio doesn't automatically know about `clusterset.local` DNS
- ServiceEntry tells Istio this is a valid internal service
- Enables proper routing for cross-cluster traffic

---

## Traffic Flow with Istio

### Internal Traffic (Within Cluster)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INTERNAL TRAFFIC FLOW (mTLS Encrypted)                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PingAccess Pod                              PingFederate Pod               │
│  ┌────────────────────────────┐              ┌────────────────────────────┐ │
│  │  ┌─────────┐  ┌─────────┐  │              │  ┌─────────┐  ┌─────────┐  │ │
│  │  │PingAcc  │  │ Envoy   │  │   ──────▶    │  │ Envoy   │  │PingFed  │  │ │
│  │  │App      │→ │ Proxy   │  │   mTLS       │  │ Proxy   │→ │App      │  │ │
│  │  │:3000    │  │         │  │   ◀──────    │  │         │  │:9031    │  │ │
│  │  └─────────┘  └─────────┘  │              │  └─────────┘  └─────────┘  │ │
│  └────────────────────────────┘              └────────────────────────────┘ │
│                                                                              │
│  Step 1: PingAccess app sends request to PingFederate                       │
│  Step 2: Envoy sidecar intercepts outgoing traffic                          │
│  Step 3: Envoy encrypts with mTLS                                           │
│  Step 4: Traffic sent to destination Envoy                                  │
│  Step 5: Destination Envoy decrypts and forwards to app                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### External Traffic (GCP Load Balancer)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXTERNAL TRAFFIC FLOW (No mTLS)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Internet → GCP L7 LB → NEG → Pod                                          │
│                                                                              │
│  ┌─────────┐    ┌─────────┐    ┌────────────────────────────┐              │
│  │ Client  │───▶│ GCP LB  │───▶│  PingAccess Pod            │              │
│  │         │    │         │    │  ┌─────────┐  ┌─────────┐  │              │
│  │         │    │ Health  │    │  │ Envoy   │→ │PingAcc  │  │              │
│  │         │    │ Check   │───▶│  │ Proxy   │  │App      │  │              │
│  │         │    │ /pa/... │    │  │PERMISSIVE│  │:3000    │  │              │
│  └─────────┘    └─────────┘    │  └─────────┘  └─────────┘  │              │
│                                └────────────────────────────┘              │
│                                                                              │
│  Why PERMISSIVE mode?                                                       │
│  • GCP LB doesn't speak mTLS                                                │
│  • Health checks need direct access to pods                                 │
│  • PERMISSIVE allows both mTLS (mesh) and plain (external)                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cross-Cluster Traffic (MCS)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CROSS-CLUSTER TRAFFIC FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GKE-ASIA                                    GKE-EUROPE                     │
│  ┌────────────────────────┐                  ┌────────────────────────┐    │
│  │  PingDirectory-0       │                  │  PingDirectory-0       │    │
│  │  ┌─────────┐           │    MCS + VPC     │           ┌─────────┐  │    │
│  │  │ Envoy   │           │◀────────────────▶│           │ Envoy   │  │    │
│  │  │ mTLS    │           │  clusterset.     │           │ mTLS    │  │    │
│  │  │ DISABLE │           │  local DNS       │           │ DISABLE │  │    │
│  │  └─────────┘           │                  │           └─────────┘  │    │
│  └────────────────────────┘                  └────────────────────────┘    │
│                                                                              │
│  Why DISABLE mTLS for cross-cluster?                                        │
│  • MCS uses GKE's internal encrypted network                                │
│  • Istio mTLS can't traverse MCS gateway                                    │
│  • Native LDAPS encryption already secures traffic                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Istio Enforcement Matrix

| Component | Port | mTLS Mode | Reason |
|-----------|------|-----------|--------|
| PingDirectory | 1389 | DISABLE | LDAP protocol |
| PingDirectory | 1636 | DISABLE | LDAPS (native TLS) |
| PingDirectory | 8989 | DISABLE | Replication protocol |
| PingDirectory | 1443 | PERMISSIVE | HTTPS admin |
| PingFederate Engine | 9031 | PERMISSIVE | GCP LB access |
| PingFederate Admin | 9999 | ISTIO_MUTUAL | Internal only |
| PingAccess Engine | 3000 | PERMISSIVE | GCP LB access |
| PingAccess Admin | 9000 | ISTIO_MUTUAL | Internal only |
| React App | 80 | ISTIO_MUTUAL | Internal mesh |
| Backend API | 8080 | ISTIO_MUTUAL | Internal mesh |

---

## Commands

### Check Istio Installation

```bash
# Check Istio pods
kubectl get pods -n istio-system

# Check Istio version
istioctl version

# Check if namespace has sidecar injection enabled
kubectl get namespace ping-iam -o jsonpath='{.metadata.labels.istio-injection}'
```

### Apply Istio Configuration

```bash
# Apply to both clusters
kubectl config use-context gke-asia
kubectl apply -f k8s/base/istio-config.yaml

kubectl config use-context gke-europe
kubectl apply -f k8s/base/istio-config.yaml
```

### Verify Configuration

```bash
# Check PeerAuthentication
kubectl get peerauthentication -n ping-iam

# Check DestinationRules
kubectl get destinationrule -n ping-iam

# Check ServiceEntries
kubectl get serviceentry -n ping-iam

# Describe specific policy
kubectl describe peerauthentication pingaccess-engine-permissive -n ping-iam
```

### Debug Istio Sidecar

```bash
# Check sidecar injection
kubectl get pods -n ping-iam -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].name}{"\n"}{end}'

# View Envoy config
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET config_dump

# Check clusters (backends)
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET clusters

# Check Envoy stats
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET stats

# View Istio proxy logs
kubectl logs <pod-name> -n ping-iam -c istio-proxy
```

### Check mTLS Status

```bash
# Check mTLS status for a pod
istioctl x describe pod <pod-name> -n ping-iam

# Check authentication policies
istioctl authn tls-check <pod-name> -n ping-iam

# Analyze configuration
istioctl analyze -n ping-iam
```

---

## Troubleshooting

### Problem: GCP LB Health Check Failing

**Symptom:** Backend shows UNHEALTHY in GCP console

**Cause:** Istio mTLS rejecting non-mTLS traffic from GCP LB

**Solution:** Add PeerAuthentication with PERMISSIVE mode

```yaml
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: pingaccess-engine-permissive
  namespace: ping-iam
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: pingaccess-engine
  mtls:
    mode: PERMISSIVE
```

### Problem: LDAP Connection Failing

**Symptom:** PingFederate can't connect to PingDirectory

**Cause:** Istio mTLS wrapping LDAP traffic

**Solution:** Disable mTLS for LDAP ports

```yaml
portLevelMtls:
  "1389":
    mode: DISABLE
  "1636":
    mode: DISABLE
```

### Problem: Cross-Cluster Traffic Failing

**Symptom:** Services can't reach clusterset.local endpoints

**Cause:** Istio doesn't recognize clusterset.local domain

**Solution:** Add ServiceEntry for clusterset.local

```yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: pingdirectory-clusterset-entry
  namespace: ping-iam
spec:
  hosts:
    - pingdirectory.ping-iam.svc.clusterset.local
  location: MESH_INTERNAL
  resolution: DNS
```

### Problem: 503 Service Unavailable

**Symptom:** Requests fail with 503 errors

**Check Steps:**
```bash
# 1. Check if pod has sidecar
kubectl get pod <pod-name> -n ping-iam -o jsonpath='{.spec.containers[*].name}'

# 2. Check Envoy clusters
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET clusters | grep <service-name>

# 3. Check for config sync issues
istioctl proxy-status

# 4. View Envoy error logs
kubectl logs <pod-name> -n ping-iam -c istio-proxy | grep error
```

---

## Best Practices

### 1. Use PERMISSIVE Mode for External-Facing Services

Services that receive traffic from outside the mesh (GCP LB, external clients) should use PERMISSIVE mode.

### 2. Disable mTLS for Non-HTTP Protocols

Protocols like LDAP, custom TCP don't work with Istio mTLS wrapper. Disable mTLS at the port level.

### 3. Use ServiceEntries for External Services

Always create ServiceEntries for services outside the mesh (clusterset.local, external APIs).

### 4. Monitor with Kiali

```bash
# Install Kiali (if not installed)
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.17/samples/addons/kiali.yaml

# Access Kiali dashboard
kubectl port-forward svc/kiali -n istio-system 20001:20001
```

### 5. Regular Configuration Analysis

```bash
# Analyze for issues
istioctl analyze -n ping-iam

# Check for deprecated APIs
istioctl analyze -A
```

---

## Security Considerations

### What Istio Provides

- **Encryption in Transit** - All mesh traffic encrypted with mTLS
- **Service Identity** - Each service has a unique identity (SPIFFE)
- **Zero-Trust Networking** - No implicit trust between services
- **Certificate Management** - Automatic rotation of TLS certificates

### What to Be Aware Of

- **PERMISSIVE Mode Risk** - Allows unencrypted traffic; use only when necessary
- **Port-Level DISABLE** - Those ports have no mTLS protection
- **Cross-Cluster Traffic** - Relies on GKE network encryption, not Istio mTLS

### Production Recommendations

1. **Minimize PERMISSIVE usage** - Only for services that need external access
2. **Use AuthorizationPolicy** - Add explicit allow/deny rules
3. **Enable access logging** - For audit trails
4. **Regular security audits** - Review PeerAuthentication policies

---

## Summary

| Istio Resource | Purpose | Applied To |
|----------------|---------|------------|
| PeerAuthentication | Control mTLS acceptance | PingDirectory, PingAccess, PingFederate |
| DestinationRule | Configure outbound traffic TLS | Local and clusterset.local hosts |
| ServiceEntry | Register external hosts | clusterset.local DNS names |

The Istio configuration in this project balances security (mTLS for internal traffic) with functionality (allowing GCP LB and LDAP traffic to work correctly).
