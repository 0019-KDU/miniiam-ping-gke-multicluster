# 🔐 Ping Identity IAM Lab

> **Enterprise-Grade Identity & Access Management** using Ping Identity Docker images with React + Node.js demo application

[![PingDirectory](https://img.shields.io/badge/PingDirectory-11.0-blue)](https://hub.docker.com/r/pingidentity/pingdirectory)
[![PingFederate](https://img.shields.io/badge/PingFederate-Latest-green)](https://hub.docker.com/r/pingidentity/pingfederate)
[![PingAccess](https://img.shields.io/badge/PingAccess-Latest-orange)](https://hub.docker.com/r/pingidentity/pingaccess)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED)](https://docker.com)

---

## 🏗️ Architecture Overview

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                                                                              ║
║                         🌐 PING IDENTITY IAM LAB - ARCHITECTURE                              ║
║                                                                                              ║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                              ║
║     ┌─────────────┐                                                                          ║
║     │   🌐        │                                                                          ║
║     │   Browser   │                                                                          ║
║     │   (User)    │                                                                          ║
║     └──────┬──────┘                                                                          ║
║            │                                                                                 ║
║            │ HTTP Request                                                                    ║
║            ▼                                                                                 ║
║     ╔═══════════════════════════════════════════════════════════════════╗                    ║
║     ║                    🛡️  PINGACCESS                                  ║                    ║
║     ║                   Policy Enforcement Point                        ║                    ║
║     ║                                                                   ║                    ║
║     ║   📍 Admin Console:  https://143.198.224.95:9000                  ║                    ║
║     ║   📍 Runtime Engine: http://143.198.224.95:3000                   ║                    ║
║     ║                                                                   ║                    ║
║     ║   ┌─────────────────────────────────────────────────────────────┐ ║                    ║
║     ║   │  ✓ Intercepts ALL incoming requests                         │ ║                    ║
║     ║   │  ✓ Checks for valid session/token                           │ ║                    ║
║     ║   │  ✓ Enforces URL-based access policies                       │ ║                    ║
║     ║   │  ✓ Injects identity headers (X-Forwarded-User, etc.)        │ ║                    ║
║     ║   └─────────────────────────────────────────────────────────────┘ ║                    ║
║     ╚════════════════════════╤══════════════════════╤═══════════════════╝                    ║
║                              │                      │                                        ║
║          ┌───────────────────┘                      └───────────────────┐                    ║
║          │                                                              │                    ║
║          │  🔴 No Valid Session                         🟢 Valid Token  │                    ║
║          │  (Redirect to IdP)                          (Pass Through)   │                    ║
║          ▼                                                              ▼                    ║
║   ╔═════════════════════════════════╗              ╔════════════════════════════════════╗    ║
║   ║      🔑 PINGFEDERATE            ║              ║        🖥️  APPLICATIONS             ║    ║
║   ║     Identity Provider (IdP)     ║              ║                                    ║    ║
║   ║                                 ║              ║   ┌────────────────────────────┐   ║    ║
║   ║  📍 Admin: https://..:9999      ║              ║   │     ⚛️  React App           │   ║    ║
║   ║  📍 Engine: https://..:9031     ║              ║   │     http://..:5173         │   ║    ║
║   ║                                 ║              ║   │                            │   ║    ║
║   ║  ┌───────────────────────────┐  ║              ║   │  • Dashboard               │   ║    ║
║   ║  │  OIDC/OAuth 2.0 Server    │  ║              ║   │  • Profile Page            │   ║    ║
║   ║  │                           │  ║   Tokens     ║   │  • Token Inspector         │   ║    ║
║   ║  │  • Authorization Code     │◄─╬────────────►─╬──►│  • Protected Routes        │   ║    ║
║   ║  │  • PKCE Support           │  ║              ║   │  • Admin/DevOps Pages      │   ║    ║
║   ║  │  • ID Token + Access Token│  ║              ║   └────────────────────────────┘   ║    ║
║   ║  │  • Token Refresh          │  ║              ║                 │                  ║    ║
║   ║  │  • Single Sign-On (SSO)   │  ║              ║                 │ API Calls        ║    ║
║   ║  └─────────────┬─────────────┘  ║              ║                 ▼                  ║    ║
║   ╚════════════════╪════════════════╝              ║   ┌────────────────────────────┐   ║    ║
║                    │                               ║   │     📡 Backend API         │   ║    ║
║                    │ LDAP Bind                     ║   │     http://..:8080         │   ║    ║
║                    │ (Authenticate)                ║   │                            │   ║    ║
║                    ▼                               ║   │  • JWT Validation          │   ║    ║
║   ╔═════════════════════════════════╗              ║   │  • /api/whoami             │   ║    ║
║   ║      📁 PINGDIRECTORY           ║              ║   │  • /api/protected          │   ║    ║
║   ║        LDAP User Store          ║              ║   │  • /api/admin (RBAC)       │   ║    ║
║   ║                                 ║              ║   │  • /api/devops (RBAC)      │   ║    ║
║   ║  📍 LDAP:  ldap://..:1389       ║              ║   └────────────────────────────┘   ║    ║
║   ║  📍 LDAPS: ldaps://..:1636      ║              ╚════════════════════════════════════╝    ║
║   ║  📍 HTTPS: https://..:1443      ║                                                        ║
║   ║                                 ║                                                        ║
║   ║  ┌───────────────────────────┐  ║              ╔════════════════════════════════════╗    ║
║   ║  │  dc=example,dc=com        │  ║              ║         👥 DEMO USERS              ║    ║
║   ║  │  ├── ou=People            │  ║              ╠════════════════════════════════════╣    ║
║   ║  │  │   ├── abishek (admin)  │  ║              ║  User     │ Password    │ Roles    ║    ║
║   ║  │  │   ├── john (devops)    │  ║              ║  ─────────┼─────────────┼───────── ║    ║
║   ║  │  │   ├── sarah (admin)    │  ║              ║  abishek  │ Password123!│ admin,   ║    ║
║   ║  │  │   └── guest            │  ║              ║           │             │ devops   ║    ║
║   ║  │  └── ou=Groups            │  ║              ║  john     │ Password123!│ devops   ║    ║
║   ║  │      ├── admin            │  ║              ║  sarah    │ Password123!│ admin    ║    ║
║   ║  │      ├── devops           │  ║              ║  guest    │ Password123!│ (none)   ║    ║
║   ║  │      └── users            │  ║              ╚════════════════════════════════════╝    ║
║   ║  └───────────────────────────┘  ║                                                        ║
║   ╚═════════════════════════════════╝                                                        ║
║                                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🔄 Authentication Flow

```
╔══════════════════════════════════════════════════════════════════════════════════════════════╗
║                                  🔄 AUTHENTICATION FLOW                                      ║
╠══════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                              ║
║   1️⃣  User visits React App → PingAccess intercepts                                          ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   2️⃣  PingAccess: No session → Redirect to PingFederate /authorize                           ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   3️⃣  PingFederate: Display HTML Login Form                                                  ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   4️⃣  User enters credentials → PingFederate validates via PingDirectory (LDAP Bind)        ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   5️⃣  PingFederate: Issues Authorization Code → Redirect to callback                         ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   6️⃣  PingAccess: Exchange code for ID Token + Access Token (JWT)                            ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   7️⃣  PingAccess: Validates token, creates session, injects headers                          ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   8️⃣  Request forwarded to React App with identity headers                                   ║
║                     │                                                                        ║
║                     ▼                                                                        ║
║   9️⃣  React App calls Backend API with Authorization header → JWT validated → Data returned  ║
║                                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

## 🔀 Sequence Diagram

```
┌─────────┐     ┌────────────┐     ┌──────────────┐     ┌───────────────┐     ┌─────────┐
│ Browser │     │ PingAccess │     │ PingFederate │     │ PingDirectory │     │   App   │
└────┬────┘     └──────┬─────┘     └──────┬───────┘     └───────┬───────┘     └────┬────┘
     │                 │                  │                     │                  │
     │  GET /app       │                  │                     │                  │
     │────────────────►│                  │                     │                  │
     │                 │                  │                     │                  │
     │                 │ No session       │                     │                  │
     │◄────────────────│ 302 Redirect     │                     │                  │
     │                 │                  │                     │                  │
     │  GET /authorize │                  │                     │                  │
     │─────────────────┼─────────────────►│                     │                  │
     │                 │                  │                     │                  │
     │                 │                  │  Login Form         │                  │
     │◄────────────────┼──────────────────│                     │                  │
     │                 │                  │                     │                  │
     │  POST credentials                  │                     │                  │
     │─────────────────┼─────────────────►│                     │                  │
     │                 │                  │                     │                  │
     │                 │                  │  LDAP Bind          │                  │
     │                 │                  │────────────────────►│                  │
     │                 │                  │                     │                  │
     │                 │                  │  Success + User DN  │                  │
     │                 │                  │◄────────────────────│                  │
     │                 │                  │                     │                  │
     │                 │  Auth Code       │                     │                  │
     │◄────────────────┼──────────────────│                     │                  │
     │                 │                  │                     │                  │
     │  GET /callback  │                  │                     │                  │
     │────────────────►│                  │                     │                  │
     │                 │                  │                     │                  │
     │                 │  Exchange code   │                     │                  │
     │                 │─────────────────►│                     │                  │
     │                 │                  │                     │                  │
     │                 │  ID + Access     │                     │                  │
     │                 │◄─────────────────│                     │                  │
     │                 │                  │                     │                  │
     │                 │  Create Session + Inject Headers       │                  │
     │                 │──────────────────┼─────────────────────┼─────────────────►│
     │                 │                  │                     │                  │
     │                 │                  │                     │     App Response │
     │◄────────────────┼──────────────────┼─────────────────────┼──────────────────│
     │                 │                  │                     │                  │
```

---

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- [Ping Identity DevOps credentials](https://devops.pingidentity.com/get-started/devopsRegistration/)

### 1. Clone & Configure

```bash
git clone <repository>
cd ping-iam-lab
```

### 2. Create Environment File

```bash
cat > .env << 'EOF'
PING_IDENTITY_ACCEPT_EULA=YES
PING_IDENTITY_DEVOPS_USER=your-email@example.com
PING_IDENTITY_DEVOPS_KEY=your-devops-key
EOF
```

### 3. Start Services

```bash
docker-compose up -d
```

### 4. Wait for Healthy Status

```bash
# Watch startup progress
docker-compose logs -f

# Check status (all should show "healthy")
docker ps
```

> ⏱️ **Note:** First startup takes ~3-5 minutes (PingDirectory needs to initialize)

---

## 🌐 Service Endpoints

| Service | URL | Credentials |
|---------|-----|-------------|
| **React App** | http://143.198.224.95:5173 | - |
| **PingFederate Admin** | https://143.198.224.95:9999/pingfederate/app | administrator / PingFederate123! |
| **PingAccess Admin** | https://143.198.224.95:9000 | administrator / PingAccess123! |
| **PingDirectory LDAPS** | ldaps://143.198.224.95:1636 | cn=administrator / 2FederateM0re |
| **Backend API Health** | http://143.198.224.95:8080/health | - |

> ⚠️ Accept self-signed certificate warnings in browser

---

## ⚙️ PingFederate Initial Setup

When you first access PingFederate Admin Console, complete the setup wizard:

### Step 1: Base URL
```
https://143.198.224.95:9031
```

### Step 2-5: Complete Remaining Steps
Follow the wizard prompts for administrator, license, and finish.

---

## 🔧 Post-Setup Configuration

### 1. Configure LDAP Data Store

Navigate to: **System → Data Stores → Add New Data Store**

| Field | Value |
|-------|-------|
| Type | LDAP |
| Name | PingDirectory |
| Hostname | `pingdirectory` |
| Port | `1636` |
| Use SSL | ✅ Yes |
| User DN | `cn=administrator` |
| Password | `2FederateM0re` |
| Base DN | `dc=example,dc=com` |

### 2. Create Password Credential Validator

Navigate to: **Authentication → Password Credential Validators → Create New Instance**

| Field | Value |
|-------|-------|
| Instance Name | LDAP PCV |
| Type | LDAP Username Password Credential Validator |
| LDAP Datastore | PingDirectory |
| Search Base | `ou=People,dc=example,dc=com` |
| Search Filter | `(uid=${username})` |

### 3. Create HTML Form Adapter

Navigate to: **Authentication → IdP Adapters → Create New Instance**

- Select **HTML Form IdP Adapter**
- Connect to LDAP PCV created above

### 4. Create OAuth/OIDC Client

Navigate to: **Applications → OAuth → Clients → Add Client**

| Field | Value |
|-------|-------|
| Client ID | `react-app` |
| Client Secret | `react-app-secret` |
| Name | React Application |
| Redirect URIs | `http://143.198.224.95:5173/callback` |
| Allowed Grant Types | Authorization Code, Refresh Token |
| PKCE | Required |

---

## 🧪 Testing Commands

### Test LDAP Connection
```bash
docker exec pingdirectory ldapsearch \
  -b "dc=example,dc=com" \
  -D "cn=administrator" \
  -w "2FederateM0re" \
  "(objectClass=inetOrgPerson)" \
  uid cn mail memberOf
```

### Test Service Health
```bash
# PingFederate
curl -k https://143.198.224.95:9031/pf/heartbeat.ping

# Backend API
curl http://143.198.224.95:8080/health

# React App
curl http://143.198.224.95:5173
```

---

## 📁 Project Structure

```
ping-iam-lab/
├── 📄 docker-compose.yml       # Service orchestration
├── 📄 .env                     # Environment variables
├── 📄 README.md                # Documentation
│
├── 📂 react-app/               # ⚛️ Frontend Application
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── pages/              # Home, Profile, Token, Admin, DevOps
│       ├── components/         # Navbar, ProtectedRoute
│       └── context/            # AuthContext
│
├── 📂 backend-api/             # 📡 Backend API Service
│   ├── Dockerfile
│   ├── package.json
│   └── src/server.js           # Express + JWT validation
│
└── 📂 pd-profile/              # 📁 PingDirectory Config
    └── ldif/
        ├── 01-base.ldif        # Base DN
        ├── 02-users.ldif       # Demo users
        └── 03-groups.ldif      # Groups/Roles
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|---------------|
| **Authentication** | OIDC/OAuth 2.0 via PingFederate |
| **Authorization** | URL-based policies via PingAccess |
| **RBAC** | LDAP groups mapped to JWT claims |
| **Token Validation** | JWT signature verification (jose) |
| **Session Management** | PingAccess session tokens |
| **PKCE** | Required for public clients |
| **TLS/SSL** | Self-signed certs (dev mode) |

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# View logs (all services)
docker-compose logs -f

# View specific service logs
docker logs -f pingfederate

# Stop all services
docker-compose down

# Rebuild specific service
docker-compose up -d --build react-app

# Fresh start (remove volumes)
docker-compose down -v

# Check container health
docker ps

# Shell into container
docker exec -it pingdirectory /bin/sh
```

---

## 🛠️ Troubleshooting

### Container stuck starting
```bash
docker logs pingdirectory --tail 100
docker inspect pingdirectory --format='{{json .State.Health}}'
```

### LDAP connection issues
```bash
# Test from within Docker network
docker exec pingfederate ldapsearch \
  -h pingdirectory -p 1636 -Z \
  -D "cn=administrator" -w "2FederateM0re" \
  -b "dc=example,dc=com" "(objectClass=*)"
```

### Reset everything
```bash
docker-compose down -v
docker-compose up -d
```

---

## 📚 References

- [Ping Identity DevOps](https://devops.pingidentity.com/)
- [PingDirectory Docker](https://hub.docker.com/r/pingidentity/pingdirectory)
- [PingFederate Docker](https://hub.docker.com/r/pingidentity/pingfederate)
- [PingAccess Docker](https://hub.docker.com/r/pingidentity/pingaccess)
- [OAuth 2.0 Specification](https://oauth.net/2/)
- [OpenID Connect](https://openid.net/connect/)

---

## 📄 License

This lab is for educational and development purposes. Ping Identity products require proper licensing for production use.

---

<div align="center">

**🔐 Built with ❤️ for IAM Learning**

*Ping Identity • OIDC • OAuth 2.0 • LDAP • React • Node.js*

</div>
