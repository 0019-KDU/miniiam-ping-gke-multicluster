# Ping Identity Stack - Component Integration Guide

## Overview

This document explains how the Ping Identity components work together in a multi-cluster GKE environment.

---

## Component Stack

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PING IDENTITY STACK                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  PingAccess     │    │  PingFederate   │    │  PingDirectory  │         │
│  │  (API Gateway)  │───▶│  (OIDC/OAuth)   │───▶│  (LDAP Store)   │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│         │                                                                    │
│         ▼                                                                    │
│  ┌─────────────────┐    ┌─────────────────┐                                 │
│  │  React App      │    │  Backend API    │                                 │
│  │  (Frontend)     │    │  (REST API)     │                                 │
│  └─────────────────┘    └─────────────────┘                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. PingDirectory

### Purpose
- **LDAP Directory Server** - Stores user identities, credentials, and attributes
- **Multi-Master Replication** - Data synchronized across clusters

### Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 1389 | LDAP | Unencrypted directory access |
| 1636 | LDAPS | TLS-encrypted directory access |
| 1443 | HTTPS | Admin console |
| 8989 | TCP | Replication traffic |

### Key Features
- Base DN: `dc=example,dc=com`
- Multi-region replication between gke-asia and gke-europe
- Stores user passwords, attributes, group memberships

### Integration Points
```
PingFederate ──LDAPS (1636)──▶ PingDirectory
                              │
                              ├── Authenticate users
                              ├── Lookup user attributes
                              └── Get group memberships
```

---

## 2. PingFederate

### Purpose
- **Identity Provider (IdP)** - OIDC/OAuth 2.0 authentication server
- **Federation Hub** - SSO across applications

### Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 9031 | HTTPS | Runtime engine (OIDC endpoints) |
| 9999 | HTTPS | Admin console |
| 7600 | TCP | Cluster replication |
| 7700 | TCP | Cluster replication |

### Key Endpoints
| Path | Purpose |
|------|---------|
| `/.well-known/openid-configuration` | OIDC discovery document |
| `/as/authorization.oauth2` | OAuth authorization endpoint |
| `/as/token.oauth2` | OAuth token endpoint |
| `/pf/JWKS` | JSON Web Key Set |
| `/idp/userinfo.openid` | User info endpoint |

### Integration Points
```
User Browser ──▶ PingFederate ──LDAPS──▶ PingDirectory
                      │
                      ├── Issue ID Token (JWT)
                      ├── Issue Access Token
                      └── Issue Refresh Token
                      │
                      ▼
               PingAccess (validates tokens)
```

### Admin vs Engine
| Component | Cluster | Purpose |
|-----------|---------|---------|
| **Admin** | gke-asia only | Configuration management, UI |
| **Engine** | Both clusters | Runtime token issuance |

---

## 3. PingAccess

### Purpose
- **API Gateway** - Protects applications with policy-based access control
- **Reverse Proxy** - Routes authenticated requests to backends
- **Session Management** - Maintains user sessions

### Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 3000 | HTTPS | Runtime engine (proxy) |
| 9000 | HTTPS | Admin console |

### Key Features
- Policy enforcement (who can access what)
- Token validation with PingFederate
- Header injection (user identity to backends)
- Session cookie management

### Integration Points
```
User Browser ──▶ PingAccess ──▶ Backend Applications
                     │
                     ├── Validate session/token
                     ├── Enforce access policies
                     ├── Inject user headers
                     │   • X-Forwarded-User
                     │   • X-Forwarded-Email
                     │   • X-Forwarded-Groups
                     └── Route to backend
```

### Admin vs Engine
| Component | Cluster | Purpose |
|-----------|---------|---------|
| **Admin** | gke-asia only | Configuration management, UI |
| **Engine** | Both clusters | Runtime request processing |

---

## 4. React App (Frontend)

### Purpose
- **Single Page Application** - User-facing web interface
- Protected by PingAccess

### Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 80 | HTTP | Web server (nginx) |

### Integration
- Served through PingAccess reverse proxy
- Receives user identity via injected headers
- Calls Backend API for data

---

## 5. Backend API

### Purpose
- **REST API Server** - Business logic and data access
- Protected by PingAccess

### Ports
| Port | Protocol | Purpose |
|------|----------|---------|
| 8080 | HTTP | REST API endpoints |

### Integration
- Receives requests through PingAccess
- Validates user identity from headers or JWT
- Can validate tokens directly with PingFederate JWKS

---

## Complete Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE AUTHENTICATION FLOW                           │
└──────────────────────────────────────────────────────────────────────────────┘

1. User visits https://app.example.com/
        │
        ▼
2. GKE Gateway routes to PingAccess Engine (port 3000)
        │
        ▼
3. PingAccess checks for valid session cookie
        │
   ┌────┴────┐
   │         │
   ▼         ▼
4a. NO SESSION              4b. VALID SESSION
    │                            │
    ▼                            │
5a. Redirect to PingFederate     │
    /as/authorization.oauth2     │
    │                            │
    ▼                            │
6a. PingFederate shows           │
    login page                   │
    │                            │
    ▼                            │
7a. User enters credentials      │
    │                            │
    ▼                            │
8a. PingFederate validates       │
    against PingDirectory        │
    (LDAPS port 1636)            │
    │                            │
    ▼                            │
9a. PingDirectory returns        │
    user + attributes            │
    │                            │
    ▼                            │
10a. PingFederate issues         │
     tokens (ID, Access,         │
     Refresh)                    │
     │                           │
     ▼                           │
11a. Redirect back to            │
     PingAccess with             │
     authorization code          │
     │                           │
     ▼                           │
12a. PingAccess exchanges        │
     code for tokens             │
     │                           │
     ▼                           │
13a. PingAccess creates          │
     session cookie              │
     │                           │
     └─────────┬─────────────────┘
               │
               ▼
14. PingAccess injects headers:
    • X-Forwarded-User: john.doe
    • X-Forwarded-Email: john@example.com
    • X-Forwarded-Groups: admin,users
               │
               ▼
15. Route to destination:
    • / → React App (port 80)
    • /api/* → Backend API (port 8080)
               │
               ▼
16. Application processes request
    with user context
               │
               ▼
17. Response returned to user
```

---

## Multi-Cluster Topology

```
┌─────────────────────────────────┐        ┌─────────────────────────────────┐
│         GKE-ASIA (Primary)      │        │       GKE-EUROPE (Secondary)    │
│                                 │        │                                 │
│  ┌───────────────────────────┐  │        │  ┌───────────────────────────┐  │
│  │     PingDirectory         │  │  LDAP  │  │     PingDirectory         │  │
│  │     (SEED)                │◀─┼────────┼─▶│     (REPLICA)             │  │
│  │     3 entries             │  │  REPL  │  │     3 entries             │  │
│  └───────────────────────────┘  │        │  └───────────────────────────┘  │
│                                 │        │                                 │
│  ┌───────────────────────────┐  │        │  ┌───────────────────────────┐  │
│  │  PingFederate Admin       │  │        │  │  (No Admin)               │  │
│  │  + Engine                 │◀─┼────────┼──│  PingFederate Engine      │  │
│  └───────────────────────────┘  │  MCS   │  └───────────────────────────┘  │
│                                 │        │                                 │
│  ┌───────────────────────────┐  │        │  ┌───────────────────────────┐  │
│  │  PingAccess Admin         │  │        │  │  (No Admin)               │  │
│  │  + Engine                 │◀─┼────────┼──│  PingAccess Engine        │  │
│  └───────────────────────────┘  │  MCS   │  └───────────────────────────┘  │
│                                 │        │                                 │
│  ┌───────────────────────────┐  │        │  ┌───────────────────────────┐  │
│  │  React App + Backend API  │  │        │  │  React App + Backend API  │  │
│  └───────────────────────────┘  │        │  └───────────────────────────┘  │
│                                 │        │                                 │
└─────────────────────────────────┘        └─────────────────────────────────┘

Legend:
  LDAP REPL = PingDirectory replication (ports 1636, 8989)
  MCS = Multi-Cluster Services (clusterset.local DNS)
```

---

## Configuration Files

| Component | Helm Values | Description |
|-----------|-------------|-------------|
| PingDirectory | `values-pingdirectory.yaml` | Directory server config |
| Full Stack | `values-ping-full.yaml` | All components together |
| Cross-Cluster | `cross-cluster-services.yaml` | ExternalName services |

---

## Health Check Endpoints

| Component | Endpoint | Expected Response |
|-----------|----------|-------------------|
| PingDirectory | LDAP bind on 1636 | Successful bind |
| PingFederate | `/pf/heartbeat.ping` | `OK` |
| PingAccess | `/pa/heartbeat.ping` | `OK` |
| React App | `/health` | HTTP 200 |
| Backend API | `/health` | HTTP 200 |

---

## Default Credentials

| Component | Username | Password |
|-----------|----------|----------|
| PingFederate Admin | `administrator` | `2FederateM0re` |
| PingAccess Admin | `administrator` | `2FederateM0re` |
| PingDirectory Admin | `admin` | From secret |
| LDAP Users | `user.0` - `user.9` | `password` |
