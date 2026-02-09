# Command Reference Guide

## Overview

This document contains all kubectl commands for deploying, managing, and troubleshooting the Ping IAM multi-cluster environment.

---

## Cluster Context Commands

### Switch Contexts
```bash
# Switch to gke-asia (primary)
kubectl config use-context gke-asia

# Switch to gke-europe (secondary)
kubectl config use-context gke-europe

# View current context
kubectl config current-context

# List all contexts
kubectl config get-contexts
```

---

## Deployment Commands by YAML File

### 1. namespace.yaml
```bash
# Apply namespace
kubectl apply -f k8s/base/namespace.yaml

# Verify namespace
kubectl get namespace ping-iam

# Delete namespace (CAUTION: deletes everything in namespace)
kubectl delete -f k8s/base/namespace.yaml
```

### 2. devops-secret.yaml
```bash
# Apply secret
kubectl apply -f k8s/base/devops-secret.yaml

# Verify secret
kubectl get secret devops-secret -n ping-iam

# View secret details (base64 encoded)
kubectl get secret devops-secret -n ping-iam -o yaml

# Delete secret
kubectl delete -f k8s/base/devops-secret.yaml
```

### 3. service-export.yaml
```bash
# Apply to BOTH clusters
kubectl config use-context gke-asia
kubectl apply -f k8s/base/service-export.yaml

kubectl config use-context gke-europe
kubectl apply -f k8s/base/service-export.yaml

# Verify ServiceExports
kubectl get serviceexport -n ping-iam

# Verify ServiceImports (auto-created by MCS)
kubectl get serviceimport -n ping-iam

# Delete ServiceExports
kubectl delete -f k8s/base/service-export.yaml
```

### 4. istio-config.yaml
```bash
# Apply to BOTH clusters
kubectl config use-context gke-asia
kubectl apply -f k8s/base/istio-config.yaml

kubectl config use-context gke-europe
kubectl apply -f k8s/base/istio-config.yaml

# Verify PeerAuthentication
kubectl get peerauthentication -n ping-iam

# Verify DestinationRules
kubectl get destinationrule -n ping-iam

# Verify ServiceEntries
kubectl get serviceentry -n ping-iam

# Delete Istio config
kubectl delete -f k8s/base/istio-config.yaml
```

### 5. gateway.yaml
```bash
# Apply to gke-asia ONLY (config cluster)
kubectl config use-context gke-asia
kubectl apply -f k8s/base/gateway.yaml

# Verify Gateway
kubectl get gateway -n ping-iam

# Verify HTTPRoutes
kubectl get httproute -n ping-iam

# Verify HealthCheckPolicy
kubectl get healthcheckpolicy -n ping-iam

# Verify GCPBackendPolicy
kubectl get gcpbackendpolicy -n ping-iam

# Get Gateway details
kubectl describe gateway ping-iam-gateway -n ping-iam

# Delete Gateway
kubectl delete -f k8s/base/gateway.yaml
```

### 6. backend-api.yaml
```bash
# Apply to BOTH clusters
kubectl apply -f k8s/base/backend-api.yaml

# Verify deployment
kubectl get deployment backend-api -n ping-iam
kubectl get pods -n ping-iam -l app=backend-api
kubectl get svc backend-api -n ping-iam

# Check logs
kubectl logs -l app=backend-api -n ping-iam

# Delete
kubectl delete -f k8s/base/backend-api.yaml
```

### 7. react-app.yaml
```bash
# Apply to BOTH clusters
kubectl apply -f k8s/base/react-app.yaml

# Verify deployment
kubectl get deployment react-app -n ping-iam
kubectl get pods -n ping-iam -l app=react-app
kubectl get svc react-app -n ping-iam

# Check logs
kubectl logs -l app=react-app -n ping-iam

# Delete
kubectl delete -f k8s/base/react-app.yaml
```

### 8. values-ping-full.yaml (Helm)
```bash
# Deploy to gke-asia (full stack with admins)
kubectl config use-context gke-asia
helm upgrade --install pingdirectory pingidentity/ping-devops \
  -f k8s/overlays/gke-asia/values-ping-full.yaml \
  -n ping-iam

# Deploy to gke-europe (engines only, no admins)
kubectl config use-context gke-europe
helm upgrade --install pingdirectory pingidentity/ping-devops \
  -f k8s/overlays/gke-europe/values-ping-full.yaml \
  -n ping-iam

# Check Helm releases
helm list -n ping-iam

# Uninstall
helm uninstall pingdirectory -n ping-iam
```

### 9. cross-cluster-services.yaml
```bash
# Apply to gke-europe ONLY
kubectl config use-context gke-europe
kubectl apply -f k8s/overlays/gke-europe/cross-cluster-services.yaml

# Verify ExternalName services
kubectl get svc -n ping-iam | grep ExternalName

# Delete
kubectl delete -f k8s/overlays/gke-europe/cross-cluster-services.yaml
```

---

## Monitoring Commands

### Check All Pods
```bash
# All pods in namespace
kubectl get pods -n ping-iam -o wide

# Watch pods (live updates)
kubectl get pods -n ping-iam -w

# Pods with labels
kubectl get pods -n ping-iam --show-labels
```

### Check Specific Components
```bash
# PingDirectory
kubectl get pods -n ping-iam -l app.kubernetes.io/name=pingdirectory

# PingFederate
kubectl get pods -n ping-iam -l app.kubernetes.io/name=pingfederate-admin
kubectl get pods -n ping-iam -l app.kubernetes.io/name=pingfederate-engine

# PingAccess
kubectl get pods -n ping-iam -l app.kubernetes.io/name=pingaccess-admin
kubectl get pods -n ping-iam -l app.kubernetes.io/name=pingaccess-engine
```

### Check Services
```bash
# All services
kubectl get svc -n ping-iam

# Service details
kubectl describe svc pingaccess-engine -n ping-iam
```

### Check Replication Status
```bash
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt
```

---

## Troubleshooting Commands

### Pod Logs
```bash
# Current logs
kubectl logs <pod-name> -n ping-iam

# Previous container logs (after restart)
kubectl logs <pod-name> -n ping-iam --previous

# Follow logs
kubectl logs -f <pod-name> -n ping-iam

# Logs from specific container (multi-container pod)
kubectl logs <pod-name> -n ping-iam -c pingdirectory
kubectl logs <pod-name> -n ping-iam -c istio-proxy
```

### Pod Details
```bash
# Describe pod (events, status)
kubectl describe pod <pod-name> -n ping-iam

# Get pod YAML
kubectl get pod <pod-name> -n ping-iam -o yaml
```

### Exec into Pod
```bash
# Bash shell
kubectl exec -it <pod-name> -n ping-iam -- /bin/bash

# Specific container
kubectl exec -it <pod-name> -n ping-iam -c pingdirectory -- /bin/bash

# Run command
kubectl exec <pod-name> -n ping-iam -- ls -la /opt
```

### Debug Network
```bash
# DNS lookup
kubectl exec -it <pod-name> -n ping-iam -- nslookup pingdirectory.ping-iam.svc.cluster.local

# Curl endpoint
kubectl exec -it <pod-name> -n ping-iam -- curl -k https://pingfederate-engine:9031/pf/heartbeat.ping

# Check connectivity
kubectl exec -it <pod-name> -n ping-iam -- nc -zv pingdirectory 1636
```

### Istio Debug
```bash
# Istio proxy status
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET clusters

# Envoy config dump
kubectl exec <pod-name> -n ping-iam -c istio-proxy -- pilot-agent request GET config_dump
```

---

## Port Forward Commands

### Admin Consoles
```bash
# PingFederate Admin (Port 9999)
kubectl port-forward svc/pingfederate-admin 9999:9999 -n ping-iam

# PingAccess Admin (Port 9000)
kubectl port-forward svc/pingaccess-admin 9000:9000 -n ping-iam

# PingDirectory Admin (Port 1443)
kubectl port-forward svc/pingdirectory 1443:1443 -n ping-iam
```

### Runtime Engines
```bash
# PingFederate Engine (Port 9031)
kubectl port-forward svc/pingfederate-engine 9031:9031 -n ping-iam

# PingAccess Engine (Port 3000)
kubectl port-forward svc/pingaccess-engine 3000:3000 -n ping-iam
```

### Applications
```bash
# React App (Port 80)
kubectl port-forward svc/react-app 8080:80 -n ping-iam

# Backend API (Port 8080)
kubectl port-forward svc/backend-api 8081:8080 -n ping-iam
```

---

## GCP Commands

### Gateway Health
```bash
# List health checks
gcloud compute health-checks list --filter="name~ping"

# Check backend health
gcloud compute backend-services get-health <backend-name> --global

# Describe backend service
gcloud compute backend-services describe <backend-name> --global
```

### MCS Commands
```bash
# List memberships
gcloud container fleet memberships list

# Describe membership
gcloud container fleet memberships describe gke-asia

# Check MCS status
gcloud container fleet multi-cluster-services describe
```

---

## Complete Deployment Sequence

### Initial Setup (Both Clusters)
```bash
# 1. Create namespace
kubectl apply -f k8s/base/namespace.yaml

# 2. Apply secret
kubectl apply -f k8s/base/devops-secret.yaml

# 3. Apply Istio config
kubectl apply -f k8s/base/istio-config.yaml

# 4. Apply ServiceExports
kubectl apply -f k8s/base/service-export.yaml
```

### Deploy to GKE-ASIA (Primary)
```bash
kubectl config use-context gke-asia

# 5. Deploy Ping stack (with admins)
helm upgrade --install pingdirectory pingidentity/ping-devops \
  -f k8s/overlays/gke-asia/values-ping-full.yaml \
  -n ping-iam

# 6. Deploy Gateway
kubectl apply -f k8s/base/gateway.yaml

# 7. Deploy applications
kubectl apply -f k8s/base/backend-api.yaml
kubectl apply -f k8s/base/react-app.yaml
```

### Deploy to GKE-EUROPE (Secondary)
```bash
kubectl config use-context gke-europe

# 8. Deploy Ping stack (engines only)
helm upgrade --install pingdirectory pingidentity/ping-devops \
  -f k8s/overlays/gke-europe/values-ping-full.yaml \
  -n ping-iam

# 9. Apply cross-cluster services
kubectl apply -f k8s/overlays/gke-europe/cross-cluster-services.yaml

# 10. Deploy applications
kubectl apply -f k8s/base/backend-api.yaml
kubectl apply -f k8s/base/react-app.yaml
```

### Verify Deployment
```bash
# Check pods in both clusters
kubectl get pods -n ping-iam --context=gke-asia
kubectl get pods -n ping-iam --context=gke-europe

# Check replication
kubectl exec pingdirectory-0 -n ping-iam --context=gke-asia -- dsreplication status --no-prompt

# Test Gateway
curl http://34.36.200.69/.well-known/openid-configuration
```

---

## Cleanup Commands

### Delete Everything
```bash
# Delete from gke-europe first
kubectl config use-context gke-europe
kubectl delete -f k8s/base/backend-api.yaml
kubectl delete -f k8s/base/react-app.yaml
kubectl delete -f k8s/overlays/gke-europe/cross-cluster-services.yaml
helm uninstall pingdirectory -n ping-iam
kubectl delete -f k8s/base/istio-config.yaml
kubectl delete -f k8s/base/service-export.yaml

# Delete from gke-asia
kubectl config use-context gke-asia
kubectl delete -f k8s/base/gateway.yaml
kubectl delete -f k8s/base/backend-api.yaml
kubectl delete -f k8s/base/react-app.yaml
helm uninstall pingdirectory -n ping-iam
kubectl delete -f k8s/base/istio-config.yaml
kubectl delete -f k8s/base/service-export.yaml
kubectl delete -f k8s/base/devops-secret.yaml
kubectl delete -f k8s/base/namespace.yaml
```
