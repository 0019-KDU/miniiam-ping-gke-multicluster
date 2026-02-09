# PingDirectory Replication Guide

## Overview

This document explains how PingDirectory multi-master replication works across GKE clusters and how to manage users for testing.

---

## Replication Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PINGDIRECTORY REPLICATION TOPOLOGY                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  GKE-ASIA (Primary)                     GKE-EUROPE (Secondary)              │
│  ┌─────────────────────────┐            ┌─────────────────────────┐        │
│  │                         │            │                         │        │
│  │  pingdirectory-0        │            │  pingdirectory-0        │        │
│  │  ┌─────────────────┐    │            │    ┌─────────────────┐  │        │
│  │  │   SEED Server   │    │◀──────────▶│    │ REPLICA Server  │  │        │
│  │  │                 │    │  Bi-Dir    │    │                 │  │        │
│  │  │ • Accepts writes│    │   REPL     │    │ • Accepts writes│  │        │
│  │  │ • Init topology │    │            │    │ • Syncs with    │  │        │
│  │  │ • Port 8989     │    │            │    │   seed          │  │        │
│  │  └─────────────────┘    │            │    └─────────────────┘  │        │
│  │                         │            │                         │        │
│  └─────────────────────────┘            └─────────────────────────┘        │
│                                                                              │
│  Replication Flow:                                                          │
│  1. Write to Asia → Replicated to Europe                                    │
│  2. Write to Europe → Replicated to Asia                                    │
│  3. Conflict resolution: Last writer wins                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Replication Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 1636 | LDAPS | Secure LDAP for reads/writes |
| 8989 | TCP | Replication traffic |

---

## How Replication Works

### 1. Initial Setup (Topology Initialization)

When PingDirectory starts:
- **SEED server** (gke-asia) initializes the replication topology
- **REPLICA server** (gke-europe) joins and syncs all data

### 2. Ongoing Replication

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         REPLICATION CHANGE FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Client writes to gke-asia                                               │
│     │                                                                        │
│     ▼                                                                        │
│  ┌─────────────────────────┐                                                │
│  │  PingDirectory (Asia)   │                                                │
│  │  • Write to local DB    │                                                │
│  │  • Generate changelog   │                                                │
│  │  • Replicate to peers   │                                                │
│  └───────────┬─────────────┘                                                │
│              │                                                               │
│              │ Port 8989 (replication)                                       │
│              │                                                               │
│              ▼                                                               │
│  ┌─────────────────────────┐                                                │
│  │  PingDirectory (Europe) │                                                │
│  │  • Receive change       │                                                │
│  │  • Apply to local DB    │                                                │
│  │  • ACK to sender        │                                                │
│  └─────────────────────────┘                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Conflict Resolution

- Uses **timestamp-based resolution**
- Most recent write wins
- Conflicts are rare with proper application design

---

## Commands

### Check Replication Status

```bash
# Switch to gke-asia (primary)
kubectl config use-context gke-asia

# Check replication status
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt
```

**Expected Output:**
```
          --- Replication Server Status ---
Server        : pingdirectory-0:8989
Server ID     : 12345
Generation ID : 67890

          --- Connected Replication Servers ---
Server                                              : Conn
----------------------------------------------------------------
pingdirectory-0.ping-iam.svc.clusterset.local:8989 : Yes

          --- Replication Status ---
Base DN                     : dc=example,dc=com
Status                      : Normal
Missing Changes             : 0
Replication Latency (ms)    : 5
```

### Check from Europe Cluster

```bash
kubectl config use-context gke-europe
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt
```

### Detailed Replication Info

```bash
# Show replication domains
kubectl exec pingdirectory-0 -n ping-iam -- dsconfig list-replication-domains --no-prompt

# Show sync providers
kubectl exec pingdirectory-0 -n ping-iam -- dsconfig list-sync-providers --no-prompt

# Check replication changelog
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch -b "cn=changelog" "(objectclass=*)" -D "cn=Directory Manager" -w "$PING_IDENTITY_PASSWORD" | head -50
```

---

## User Management Commands

### View Existing Users

```bash
# List all users in the directory
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(objectclass=inetOrgPerson)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" \
  uid cn mail
```

**Sample Output:**
```
dn: uid=user.0,ou=People,dc=example,dc=com
uid: user.0
cn: Aaren Atp
mail: user.0@example.com

dn: uid=user.1,ou=People,dc=example,dc=com
uid: user.1
cn: Aarika Atpco
mail: user.1@example.com
...
```

### Search for Specific User

```bash
# Search by username
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(uid=user.0)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD"

# Search by email
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(mail=john@example.com)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD"
```

### Count Total Users

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(objectclass=inetOrgPerson)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" \
  dn | grep "^dn:" | wc -l
```

---

## Adding Test Users

### Method 1: Add Single User (LDIF)

```bash
# Create user LDIF
cat << 'EOF' > /tmp/new-user.ldif
dn: uid=testuser,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: testuser
cn: Test User
sn: User
givenName: Test
mail: testuser@example.com
userPassword: Password123!
EOF

# Add user via kubectl exec
kubectl exec -i pingdirectory-0 -n ping-iam -- ldapmodify \
  -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" < /tmp/new-user.ldif
```

### Method 2: Add User Directly (One-liner)

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: uid=john.doe,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: john.doe
cn: John Doe
sn: Doe
givenName: John
mail: john.doe@example.com
userPassword: SecurePass123!
employeeNumber: 12345
telephoneNumber: +1-555-123-4567
EOF
```

### Method 3: Add Multiple Users (Batch)

```bash
# Create batch LDIF file
cat << 'EOF' > /tmp/batch-users.ldif
dn: uid=alice.smith,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: alice.smith
cn: Alice Smith
sn: Smith
givenName: Alice
mail: alice.smith@example.com
userPassword: Password123!

dn: uid=bob.jones,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: bob.jones
cn: Bob Jones
sn: Jones
givenName: Bob
mail: bob.jones@example.com
userPassword: Password123!

dn: uid=carol.white,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: carol.white
cn: Carol White
sn: White
givenName: Carol
mail: carol.white@example.com
userPassword: Password123!
EOF

# Add all users
kubectl exec -i pingdirectory-0 -n ping-iam -- ldapmodify \
  -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" < /tmp/batch-users.ldif
```

---

## Verifying Replication of New Users

### Step 1: Add User in GKE-ASIA

```bash
kubectl config use-context gke-asia

kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: uid=repl.test,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: repl.test
cn: Replication Test
sn: Test
givenName: Replication
mail: repl.test@example.com
userPassword: TestPass123!
EOF
```

### Step 2: Verify in GKE-EUROPE

```bash
kubectl config use-context gke-europe

# Wait a few seconds for replication
sleep 5

# Search for the user
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(uid=repl.test)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD"
```

**Expected:** User should exist in both clusters.

### Step 3: Test Reverse Replication

```bash
# Add user in Europe
kubectl config use-context gke-europe

kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: uid=europe.user,ou=People,dc=example,dc=com
objectClass: top
objectClass: person
objectClass: organizationalPerson
objectClass: inetOrgPerson
uid: europe.user
cn: Europe User
sn: User
givenName: Europe
mail: europe.user@example.com
userPassword: EuroPass123!
EOF

# Verify in Asia
kubectl config use-context gke-asia
sleep 5

kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=People,dc=example,dc=com" \
  "(uid=europe.user)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD"
```

---

## Modifying Users

### Change Password

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldappasswd \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" \
  -s "NewPassword456!" \
  "uid=testuser,ou=People,dc=example,dc=com"
```

### Modify User Attributes

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: uid=testuser,ou=People,dc=example,dc=com
changetype: modify
replace: telephoneNumber
telephoneNumber: +1-555-999-8888
-
replace: mail
mail: newemail@example.com
EOF
```

### Add Attribute to User

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: uid=testuser,ou=People,dc=example,dc=com
changetype: modify
add: description
description: Test account for development
EOF
```

---

## Deleting Users

### Delete Single User

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapdelete \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" \
  "uid=testuser,ou=People,dc=example,dc=com"
```

### Delete Multiple Users

```bash
cat << 'EOF' > /tmp/delete-users.ldif
uid=alice.smith,ou=People,dc=example,dc=com
uid=bob.jones,ou=People,dc=example,dc=com
uid=carol.white,ou=People,dc=example,dc=com
EOF

kubectl exec -i pingdirectory-0 -n ping-iam -- ldapdelete \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" < /tmp/delete-users.ldif
```

---

## Group Management

### List Groups

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "ou=Groups,dc=example,dc=com" \
  "(objectclass=groupOfUniqueNames)" \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" \
  cn uniqueMember
```

### Create New Group

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify -a \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: cn=developers,ou=Groups,dc=example,dc=com
objectClass: top
objectClass: groupOfUniqueNames
cn: developers
description: Development team group
uniqueMember: uid=john.doe,ou=People,dc=example,dc=com
EOF
```

### Add User to Group

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: cn=developers,ou=Groups,dc=example,dc=com
changetype: modify
add: uniqueMember
uniqueMember: uid=alice.smith,ou=People,dc=example,dc=com
EOF
```

### Remove User from Group

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify \
  -D "cn=Directory Manager" \
  -w "$PING_IDENTITY_PASSWORD" << 'EOF'
dn: cn=developers,ou=Groups,dc=example,dc=com
changetype: modify
delete: uniqueMember
uniqueMember: uid=alice.smith,ou=People,dc=example,dc=com
EOF
```

---

## Testing Authentication

### Test User Login (LDAP Bind)

```bash
# Test user authentication
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "dc=example,dc=com" \
  "(objectclass=*)" \
  -D "uid=testuser,ou=People,dc=example,dc=com" \
  -w "Password123!" \
  -s base
```

**Success:** Returns base entry
**Failure:** Returns "Invalid credentials"

### Test via PingFederate

```bash
# Get the OIDC token endpoint
curl -k http://34.36.200.69/.well-known/openid-configuration | jq '.token_endpoint'

# Test resource owner password flow (if enabled)
curl -k -X POST "http://34.36.200.69/as/token.oauth2" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password" \
  -d "username=testuser" \
  -d "password=Password123!" \
  -d "client_id=<your-client-id>" \
  -d "client_secret=<your-client-secret>"
```

---

## Troubleshooting Replication

### Problem: Replication Not Working

**Check connectivity:**
```bash
# From Asia pod
kubectl exec pingdirectory-0 -n ping-iam --context=gke-asia -- \
  nc -zv pingdirectory-cluster.ping-iam.svc.clusterset.local 8989

# Check DNS resolution
kubectl exec pingdirectory-0 -n ping-iam --context=gke-asia -- \
  nslookup pingdirectory.ping-iam.svc.clusterset.local
```

### Problem: Replication Lag

**Check missing changes:**
```bash
kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt
```

If "Missing Changes" > 0, wait or investigate network issues.

### Problem: Split Brain

**Symptoms:** Different data in each cluster

**Resolution:**
```bash
# Force re-initialization from seed
kubectl exec pingdirectory-0 -n ping-iam --context=gke-europe -- \
  dsreplication initialize \
  --hostDestination pingdirectory-0.ping-iam.svc.cluster.local \
  --portDestination 1636 \
  --hostSource pingdirectory-0.ping-iam.svc.clusterset.local \
  --portSource 1636 \
  --baseDN "dc=example,dc=com" \
  -X
```

### Check Replication Logs

```bash
# View PingDirectory logs
kubectl logs pingdirectory-0 -n ping-iam | grep -i replication

# View detailed server logs
kubectl exec pingdirectory-0 -n ping-iam -- cat /opt/out/instance/logs/replication
```

---

## Replication Monitoring

### Check Replication Health (Script)

```bash
#!/bin/bash
# replication-health.sh

echo "=== GKE-ASIA Replication Status ==="
kubectl exec pingdirectory-0 -n ping-iam --context=gke-asia -- \
  dsreplication status --no-prompt

echo ""
echo "=== GKE-EUROPE Replication Status ==="
kubectl exec pingdirectory-0 -n ping-iam --context=gke-europe -- \
  dsreplication status --no-prompt

echo ""
echo "=== User Count Comparison ==="
ASIA_COUNT=$(kubectl exec pingdirectory-0 -n ping-iam --context=gke-asia -- \
  ldapsearch -b "ou=People,dc=example,dc=com" "(objectclass=inetOrgPerson)" \
  -D "cn=Directory Manager" -w "$PING_IDENTITY_PASSWORD" dn 2>/dev/null | grep "^dn:" | wc -l)

EUROPE_COUNT=$(kubectl exec pingdirectory-0 -n ping-iam --context=gke-europe -- \
  ldapsearch -b "ou=People,dc=example,dc=com" "(objectclass=inetOrgPerson)" \
  -D "cn=Directory Manager" -w "$PING_IDENTITY_PASSWORD" dn 2>/dev/null | grep "^dn:" | wc -l)

echo "Asia users: $ASIA_COUNT"
echo "Europe users: $EUROPE_COUNT"

if [ "$ASIA_COUNT" == "$EUROPE_COUNT" ]; then
  echo "✓ User counts match - replication healthy"
else
  echo "✗ User counts differ - check replication"
fi
```

---

## Default Test Users

The PingDirectory DevOps image comes with sample users:

| Username | Password | DN |
|----------|----------|-----|
| user.0 | password | uid=user.0,ou=People,dc=example,dc=com |
| user.1 | password | uid=user.1,ou=People,dc=example,dc=com |
| user.2 | password | uid=user.2,ou=People,dc=example,dc=com |
| ... | password | ... |
| user.9 | password | uid=user.9,ou=People,dc=example,dc=com |

### Test Default User

```bash
kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch \
  -b "dc=example,dc=com" \
  "(uid=user.0)" \
  -D "uid=user.0,ou=People,dc=example,dc=com" \
  -w "password" \
  -s base
```

---

## Summary

| Task | Command |
|------|---------|
| Check replication status | `kubectl exec pingdirectory-0 -n ping-iam -- dsreplication status --no-prompt` |
| List users | `kubectl exec pingdirectory-0 -n ping-iam -- ldapsearch -b "ou=People,dc=example,dc=com" ...` |
| Add user | `kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify -a ...` |
| Modify user | `kubectl exec pingdirectory-0 -n ping-iam -- ldapmodify ...` |
| Delete user | `kubectl exec pingdirectory-0 -n ping-iam -- ldapdelete ...` |
| Test auth | `ldapsearch ... -D "uid=user,ou=People,dc=example,dc=com" -w password` |

Replication ensures data consistency across clusters with near real-time synchronization.
