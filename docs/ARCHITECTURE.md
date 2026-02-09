# System Architecture Guide

## Overview

This document explains the architecture of the Ping IAM multi-cluster deployment on GKE, including how each component works and interacts.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    INTERNET                                              │
└─────────────────────────────────────┬───────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                          GOOGLE CLOUD PLATFORM                                           │
│                                                                                          │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │                    GKE GATEWAY API (Layer 7 Load Balancer)                        │  │
│  │                    IP: 34.36.200.69 | Port: 80                                    │  │
│  │                    GatewayClass: gke-l7-global-external-managed-mc                │  │
│  └───────────────────────────────────┬───────────────────────────────────────────────┘  │
│                                      │                                                   │
│         ┌────────────────────────────┼────────────────────────────┐                     │
│         │                            │                            │                     │
│         ▼                            ▼                            ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│  │                           GKE FLEET (Multi-Cluster)                              │   │
│  │                                                                                   │   │
│  │  ┌─────────────────────────────┐    ┌─────────────────────────────┐             │   │
│  │  │       GKE-ASIA              │    │       GKE-EUROPE            │             │   │
│  │  │    (Primary/Seed)           │    │    (Secondary/Replica)      │             │   │
│  │  │                             │    │                             │             │   │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │             │   │
│  │  │  │   PING IAM STACK      │  │    │  │   PING IAM STACK      │  │             │   │
│  │  │  │   (Full + Admins)     │  │    │  │   (Engines Only)      │  │             │   │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │             │   │
│  │  │                             │    │                             │             │   │
│  │  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │             │   │
│  │  │  │   ISTIO SERVICE MESH  │  │    │  │   ISTIO SERVICE MESH  │  │             │   │
│  │  │  │   (Envoy Sidecars)    │  │    │  │   (Envoy Sidecars)    │  │             │   │
│  │  │  └───────────────────────┘  │    │  └───────────────────────┘  │             │   │
│  │  │                             │    │                             │             │   │
│  │  └─────────────────────────────┘    └─────────────────────────────┘             │   │
│  │                    │                            │                                │   │
│  │                    └────────────────────────────┘                                │   │
│  │                    Multi-Cluster Services (MCS)                                  │   │
│  │                    clusterset.local DNS                                          │   │
│  └───────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Layers

### Layer 1: External Ingress (GKE Gateway API)

**Purpose**: Route external traffic to internal services

**Components**:
- Google Cloud L7 Load Balancer (managed)
- Gateway resource (Kubernetes)
- HTTPRoute resources (path-based routing)
- HealthCheckPolicy (custom health endpoints)

**How it works**:
1. User makes HTTP request to Gateway IP
2. L7 LB receives request and checks HTTPRoute rules
3. Request matched to backend (ServiceImport)
4. Health check verifies backend is healthy
5. Traffic forwarded to healthy pod

```yaml
# Gateway defines the entry point
Gateway (port 80)
    │
    ├── HTTPRoute (/*) ──────────────▶ pingaccess-engine:3000
    │
    └── HTTPRoute (/.well-known/*, /pf/*, /as/*) ──▶ pingfederate-engine:9031
```

---

### Layer 2: Service Mesh (Istio)

**Purpose**: Secure service-to-service communication

**Components**:
- Envoy sidecar proxies (auto-injected)
- PeerAuthentication policies
- DestinationRules
- ServiceEntries

**How it works**:
1. Pod created with `sidecar.istio.io/inject: "true"`
2. Istio injects Envoy sidecar container
3. iptables rules redirect traffic through Envoy
4. Envoy handles mTLS, load balancing, observability
5. PeerAuthentication controls mTLS mode

```
┌─────────────────────────────────────┐
│              POD                    │
│                                     │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   App       │  │   Envoy     │  │
│  │  Container  │◀─│   Sidecar   │◀─┼── Inbound Traffic
│  │             │  │             │  │
│  │             │──▶             │──┼── Outbound Traffic
│  └─────────────┘  └─────────────┘  │
│                                     │
│  iptables rules intercept all      │
│  traffic and route through Envoy   │
└─────────────────────────────────────┘
```

**mTLS Modes**:
| Mode | Description | Use Case |
|------|-------------|----------|
| STRICT | Only mTLS accepted | High security |
| PERMISSIVE | mTLS or plaintext | GCP LB ingress |
| DISABLE | No mTLS | LDAP ports |

---

### Layer 3: Multi-Cluster Services (MCS)

**Purpose**: Enable cross-cluster service discovery

**Components**:
- ServiceExport (export local service)
- ServiceImport (import remote service)
- clusterset.local DNS domain

**How it works**:
1. ServiceExport created for a Service
2. GKE Fleet controller syncs to all clusters
3. ServiceImport auto-created in other clusters
4. DNS entry created: `<svc>.ping-iam.svc.clusterset.local`
5. Traffic routed to any cluster with healthy endpoints

```
┌──────────────────────┐         ┌──────────────────────┐
│      GKE-ASIA        │         │     GKE-EUROPE       │
│                      │         │                      │
│  Service             │         │  ExternalName Svc    │
│  pingaccess-admin    │         │  pingaccess-admin    │
│       │              │         │       │              │
│       ▼              │         │       ▼              │
│  ServiceExport ──────┼─────────┼▶ ServiceImport       │
│                      │   MCS   │       │              │
│                      │         │       ▼              │
│                      │         │  clusterset.local    │
└──────────────────────┘         └──────────────────────┘
```

---

### Layer 4: Application Layer

**Purpose**: Business logic and user authentication

**Components**:
- PingDirectory (LDAP)
- PingFederate (OIDC)
- PingAccess (API Gateway)
- React App (Frontend)
- Backend API (REST)

---

## Component Deep Dive

### PingDirectory

**Architecture Type**: StatefulSet with multi-master replication

**How it works**:
1. Deployed as StatefulSet (stable pod names, persistent storage)
2. First pod in seed cluster initializes topology
3. Subsequent pods join topology via replication
4. Changes replicate bi-directionally between clusters
5. Each pod has full copy of data

**Replication Flow**:
```
┌─────────────────────────────────────────────────────────────────────┐
│                    PINGDIRECTORY REPLICATION                         │
│                                                                      │
│  gke-asia                                    gke-europe              │
│  ┌────────────────────┐                      ┌────────────────────┐  │
│  │ pingdirectory-0    │     Port 8989        │ pingdirectory-0    │  │
│  │ (SEED)             │◀────────────────────▶│ (REPLICA)          │  │
│  │                    │     Port 1636        │                    │  │
│  │ dc=example,dc=com  │                      │ dc=example,dc=com  │  │
│  │ 3 entries          │                      │ 3 entries          │  │
│  └────────────────────┘                      └────────────────────┘  │
│                                                                      │
│  Replication is BYPASSED from Istio (raw TCP)                       │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Configuration**:
```yaml
K8S_CLUSTER: "gke-asia"           # Current cluster name
K8S_SEED_CLUSTER: "gke-asia"      # Seed cluster name
K8S_SEED_HOSTNAME_SUFFIX: ".pingdirectory-cluster.ping-iam.svc.clusterset.local"
```

---

### PingFederate

**Architecture Type**: Deployment (Admin) + Deployment (Engine)

**How it works**:
1. Admin server manages configuration
2. Configuration replicated to Engine servers
3. Engines handle runtime OIDC/OAuth requests
4. Engines in secondary cluster connect to Admin via MCS

**Admin-Engine Relationship**:
```
┌─────────────────────────────────────────────────────────────────────┐
│                    PINGFEDERATE ARCHITECTURE                         │
│                                                                      │
│  gke-asia                                    gke-europe              │
│  ┌────────────────────┐                      ┌────────────────────┐  │
│  │ pingfederate-admin │                      │ (No Admin)         │  │
│  │ (Port 9999)        │                      │                    │  │
│  │ Configuration      │                      │                    │  │
│  └─────────┬──────────┘                      │                    │  │
│            │                                 │                    │  │
│            ▼                                 │                    │  │
│  ┌────────────────────┐                      ┌────────────────────┐  │
│  │ pingfederate-engine│◀─────────MCS────────▶│ pingfederate-engine│  │
│  │ (Port 9031)        │                      │ (Port 9031)        │  │
│  │ OIDC Runtime       │                      │ OIDC Runtime       │  │
│  └────────────────────┘                      └────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

### PingAccess

**Architecture Type**: Deployment (Admin) + Deployment (Engine)

**How it works**:
1. Admin server manages policies and applications
2. Configuration pushed to Engine servers
3. Engines handle runtime request processing
4. Policy decisions made at engine (no callback to admin)

**Request Processing**:
```
┌─────────────────────────────────────────────────────────────────────┐
│                    PINGACCESS REQUEST FLOW                           │
│                                                                      │
│  1. Request arrives at Engine (port 3000)                           │
│                    │                                                 │
│                    ▼                                                 │
│  2. Check session cookie                                            │
│     ├── Valid session ────────────────────────┐                     │
│     └── No session                            │                     │
│              │                                │                     │
│              ▼                                │                     │
│  3. Redirect to PingFederate                  │                     │
│              │                                │                     │
│              ▼                                │                     │
│  4. User authenticates                        │                     │
│              │                                │                     │
│              ▼                                │                     │
│  5. Return with tokens                        │                     │
│              │                                │                     │
│              ▼                                │                     │
│  6. Create session cookie ────────────────────┤                     │
│                                               │                     │
│                                               ▼                     │
│  7. Apply access policies                                           │
│              │                                                      │
│              ▼                                                      │
│  8. Inject user headers                                             │
│     • X-Forwarded-User                                              │
│     • X-Forwarded-Email                                             │
│     • X-Forwarded-Groups                                            │
│              │                                                      │
│              ▼                                                      │
│  9. Forward to backend (React App, Backend API)                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Topology

### GKE-ASIA (Primary Cluster)

| Component | Type | Replicas | Purpose |
|-----------|------|----------|---------|
| pingdirectory-0 | StatefulSet | 1 | LDAP (seed) |
| pingfederate-admin | Deployment | 1 | Config management |
| pingfederate-engine | Deployment | 1 | OIDC runtime |
| pingaccess-admin | Deployment | 1 | Config management |
| pingaccess-engine | Deployment | 1 | API Gateway |
| react-app | Deployment | 1 | Frontend |
| backend-api | Deployment | 1 | REST API |

### GKE-EUROPE (Secondary Cluster)

| Component | Type | Replicas | Purpose |
|-----------|------|----------|---------|
| pingdirectory-0 | StatefulSet | 1 | LDAP (replica) |
| pingfederate-engine | Deployment | 1 | OIDC runtime |
| pingaccess-engine | Deployment | 1 | API Gateway |
| react-app | Deployment | 1 | Frontend |
| backend-api | Deployment | 1 | REST API |

---

## Data Flow Patterns

### 1. User Authentication
```
User ─▶ Gateway ─▶ PingAccess ─▶ PingFederate ─▶ PingDirectory
                                      │
                                      ▼
                               Return tokens
                                      │
                                      ▼
                    PingAccess creates session
                                      │
                                      ▼
                         Forward to application
```

### 2. API Request (Authenticated)
```
User ─▶ Gateway ─▶ PingAccess ─▶ Backend API
                        │
                        ├── Validate session
                        ├── Apply policies
                        └── Inject headers
```

### 3. Cross-Cluster Admin Access
```
gke-europe Engine ─▶ ExternalName Service
                           │
                           ▼
                    clusterset.local DNS
                           │
                           ▼
                    gke-asia Admin Server
```

---

## Security Architecture

### Authentication Layers

| Layer | Mechanism | Description |
|-------|-----------|-------------|
| External | OIDC/OAuth | User authentication via PingFederate |
| Service | mTLS | Istio automatic TLS between services |
| Data | LDAPS | TLS for directory access |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                        TRUST BOUNDARIES                              │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  EXTERNAL (Untrusted)                                         │  │
│  │  • Internet users                                             │  │
│  │  • Public APIs                                                │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  DMZ (Semi-trusted)                                           │  │
│  │  • GKE Gateway (validates, routes)                            │  │
│  │  • PingAccess Engine (authenticates, authorizes)              │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│                              ▼                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  INTERNAL (Trusted - mTLS enforced)                           │  │
│  │  • PingFederate (identity provider)                           │  │
│  │  • PingDirectory (data store)                                 │  │
│  │  • Backend API (business logic)                               │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Failure Scenarios

### Scenario 1: gke-asia Unavailable

**Impact**:
- Admin consoles inaccessible
- No configuration changes possible
- gke-europe engines continue serving requests
- PingDirectory in gke-europe has full data copy

**Recovery**:
- Traffic automatically routes to gke-europe
- Restore gke-asia when available
- PingDirectory replication resumes automatically

### Scenario 2: gke-europe Unavailable

**Impact**:
- Reduced capacity
- gke-asia handles all traffic
- No data loss (gke-asia has full copy)

**Recovery**:
- Restore gke-europe
- PingDirectory automatically resyncs

### Scenario 3: Network Partition

**Impact**:
- Each cluster operates independently
- PingDirectory may have conflicts after partition heals
- Admin changes only apply to gke-asia

**Recovery**:
- PingDirectory resolves conflicts automatically
- Configuration changes sync when network restored

---

## Scaling Considerations

### Horizontal Scaling

| Component | Scale Strategy | Notes |
|-----------|----------------|-------|
| PingDirectory | Add pods | Increases read capacity |
| PingFederate Engine | Add replicas | Increases auth capacity |
| PingAccess Engine | Add replicas | Increases request capacity |
| React App | Add replicas | Increases frontend capacity |
| Backend API | Add replicas | Increases API capacity |

### Vertical Scaling

Increase CPU/memory limits in Helm values files.

### Geographic Scaling

Add more GKE clusters to the fleet for additional regions.
