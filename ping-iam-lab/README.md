# 🔐 Ping IAM Lab

A complete local Identity and Access Management (IAM) lab using **Ping Identity** products with a React application demonstrating enterprise-grade authentication and authorization flows.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PING IAM LAB ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   Browser                                                                       │
│      │                                                                          │
│      ▼                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────┐   │
│   │                    PingAccess (Policy Enforcement Point)                │   │
│   │                         http://localhost:3000                           │   │
│   │                                                                         │   │
│   │  • Intercepts all requests                                              │   │
│   │  • Enforces authentication & authorization policies                     │   │
│   │  • Validates tokens and sessions                                        │   │
│   │  • Injects user identity headers to upstream apps                       │   │
│   └───────────────────────────────────┬─────────────────────────────────────┘   │
│                                       │                                         │
│              ┌────────────────────────┴────────────────────┐                    │
│              │                                             │                    │
│              ▼ (unauthenticated)                           ▼ (authenticated)    │
│   ┌───────────────────────┐                     ┌───────────────────────┐       │
│   │     PingFederate      │                     │      React App        │       │
│   │   (OIDC Provider)     │                     │    (http://react)     │       │
│   │  https://localhost:9031                     │                       │       │
│   │                       │                     │  Backend API          │       │
│   │  • OIDC/OAuth 2.0     │                     │  (http://backend)     │       │
│   │  • HTML Form Login    │                     │                       │       │
│   │  • Token issuance     │                     └───────────────────────┘       │
│   └───────────┬───────────┘                                                     │
│               │                                                                 │
│               ▼ (authenticate user)                                             │
│   ┌───────────────────────┐                                                     │
│   │    PingDirectory      │                                                     │
│   │     (LDAP Store)      │                                                     │
│   │   ldap://localhost:1389                                                     │
│   │                       │                                                     │
│   │  • User accounts      │                                                     │
│   │  • Groups (roles)     │                                                     │
│   │  • Attributes         │                                                     │
│   └───────────────────────┘                                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 📦 Components

| Component | Image | Ports | Purpose |
|-----------|-------|-------|---------|
| PingDirectory | `pingidentity/pingdirectory` | 1389 (LDAP), 1636 (LDAPS), 1443 (HTTPS) | LDAP user store |
| PingFederate | `pingidentity/pingfederate` | 9999 (Admin), 9031 (Runtime) | OIDC/OAuth provider |
| PingAccess | `pingidentity/pingaccess` | 9000 (Admin), 3000 (HTTP), 3443 (HTTPS) | API Gateway/PEP |
| React App | Custom (Vite+TS) | 5173 (direct), via PA:3000 | Frontend application |
| Backend API | Custom (Node/Express) | 8080 | Token validation, user info |

## 🚀 Quick Start

### Prerequisites

1. **Docker & Docker Compose** installed
2. **Ping Identity DevOps credentials** - [Register here](https://devops.pingidentity.com/get-started/devopsRegistration/)

### Step 1: Clone and Configure

```bash
# Navigate to the lab directory
cd ping-iam-lab

# Copy environment template
cp .env.example .env

# Edit .env with your DevOps credentials
# PING_IDENTITY_DEVOPS_USER=your_email@example.com
# PING_IDENTITY_DEVOPS_KEY=your_devops_key
```

### Step 2: Create Secrets

```bash
# Create secrets directory
mkdir -p secrets

# Create password files (use strong passwords in production!)
echo -n "PingDirectory123!" > secrets/pd_root_password.txt
echo -n "PingFederate123!" > secrets/pf_admin_password.txt
echo -n "PingAccess123!" > secrets/pa_admin_password.txt
```

### Step 3: Start the Lab

```bash
# Start all services
docker-compose up -d

# Watch logs (optional)
docker-compose logs -f

# Wait for all services to be healthy (2-5 minutes)
docker-compose ps
```

### Step 4: Verify Services

| Service | URL | Credentials |
|---------|-----|-------------|
| PingFederate Admin | https://localhost:9999/pingfederate/app | administrator / (pf_admin_password) |
| PingAccess Admin | https://localhost:9000 | administrator / (pa_admin_password) |
| React App (via PA) | http://localhost:3000 | - |
| React App (direct) | http://localhost:5173 | - |

---

## 🔧 Configuration Guide

### PingDirectory Setup

PingDirectory is automatically provisioned with the LDIF files in `pd-profile/ldif/`:

#### Pre-created Users

| User | Password | Roles | Purpose |
|------|----------|-------|---------|
| `abishek` | `Password123!` | admin, devops | Full access |
| `john` | `Password123!` | devops | DevOps only |
| `sarah` | `Password123!` | admin | Admin only |
| `guest` | `Password123!` | (none) | Basic user |

#### Verify with ldapsearch

```bash
# List all users
docker exec pingdirectory ldapsearch \
  -D "cn=administrator" \
  -w "PingDirectory123!" \
  -b "ou=People,dc=example,dc=com" \
  "(objectClass=inetOrgPerson)" \
  uid cn mail

# List all groups
docker exec pingdirectory ldapsearch \
  -D "cn=administrator" \
  -w "PingDirectory123!" \
  -b "ou=Groups,dc=example,dc=com" \
  "(objectClass=groupOfNames)" \
  cn member

# Check specific user's groups
docker exec pingdirectory ldapsearch \
  -D "cn=administrator" \
  -w "PingDirectory123!" \
  -b "dc=example,dc=com" \
  "(&(objectClass=groupOfNames)(member=uid=abishek,ou=People,dc=example,dc=com))" \
  cn
```

#### Add a New User

```bash
docker exec -i pingdirectory ldapmodify \
  -D "cn=administrator" \
  -w "PingDirectory123!" << 'EOF'
dn: uid=newuser,ou=People,dc=example,dc=com
changetype: add
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: newuser
cn: New User
sn: User
givenName: New
mail: newuser@example.com
userPassword: Password123!
EOF
```

#### Add User to Group

```bash
docker exec -i pingdirectory ldapmodify \
  -D "cn=administrator" \
  -w "PingDirectory123!" << 'EOF'
dn: cn=devops,ou=Groups,dc=example,dc=com
changetype: modify
add: member
member: uid=newuser,ou=People,dc=example,dc=com
EOF
```

---

### PingFederate Configuration

After PingFederate starts, configure it through the Admin Console:

#### 1. Connect PingDirectory as User Store

1. Go to **System** → **Data Stores** → **Add New Data Store**
2. Select **LDAP**
3. Configure:
   - **Name:** `PingDirectory`
   - **Hostname:** `pingdirectory`
   - **LDAP Port:** `1389`
   - **User DN:** `cn=administrator`
   - **Password:** (from pd_root_password.txt)
   - **Use SSL:** No (within Docker network)

4. Test connection and save

#### 2. Create Password Credential Validator

1. Go to **Authentication** → **Integration** → **Password Credential Validators** → **Create New Instance**
2. Select **LDAP Username Password Credential Validator**
3. Configure:
   - **Instance Name:** `LDAP Validator`
   - **LDAP Datastore:** Select `PingDirectory`
   - **Search Base:** `ou=People,dc=example,dc=com`
   - **Search Filter:** `(uid=${username})`

#### 3. Create HTML Form Adapter

1. Go to **Authentication** → **Integration** → **IdP Adapters** → **Create New Instance**
2. Select **HTML Form IdP Adapter**
3. Configure:
   - **Instance Name:** `HTML Form Login`
   - **Password Credential Validator:** Select `LDAP Validator`
   - **Extended Contract:** Add `mail`, `givenName`, `sn`

#### 4. Create LDAP Attribute Source (for groups)

1. In the adapter, go to **Extended Contract**
2. Add attribute source:
   - **Data Store:** `PingDirectory`
   - **Base DN:** `ou=Groups,dc=example,dc=com`
   - **Search Filter:** `(&(objectClass=groupOfNames)(member=${dn}))`
   - **Attribute:** `cn` → Map to `groups`

#### 5. Create OIDC Client

1. Go to **Applications** → **OAuth** → **Clients** → **Create New**
2. Configure:
   - **Client ID:** `react-app`
   - **Client Authentication:** `None` (public client)
   - **Redirect URIs:**
     ```
     http://localhost:3000/*
     http://localhost:3000/callback
     http://localhost:5173/*
     ```
   - **Allowed Grant Types:** `Authorization Code`
   - **PKCE:** `Required`
   - **Scopes:** `openid`, `profile`, `email`

#### 6. Configure Token Mapping

1. Go to **Applications** → **OAuth** → **Access Token Management**
2. Edit default or create new ATM
3. Add attribute mappings:
   - `email` → `mail`
   - `given_name` → `givenName`
   - `family_name` → `sn`
   - `roles` → `groups` (multi-valued)

#### OIDC Endpoints

After configuration, these endpoints are available:

| Endpoint | URL |
|----------|-----|
| Issuer | `https://localhost:9031` |
| Authorization | `https://localhost:9031/as/authorization.oauth2` |
| Token | `https://localhost:9031/as/token.oauth2` |
| UserInfo | `https://localhost:9031/idp/userinfo.openid` |
| JWKS | `https://localhost:9031/pf/JWKS` |
| Discovery | `https://localhost:9031/.well-known/openid-configuration` |

---

### PingAccess Configuration

Configure PingAccess to protect the React app:

#### 1. Add PingFederate as Token Provider

1. Go to **System** → **Token Provider**
2. Click **Add Token Provider**
3. Configure:
   - **Name:** `PingFederate`
   - **Issuer:** `https://pingfederate:9031`
   - **Trusted Certificate Group:** Import PF cert or use `Trust Any`

#### 2. Add JWKS for Token Validation

1. Go to **System** → **Key Management** → **Key Pairs**
2. Import PingFederate signing certificate or configure JWKS endpoint

#### 3. Create Virtual Host

1. Go to **Virtual Hosts** → **Add**
2. Configure:
   - **Host:** `*`
   - **Port:** `3000`

#### 4. Create Site (Upstream)

1. Go to **Sites** → **Add**
2. Configure React App:
   - **Name:** `React App`
   - **Targets:** `react-app:80`
   - **Secure:** No (HTTP internally)

3. Add Backend API:
   - **Name:** `Backend API`
   - **Targets:** `backend-api:8080`
   - **Secure:** No

#### 5. Create Web Session

1. Go to **Access** → **Web Sessions** → **Add**
2. Configure:
   - **Name:** `OIDC Session`
   - **Client ID:** `react-app`
   - **Client Secret:** (empty for public client)
   - **PKCE:** Enable
   - **Scopes:** `openid profile email`

#### 6. Create Applications

1. Go to **Applications** → **Add**
2. Configure React App:
   - **Name:** `React App`
   - **Context Root:** `/`
   - **Virtual Host:** Select created host
   - **Site:** `React App`
   - **Web Session:** `OIDC Session`

#### 7. Create Rules

**Rule 1: Require Authentication (for /protected)**
```json
{
  "name": "Require Auth",
  "type": "AuthenticatedUser",
  "paths": ["/protected", "/profile", "/token"]
}
```

**Rule 2: Require Admin Role (for /admin)**
```json
{
  "name": "Require Admin",
  "type": "AttributeRule",
  "attribute": "roles",
  "value": "admin",
  "operation": "CONTAINS"
}
```

**Rule 3: Require DevOps Role (for /devops)**
```json
{
  "name": "Require DevOps",
  "type": "AttributeRule",
  "attribute": "roles",
  "value": "devops",
  "operation": "CONTAINS"
}
```

#### 8. Configure Header Injection

1. Go to **Access** → **Identity Mappings**
2. Add headers to inject:
   - `X-Forwarded-User` → `${subject}`
   - `X-Forwarded-Email` → `${email}`
   - `X-Forwarded-Groups` → `${roles}`

---

## ✅ Verification Steps

### Test 1: Redirect to PingFederate

```bash
# Access protected page - should redirect to PF login
curl -I http://localhost:3000/protected

# Expected: 302 redirect to https://localhost:9031/as/authorization.oauth2
```

### Test 2: Authentication Flow

1. Open http://localhost:3000/protected
2. Should redirect to PingFederate login
3. Login with `abishek` / `Password123!`
4. Should redirect back to /protected with user info displayed

### Test 3: Role-Based Access

| User | /admin | /devops | Expected |
|------|--------|---------|----------|
| abishek | ✅ | ✅ | Both granted |
| john | ❌ | ✅ | Admin denied |
| sarah | ✅ | ❌ | DevOps denied |
| guest | ❌ | ❌ | Both denied |

### Test 4: API Token Validation

```bash
# Get token info (requires auth)
curl http://localhost:8080/api/debug/headers

# Check protected endpoint
curl http://localhost:8080/api/protected
```

---

## 📋 Troubleshooting

### View Container Logs

```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f pingfederate
docker-compose logs -f pingaccess
docker-compose logs -f pingdirectory

# Search for errors
docker-compose logs pingfederate 2>&1 | grep -i error
```

### Common Issues

#### 1. Issuer Mismatch
**Symptom:** Token validation fails with "issuer mismatch"
**Fix:** Ensure PingAccess Token Provider issuer matches PingFederate:
- Container-to-container: `https://pingfederate:9031`
- Browser-facing: `https://localhost:9031`

#### 2. Redirect URI Mismatch
**Symptom:** "Invalid redirect_uri" error
**Fix:** Add all redirect URIs to PingFederate OIDC client:
```
http://localhost:3000/*
http://localhost:3000/callback
```

#### 3. Clock Skew
**Symptom:** Token validation fails with timing errors
**Fix:** Sync container clocks:
```bash
docker-compose restart
```

#### 4. JWKS Connection Failed
**Symptom:** "Unable to retrieve JWKS"
**Fix:** 
- Verify PingFederate is running: `curl -k https://localhost:9031/pf/JWKS`
- Check network connectivity between containers
- Set `NODE_TLS_REJECT_UNAUTHORIZED=0` for self-signed certs

#### 5. LDAP Connection Failed
**Symptom:** Authentication fails, "connection refused"
**Fix:** 
```bash
# Test LDAP connectivity
docker exec pingfederate nc -zv pingdirectory 1389

# Verify bind credentials
docker exec pingdirectory ldapsearch -D "cn=administrator" -w "PingDirectory123!" -b "" -s base
```

### Reset the Lab

```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v

# Start fresh
docker-compose up -d
```

---

## 📁 Project Structure

```
ping-iam-lab/
├── docker-compose.yml          # Main compose file
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
├── README.md                    # This file
│
├── licenses/                    # License files (gitignored)
│   ├── README.md
│   └── .gitkeep
│
├── secrets/                     # Password files (gitignored)
│   └── README.md
│
├── pd-profile/                  # PingDirectory profile
│   └── ldif/
│       ├── 01-base-structure.ldif
│       ├── 02-users.ldif
│       └── 03-groups.ldif
│
├── react-app/                   # React frontend
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── context/
│       │   └── UserContext.ts
│       └── pages/
│           ├── Home.tsx
│           ├── Profile.tsx
│           ├── Token.tsx
│           ├── Protected.tsx
│           ├── Admin.tsx
│           └── DevOps.tsx
│
└── backend-api/                 # Node.js backend
    ├── Dockerfile
    ├── package.json
    └── src/
        └── index.js
```

---

## 🔒 Security Notes

### Local Development Only

This lab is configured for **local development** with relaxed security:

- ⚠️ Self-signed certificates (TLS warnings expected)
- ⚠️ HTTP allowed for some connections
- ⚠️ `NODE_TLS_REJECT_UNAUTHORIZED=0` set in backend

### For Production

- Use proper TLS certificates
- Enable secure cookies
- Use HTTPS everywhere
- Remove debug endpoints
- Implement proper secret management
- Enable audit logging
- Configure proper CORS policies

---

## 📚 Resources

- [Ping Identity DevOps](https://devops.pingidentity.com/)
- [PingFederate Documentation](https://docs.pingidentity.com/pingfederate)
- [PingAccess Documentation](https://docs.pingidentity.com/pingaccess)
- [PingDirectory Documentation](https://docs.pingidentity.com/pingdirectory)
- [OAuth 2.0 / OIDC Specs](https://oauth.net/2/)

---

## 📄 License

This lab configuration is provided for educational purposes. Ping Identity products require proper licensing for production use.
