# GKE Multi-Cluster PingDirectory Replication
## Technical Implementation Guide

**Document Version:** 1.0
**Date:** February 2026
**Classification:** Technical Documentation
**Platform:** Google Kubernetes Engine (GKE)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [GCP Infrastructure Setup](#4-gcp-infrastructure-setup)
5. [GKE Fleet and Multi-Cluster Services](#5-gke-fleet-and-multi-cluster-services)
6. [Cloud Service Mesh Configuration](#6-cloud-service-mesh-configuration)
7. [PingDirectory Deployment](#7-pingdirectory-deployment)
8. [Cross-Cluster Replication](#8-cross-cluster-replication)
9. [Istio Traffic Management](#9-istio-traffic-management)
10. [Monitoring and Observability](#10-monitoring-and-observability)
11. [Security Considerations](#11-security-considerations)
12. [Troubleshooting Guide](#12-troubleshooting-guide)
13. [Appendix](#13-appendix)

---

## 1. Executive Summary

### 1.1 Purpose

This document provides comprehensive technical guidance for deploying PingDirectory with multi-master replication across Google Kubernetes Engine (GKE) clusters in multiple regions. The implementation leverages GKE Fleet, Multi-Cluster Services (MCS), and Cloud Service Mesh for secure, reliable cross-cluster communication.

### 1.2 Scope

- Multi-region GKE cluster deployment
- GKE Fleet registration and management
- Multi-Cluster Services (MCS) for cross-cluster service discovery
- Cloud Service Mesh (managed Istio) configuration
- PingDirectory multi-master replication setup
- Industry best practices for LDAP traffic in service mesh environments

### 1.3 Target Audience

- Platform Engineers
- DevOps Engineers
- Identity and Access Management (IAM) Architects
- Site Reliability Engineers (SRE)

---

## 2. Architecture Overview

### 2.1 High-Level Architecture

```
                              ┌─────────────────────────────────────┐
                              │         GCP Project                 │
                              │    (bold-lantern-480305-k3)         │
                              └──────────────┬──────────────────────┘
                                             │
                              ┌──────────────┴──────────────────────┐
                              │           GKE Fleet                 │
                              │     (Central Management Plane)      │
                              └──────────────┬──────────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              │                              │                              │
              ▼                              ▼                              ▼
    ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐
    │  Multi-Cluster  │          │  Cloud Service  │          │    VPC Network  │
    │    Services     │          │      Mesh       │          │    Peering      │
    │     (MCS)       │          │  (Managed Istio)│          │                 │
    └────────┬────────┘          └────────┬────────┘          └─────────────────┘
             │                            │
             └────────────┬───────────────┘
                          │
                          ▼
    ┌─────────────────────────────────────────────────────────────────────────┐
    │                  Cross-Cluster DNS Domain                               │
    │              *.ping-iam.svc.clusterset.local                            │
    └─────────────────────────────────────────────────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌─────────────────────┐          ┌─────────────────────┐
│      gke-asia       │          │     gke-europe      │
│  (asia-southeast1)  │          │   (europe-west1)    │
│    Seed Cluster     │          │   Non-Seed Cluster  │
├─────────────────────┤          ├─────────────────────┤
│                     │          │                     │
│  ┌───────────────┐  │          │  ┌───────────────┐  │
│  │ PingDirectory │  │◄────────►│  │ PingDirectory │  │
│  │   (Primary)   │  │  LDAPS   │  │  (Replica)    │  │
│  │   Port 1636   │  │  Sync    │  │   Port 1636   │  │
│  └───────────────┘  │          │  └───────────────┘  │
│                     │          │                     │
│  ┌───────────────┐  │          │  ┌───────────────┐  │
│  │ PingFederate  │  │          │  │ PingFederate  │  │
│  │    Admin      │  │          │  │    Engine     │  │
│  └───────────────┘  │          │  └───────────────┘  │
│                     │          │                     │
│  ┌───────────────┐  │          │  ┌───────────────┐  │
│  │  PingAccess   │  │          │  │  PingAccess   │  │
│  │    Admin      │  │          │  │    Engine     │  │
│  └───────────────┘  │          │  └───────────────┘  │
│                     │          │                     │
│  ┌───────────────┐  │          │  ┌───────────────┐  │
│  │ Istio Sidecar │  │          │  │ Istio Sidecar │  │
│  │   (Envoy)     │  │          │  │   (Envoy)     │  │
│  └───────────────┘  │          │  └───────────────┘  │
│                     │          │                     │
└─────────────────────┘          └─────────────────────┘
```

### 2.2 Component Overview

| Component | Purpose | Version |
|-----------|---------|---------|
| GKE | Kubernetes platform | 1.28+ |
| GKE Fleet | Multi-cluster management | N/A |
| Multi-Cluster Services | Cross-cluster service discovery | N/A |
| Cloud Service Mesh | Managed Istio service mesh | 1.17+ |
| PingDirectory | LDAP directory server | 2512 |
| PingFederate | Federation server | 2512 |
| PingAccess | API gateway | 2512 |

### 2.3 Network Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GCP VPC Network                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │   Subnet: asia-southeast1   │    │   Subnet: europe-west1      │        │
│  │   CIDR: 10.40.0.0/16        │    │   CIDR: 10.44.0.0/16        │        │
│  │                             │    │                             │        │
│  │  ┌───────────────────────┐  │    │  ┌───────────────────────┐  │        │
│  │  │     gke-asia          │  │    │  │    gke-europe         │  │        │
│  │  │  Pod CIDR: /14        │  │    │  │  Pod CIDR: /14        │  │        │
│  │  │  Svc CIDR: /20        │  │    │  │  Svc CIDR: /20        │  │        │
│  │  └───────────────────────┘  │    │  └───────────────────────┘  │        │
│  │                             │    │                             │        │
│  └─────────────────────────────┘    └─────────────────────────────┘        │
│                                                                             │
│                    ┌─────────────────────────────┐                          │
│                    │   Cloud NAT / Cloud Router  │                          │
│                    │   (Egress for private nodes)│                          │
│                    └─────────────────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Prerequisites

### 3.1 GCP Requirements

| Requirement | Specification |
|-------------|---------------|
| GCP Project | Active billing account |
| IAM Roles | `roles/container.admin`, `roles/gkehub.admin`, `roles/meshconfig.admin` |
| Quotas | Sufficient CPU, memory, and IP quotas in target regions |
| APIs | See Section 4.1 |

### 3.2 Required GCP APIs

```bash
# Core APIs
gcloud services enable container.googleapis.com
gcloud services enable gkehub.googleapis.com
gcloud services enable multiclusterservicediscovery.googleapis.com
gcloud services enable mesh.googleapis.com
gcloud services enable meshconfig.googleapis.com
gcloud services enable anthos.googleapis.com

# Networking APIs
gcloud services enable compute.googleapis.com
gcloud services enable dns.googleapis.com
gcloud services enable networkservices.googleapis.com
gcloud services enable trafficdirector.googleapis.com

# Security APIs
gcloud services enable iam.googleapis.com
gcloud services enable cloudresourcemanager.googleapis.com
```

### 3.3 Tools Required

| Tool | Version | Purpose |
|------|---------|---------|
| gcloud CLI | Latest | GCP management |
| kubectl | 1.28+ | Kubernetes management |
| Helm | 3.x | Chart deployment |
| ldapsearch | Any | LDAP testing |

---

## 4. GCP Infrastructure Setup

### 4.1 Create GKE Clusters

#### 4.1.1 Asia Cluster (Seed)

```bash
gcloud container clusters create gke-asia \
  --project=bold-lantern-480305-k3 \
  --region=asia-southeast1 \
  --release-channel=regular \
  --enable-ip-alias \
  --enable-fleet \
  --workload-pool=bold-lantern-480305-k3.svc.id.goog \
  --machine-type=e2-standard-4 \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=5
```

#### 4.1.2 Europe Cluster (Non-Seed)

```bash
gcloud container clusters create gke-europe \
  --project=bold-lantern-480305-k3 \
  --region=europe-west1 \
  --release-channel=regular \
  --enable-ip-alias \
  --enable-fleet \
  --workload-pool=bold-lantern-480305-k3.svc.id.goog \
  --machine-type=e2-standard-4 \
  --num-nodes=2 \
  --enable-autoscaling \
  --min-nodes=1 \
  --max-nodes=5
```

### 4.2 Configure kubectl Contexts

```bash
# Get credentials for both clusters
gcloud container clusters get-credentials gke-asia \
  --region=asia-southeast1 \
  --project=bold-lantern-480305-k3

gcloud container clusters get-credentials gke-europe \
  --region=europe-west1 \
  --project=bold-lantern-480305-k3

# Verify contexts
kubectl config get-contexts
```

---

## 5. GKE Fleet and Multi-Cluster Services

### 5.1 Fleet Registration

Fleet provides a unified way to manage multiple GKE clusters as a single entity.

```bash
# Register clusters to fleet (if not using --enable-fleet during creation)
gcloud container fleet memberships register gke-asia \
  --gke-cluster=asia-southeast1/gke-asia \
  --enable-workload-identity \
  --project=bold-lantern-480305-k3

gcloud container fleet memberships register gke-europe \
  --gke-cluster=europe-west1/gke-europe \
  --enable-workload-identity \
  --project=bold-lantern-480305-k3

# Verify memberships
gcloud container fleet memberships list --project=bold-lantern-480305-k3
```

**Expected Output:**
```
NAME        UNIQUE_ID                             LOCATION
gke-asia    ff2c755c-f9bc-4658-8ece-dea82be17acd  global
gke-europe  28212dfb-0130-4c8f-ad2e-d8261f70d806  global
```

### 5.2 Enable Multi-Cluster Services (MCS)

MCS enables service discovery across clusters using the `clusterset.local` DNS domain.

```bash
# Enable MCS feature
gcloud container fleet multi-cluster-services enable \
  --project=bold-lantern-480305-k3

# Grant required IAM permissions
gcloud projects add-iam-policy-binding bold-lantern-480305-k3 \
  --member="serviceAccount:bold-lantern-480305-k3.svc.id.goog[gke-mcs/gke-mcs-importer]" \
  --role="roles/compute.networkViewer"

# Verify MCS status
gcloud container fleet multi-cluster-services describe \
  --project=bold-lantern-480305-k3
```

**Expected Output:**
```yaml
membershipStates:
  projects/468635859848/locations/global/memberships/gke-asia:
    state:
      code: OK
      description: Firewall successfully updated
  projects/468635859848/locations/global/memberships/gke-europe:
    state:
      code: OK
      description: Firewall successfully updated
state:
  state:
    code: OK
    description: There are 6 ServiceExports in the Fleet.
```

### 5.3 How MCS DNS Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MCS DNS Resolution Flow                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Client Pod (gke-europe)                                                    │
│       │                                                                     │
│       │ DNS Query: pingdirectory.ping-iam.svc.clusterset.local              │
│       ▼                                                                     │
│  ┌─────────────────┐                                                        │
│  │   CoreDNS       │                                                        │
│  │   (in-cluster)  │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ Forward to MCS DNS                                              │
│           ▼                                                                 │
│  ┌─────────────────┐                                                        │
│  │   MCS Controller│                                                        │
│  │   (gke-mcs)     │                                                        │
│  └────────┬────────┘                                                        │
│           │                                                                 │
│           │ Returns IPs from all clusters with ServiceExport                │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │  Response: 10.40.x.x (gke-asia), 10.44.x.x (gke-europe)         │        │
│  └─────────────────────────────────────────────────────────────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.4 DNS Domains Reference

| Domain Pattern | Scope | Example |
|----------------|-------|---------|
| `svc.cluster.local` | Single cluster | `pingdirectory.ping-iam.svc.cluster.local` |
| `svc.clusterset.local` | All fleet clusters | `pingdirectory.ping-iam.svc.clusterset.local` |
| `svc.<cluster>.local` | Specific cluster | `pingdirectory.ping-iam.svc.gke-asia.local` |

---

## 6. Cloud Service Mesh Configuration

### 6.1 Enable Cloud Service Mesh

Cloud Service Mesh provides managed Istio without running istiod in your cluster.

```bash
# Enable mesh feature on fleet
gcloud container fleet mesh enable --project=bold-lantern-480305-k3

# Configure automatic mesh management
gcloud container fleet mesh update \
  --management=automatic \
  --memberships=gke-asia,gke-europe \
  --project=bold-lantern-480305-k3

# Verify mesh status
gcloud container fleet mesh describe --project=bold-lantern-480305-k3
```

### 6.2 Namespace Configuration

```bash
# Create namespace on both clusters
kubectl create namespace ping-iam --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
kubectl create namespace ping-iam --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe

# Enable Istio injection
kubectl label namespace ping-iam istio-injection=enabled --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
kubectl label namespace ping-iam istio-injection=enabled --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe
```

### 6.3 Istio Configuration for LDAP Traffic

**Industry Best Practice:** Keep Istio sidecar enabled for observability but exclude LDAP ports from proxy interception.

#### 6.3.1 Why Exclude LDAP Ports?

| Reason | Explanation |
|--------|-------------|
| Protocol Compatibility | LDAP/LDAPS uses binary protocol that doesn't benefit from HTTP-level features |
| TLS Handling | LDAPS (port 1636) already provides TLS encryption |
| Performance | Direct connection reduces latency for replication traffic |
| Reliability | Avoids protocol detection issues with Istio proxy |

#### 6.3.2 Port Exclusion via Pod Annotations

```yaml
# Pod annotations for PingDirectory
annotations:
  sidecar.istio.io/inject: "true"
  traffic.sidecar.istio.io/excludeOutboundPorts: "1389,1636,8989"
  traffic.sidecar.istio.io/excludeInboundPorts: "1389,1636,8989"
```

**Traffic Flow with Port Exclusion:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PingDirectory Pod with Istio Sidecar                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Inbound Traffic:                                                           │
│                                                                             │
│  HTTP (1443) ──────► [Envoy Proxy] ──────► PingDirectory Container          │
│                      (mTLS, metrics)                                        │
│                                                                             │
│  LDAP (1389) ──────────────────────────► PingDirectory Container            │
│              (bypasses Envoy - excluded)                                    │
│                                                                             │
│  LDAPS (1636) ─────────────────────────► PingDirectory Container            │
│               (bypasses Envoy - excluded)                                   │
│                                                                             │
│  Replication (8989) ───────────────────► PingDirectory Container            │
│                     (bypasses Envoy - excluded)                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. PingDirectory Deployment

### 7.1 Helm Chart Configuration

#### 7.1.1 Base Values (ping-devops-values.yaml)

```yaml
# Global Configuration
global:
  addReleaseNameToResource: none
  envs:
    PING_IDENTITY_ACCEPT_EULA: "YES"
  secretEnvs:
    - secretRef:
        name: devops-secret
  image:
    repository: pingidentity
    pullPolicy: IfNotPresent
    tag: "2512"
  ingress:
    enabled: false
  labels:
    app.kubernetes.io/part-of: ping-iam

# PingDirectory Configuration
pingdirectory:
  enabled: true
  name: pingdirectory

  workload:
    type: StatefulSet
    annotations:
      sidecar.istio.io/inject: "true"
      traffic.sidecar.istio.io/excludeOutboundPorts: "1389,1636,8989"
      traffic.sidecar.istio.io/excludeInboundPorts: "1389,1636,8989"

  container:
    replicaCount: 1
    resources:
      requests:
        cpu: 500m
        memory: 1Gi
      limits:
        cpu: 2
        memory: 2Gi

  envs:
    ROOT_USER_DN: "cn=administrator"
    ROOT_USER_PASSWORD: "2FederateM0re"
    USER_BASE_DN: "dc=example,dc=com"
    MAX_HEAP_SIZE: "768m"

  services:
    ldap:
      servicePort: 1389
      containerPort: 1389
      dataService: true
    ldaps:
      servicePort: 1636
      containerPort: 1636
      dataService: true
    https:
      servicePort: 1443
      containerPort: 1443
      dataService: true
    replication:
      servicePort: 8989
      containerPort: 8989
      clusterService: true

  persistentvolume:
    enabled: true
    volumes:
      out:
        mountPath: /opt/out
        persistentVolumeClaim:
          accessModes:
            - ReadWriteOnce
          storageClassName: standard-rwo
          resources:
            requests:
              storage: 5Gi
```

#### 7.1.2 Seed Cluster Values (gke-asia)

```yaml
# k8s/overlays/gke-asia/values-pingdirectory.yaml
pingdirectory:
  enabled: true

  envs:
    PD_CLUSTER_NAME: "gke-asia"
    K8S_CLUSTERS: "gke-asia,gke-europe"
    K8S_CLUSTER: "gke-asia"
    K8S_SEED_CLUSTER: "gke-asia"
    K8S_POD_HOSTNAME_PREFIX: "pingdirectory-"
    K8S_POD_HOSTNAME_SUFFIX: ".ping-iam.svc.cluster.local"
    REPLICATION_PORT: "8989"
    LDAPS_PORT: "1636"
    LDAP_PORT: "1389"
```

#### 7.1.3 Non-Seed Cluster Values (gke-europe)

```yaml
# k8s/overlays/gke-europe/values-pingdirectory.yaml
pingdirectory:
  enabled: true

  envs:
    PD_CLUSTER_NAME: "gke-europe"
    HOSTNAME: "pingdirectory-europe"
    K8S_CLUSTERS: "gke-asia,gke-europe"
    K8S_CLUSTER: "gke-europe"
    K8S_SEED_CLUSTER: "gke-asia"
    K8S_POD_HOSTNAME_PREFIX: "pingdirectory-"
    K8S_POD_HOSTNAME_SUFFIX: ".ping-iam.svc.cluster.local"
    REPLICATION_PORT: "8989"
    LDAPS_PORT: "1636"
    LDAP_PORT: "1389"
```

### 7.2 Deploy PingDirectory

```bash
# Deploy to seed cluster first
helm upgrade --install ping-iam pingidentity/ping-devops \
  -f k8s/base/ping-devops-values.yaml \
  -f k8s/overlays/gke-asia/values-pingdirectory.yaml \
  -n ping-iam \
  --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia

# Wait for seed to be ready, then deploy to non-seed
helm upgrade --install ping-iam pingidentity/ping-devops \
  -f k8s/base/ping-devops-values.yaml \
  -f k8s/overlays/gke-europe/values-pingdirectory.yaml \
  -n ping-iam \
  --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe
```

---

## 8. Cross-Cluster Replication

### 8.1 ServiceExport Configuration

ServiceExport makes services discoverable across the fleet.

```yaml
# serviceexport-pingdirectory.yaml
apiVersion: net.gke.io/v1
kind: ServiceExport
metadata:
  name: pingdirectory
  namespace: ping-iam
---
apiVersion: net.gke.io/v1
kind: ServiceExport
metadata:
  name: pingdirectory-cluster
  namespace: ping-iam
```

Apply to both clusters:

```bash
kubectl apply -f serviceexport-pingdirectory.yaml \
  --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia

kubectl apply -f serviceexport-pingdirectory.yaml \
  --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe
```

### 8.2 Verify ServiceExports

```bash
kubectl get serviceexports -n ping-iam --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
```

**Expected Output:**
```
NAMESPACE   NAME                    AGE
ping-iam    pingdirectory           45h
ping-iam    pingdirectory-cluster   45h
```

### 8.3 Replication Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PingDirectory Replication Topology                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Replication Domain: dc=example,dc=com            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                        │
│                    │                               │                        │
│                    ▼                               ▼                        │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐        │
│  │        gke-asia             │    │       gke-europe            │        │
│  │      (Seed Cluster)         │    │    (Non-Seed Cluster)       │        │
│  ├─────────────────────────────┤    ├─────────────────────────────┤        │
│  │                             │    │                             │        │
│  │  Server ID: pingdirectory-0 │    │  Server ID: pingdirectory-0 │        │
│  │  .pingdirectory-cluster     │    │  .gke-europe                │        │
│  │                             │    │                             │        │
│  │  Location: Docker           │    │  Location: gke-europe       │        │
│  │  Entries: 4                 │    │  Entries: 4                 │        │
│  │  Backlog: 0                 │    │  Backlog: 0                 │        │
│  │                             │    │                             │        │
│  └──────────────┬──────────────┘    └──────────────┬──────────────┘        │
│                 │                                  │                        │
│                 │         LDAPS (Port 1636)        │                        │
│                 │◄────────────────────────────────►│                        │
│                 │      Replication (Port 8989)     │                        │
│                 │◄────────────────────────────────►│                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 8.4 Check Replication Status

```bash
# Check from any cluster
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt
```

**Expected Output:**
```
          --- Replication Status for dc=example,dc=com: Enabled ---
Server                                           : Location   : Entries : Backlog : Rate
-------------------------------------------------:------------:---------:---------:-----
pingdirectory-0.pingdirectory-cluster (asia)     : Docker     : 4       : 0       : 0
pingdirectory-0.gke-europe                       : gke-europe : 4       : 0       : 0
```

**Key Metrics:**
| Metric | Healthy Value | Description |
|--------|---------------|-------------|
| Entries | Same across servers | Number of directory entries |
| Conflict Entries | 0 | Replication conflicts |
| Backlog | 0 or near 0 | Pending changes to replicate |
| Rate | Varies | Changes per second |

---

## 9. Istio Traffic Management

### 9.1 PeerAuthentication

Configures mTLS mode for PingDirectory workloads.

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
    1389:
      mode: DISABLE
    1636:
      mode: DISABLE
    8989:
      mode: DISABLE
```

### 9.2 DestinationRule for Local Cluster

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
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 30s
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

### 9.3 DestinationRule for Cross-Cluster

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
    connectionPool:
      tcp:
        maxConnections: 100
        connectTimeout: 60s
```

### 9.4 ServiceEntry for Cross-Cluster DNS

```yaml
apiVersion: networking.istio.io/v1beta1
kind: ServiceEntry
metadata:
  name: pingdirectory-clusterset-entry
  namespace: ping-iam
spec:
  hosts:
    - pingdirectory.ping-iam.svc.clusterset.local
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
  location: MESH_INTERNAL
  resolution: DNS
```

---

## 10. Monitoring and Observability

### 10.1 Prometheus Installation

```bash
# Install Prometheus on both clusters
kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.17/samples/addons/prometheus.yaml \
  -n istio-system --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia

kubectl apply -f https://raw.githubusercontent.com/istio/istio/release-1.17/samples/addons/prometheus.yaml \
  -n istio-system --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe
```

### 10.2 Key Metrics to Monitor

| Metric | Source | Description |
|--------|--------|-------------|
| `istio_requests_total` | Istio | Total HTTP requests |
| `istio_tcp_connections_opened_total` | Istio | TCP connections |
| `ds_replication_backlog` | PingDirectory | Replication lag |
| `ds_connection_count` | PingDirectory | Active connections |

### 10.3 Health Check Commands

```bash
# Check pod status
kubectl get pods -n ping-iam -o wide

# Check replication status
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt

# Check LDAP connectivity
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -h localhost -p 1636 -Z -X \
  -D "cn=administrator" -w "2FederateM0re" \
  -b "dc=example,dc=com" "(objectClass=*)" dn

# Check cross-cluster DNS resolution
kubectl exec -it deployment/pingfederate-engine -n ping-iam -- \
  nslookup pingdirectory.ping-iam.svc.clusterset.local
```

---

## 11. Security Considerations

### 11.1 Network Security

| Layer | Control | Implementation |
|-------|---------|----------------|
| VPC | Firewall Rules | Auto-configured by MCS |
| Pod | Network Policies | Istio AuthorizationPolicy |
| Transport | mTLS | Cloud Service Mesh |
| Application | LDAPS | PingDirectory native TLS |

### 11.2 Authentication and Authorization

```yaml
# Example: Restrict LDAP access to specific workloads
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: pingdirectory-access
  namespace: ping-iam
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: pingdirectory
  rules:
    - from:
        - source:
            principals:
              - "cluster.local/ns/ping-iam/sa/pingfederate-engine"
              - "cluster.local/ns/ping-iam/sa/pingaccess-engine"
```

### 11.3 Secrets Management

```bash
# Create DevOps secret
kubectl create secret generic devops-secret \
  --from-literal=PING_IDENTITY_DEVOPS_USER="your-devops-user" \
  --from-literal=PING_IDENTITY_DEVOPS_KEY="your-devops-key" \
  -n ping-iam
```

**Best Practices:**
- Use Kubernetes Secrets or external secret management (HashiCorp Vault, Google Secret Manager)
- Enable encryption at rest for etcd
- Use workload identity for GCP service access
- Rotate credentials regularly

---

## 12. Troubleshooting Guide

### 12.1 Common Issues and Solutions

#### Issue: Replication Not Working

**Symptoms:**
- Backlog increasing
- Entries mismatch between servers

**Diagnosis:**
```bash
# Check replication status
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt

# Check pod logs
kubectl logs pingdirectory-0 -n ping-iam

# Test cross-cluster connectivity
kubectl exec pingdirectory-0 -n ping-iam -- \
  ldapsearch -h pingdirectory.ping-iam.svc.clusterset.local -p 1636 -Z -X \
  -D "cn=administrator" -w "2FederateM0re" \
  -b "" -s base "(objectClass=*)" namingContexts
```

**Solutions:**
1. Verify ServiceExports exist in both clusters
2. Check firewall rules are applied (MCS status)
3. Verify Istio port exclusion annotations
4. Check DNS resolution for `clusterset.local` domain

#### Issue: SSL/TLS Errors

**Symptoms:**
```
SSLException: Unsupported or unrecognized SSL message
```

**Cause:** Istio mTLS wrapping LDAP traffic

**Solution:**
1. Add port exclusion annotations to pod spec
2. Configure PeerAuthentication with DISABLE on LDAP ports
3. Configure DestinationRule with tls.mode: DISABLE

#### Issue: Pod CrashLoopBackOff

**Diagnosis:**
```bash
# Check pod events
kubectl describe pod pingdirectory-0 -n ping-iam

# Check previous logs
kubectl logs pingdirectory-0 -n ping-iam --previous

# Check resource usage
kubectl top pod pingdirectory-0 -n ping-iam
```

**Common Causes:**
- Insufficient memory (increase limits)
- Persistent volume issues
- Init container failures
- Readiness probe timeout

### 12.2 Diagnostic Commands Reference

```bash
# Cluster connectivity
gcloud container fleet memberships list

# MCS status
gcloud container fleet multi-cluster-services describe

# ServiceExports
kubectl get serviceexports -A

# ServiceImports (auto-created by MCS)
kubectl get serviceimports -A

# Istio configuration
kubectl get peerauthentication,destinationrule,serviceentry -n ping-iam

# Pod sidecar status
kubectl get pods -n ping-iam -o jsonpath='{.items[*].spec.containers[*].name}'
```

---

## 13. Appendix

### 13.1 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `PD_CLUSTER_NAME` | Cluster identifier for replication | `gke-asia` |
| `K8S_CLUSTERS` | Comma-separated list of all clusters | `gke-asia,gke-europe` |
| `K8S_CLUSTER` | Current cluster name | `gke-asia` |
| `K8S_SEED_CLUSTER` | Seed cluster for initial data | `gke-asia` |
| `REPLICATION_PORT` | Replication protocol port | `8989` |
| `LDAPS_PORT` | LDAP over TLS port | `1636` |
| `LDAP_PORT` | Plain LDAP port | `1389` |

### 13.2 Port Reference

| Port | Protocol | Purpose | Istio Handling |
|------|----------|---------|----------------|
| 1389 | LDAP | Directory queries | Excluded |
| 1636 | LDAPS | Secure directory queries | Excluded |
| 1443 | HTTPS | Admin API | Proxied |
| 8989 | TCP | Replication | Excluded |
| 9999 | HTTPS | PingFederate Admin | Proxied |
| 9031 | HTTPS | PingFederate Runtime | Proxied |
| 9000 | HTTPS | PingAccess Admin | Proxied |
| 3000 | HTTPS | PingAccess Runtime | Proxied |

### 13.3 File Structure

```
miniiam-ping-gke-multicluster/
├── k8s/
│   ├── base/
│   │   ├── ping-devops-values.yaml      # Base Helm values
│   │   ├── istio-pingdirectory.yaml     # Istio traffic config
│   │   └── kiali-config.yaml            # Kiali dashboard config
│   └── overlays/
│       ├── gke-asia/
│       │   └── values-pingdirectory.yaml # Asia-specific values
│       └── gke-europe/
│           └── values-pingdirectory.yaml # Europe-specific values
└── docs/
    └── GKE-MultiCluster-PingDirectory-Technical-Guide.md
```

### 13.4 Quick Reference Commands

```bash
# Check cluster status
kubectl get pods -n ping-iam --context=gke_bold-lantern-480305-k3_asia-southeast1_gke-asia
kubectl get pods -n ping-iam --context=gke_bold-lantern-480305-k3_europe-west1_gke-europe

# Check replication
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt

# Check MCS
gcloud container fleet multi-cluster-services describe --project=bold-lantern-480305-k3

# Check ServiceExports
kubectl get serviceexports -n ping-iam

# Test LDAP
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch -h localhost -p 1636 -Z -X \
  -D "cn=administrator" -w "2FederateM0re" -b "dc=example,dc=com" "(objectClass=*)" dn
```

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Feb 2026 | Platform Team | Initial release |

---

**End of Document**