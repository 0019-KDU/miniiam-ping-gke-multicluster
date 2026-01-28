import { useUser } from '../context/UserContext'

function DevOps() {
  const { user, loading } = useUser()
  
  const hasDevOpsRole = user?.roles?.some(
    role => role.toLowerCase() === 'devops' || role.toLowerCase() === 'developers'
  )

  if (loading) {
    return (
      <div className="card">
        <h2>🚀 DevOps Page</h2>
        <p className="loading">Checking authorization...</p>
      </div>
    )
  }

  return (
    <div className="devops-page">
      <div className="card">
        <h2>🚀 DevOps Page</h2>
        <p>This page requires the <strong>"devops"</strong> role.</p>
        
        {!user ? (
          <>
            <div className="status role-denied" style={{ marginBottom: '1rem' }}>
              ❌ Access Denied - Not Authenticated
            </div>
            <div className="alert error">
              <strong>Authentication Required</strong>
              <p>Please login through PingAccess first.</p>
            </div>
          </>
        ) : hasDevOpsRole ? (
          <>
            <div className="status role-granted" style={{ marginBottom: '1rem' }}>
              ✅ Access Granted - DevOps Role Verified
            </div>
            <div className="alert success">
              <strong>Welcome, DevOps Engineer!</strong>
              <p>You have the devops role and can access this page.</p>
            </div>
          </>
        ) : (
          <>
            <div className="status role-denied" style={{ marginBottom: '1rem' }}>
              ❌ Access Denied - Missing DevOps Role (403)
            </div>
            <div className="alert error">
              <strong>Insufficient Permissions</strong>
              <p>
                You are authenticated as <strong>{user.email || user.username}</strong>, 
                but you don't have the "devops" role.
              </p>
              <p>Your current roles: {user.roles?.join(', ') || 'None'}</p>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>📊 CI/CD Pipeline Status</h2>
        {hasDevOpsRole ? (
          <div className="info-grid">
            <div className="info-box">
              <h4>🟢 Production</h4>
              <p>Last deploy: 2 hours ago</p>
              <p>Status: Healthy</p>
            </div>
            <div className="info-box">
              <h4>🟡 Staging</h4>
              <p>Last deploy: 30 minutes ago</p>
              <p>Status: Testing in progress</p>
            </div>
            <div className="info-box">
              <h4>🔵 Development</h4>
              <p>Last deploy: 5 minutes ago</p>
              <p>Status: Building</p>
            </div>
          </div>
        ) : (
          <div className="alert warning">
            <p>Pipeline status is only visible to DevOps team members.</p>
          </div>
        )}
      </div>

      <div className="card">
        <h2>⚙️ PingAccess Rule for DevOps</h2>
        <div className="code-block">
          <pre>{`{
  "name": "Require DevOps Role",
  "className": "com.pingidentity.pa.policy.rules.AttributeRule", 
  "configuration": {
    "attribute": "roles",
    "value": "devops",
    "operation": "CONTAINS",
    "failIfMissing": true,
    "rejectionHandler": {
      "statusCode": 403,
      "message": "Forbidden - DevOps role required"
    }
  }
}`}</pre>
        </div>
      </div>

      {hasDevOpsRole && (
        <div className="card">
          <h2>🛠️ DevOps Tools</h2>
          <div className="info-grid">
            <div className="info-box">
              <h4>📦 Container Registry</h4>
              <p>Manage Docker images</p>
            </div>
            <div className="info-box">
              <h4>☸️ Kubernetes</h4>
              <p>Cluster management</p>
            </div>
            <div className="info-box">
              <h4>📈 Monitoring</h4>
              <p>Metrics and alerts</p>
            </div>
            <div className="info-box">
              <h4>📝 Logs</h4>
              <p>Centralized logging</p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>🔗 Quick Commands</h2>
        <p>Useful LDAP commands to manage the devops group:</p>
        <div className="code-block">
          <pre>{`# Add user to devops group
ldapmodify -h localhost -p 1389 -D "cn=administrator" -w password << EOF
dn: cn=devops,ou=Groups,dc=example,dc=com
changetype: modify
add: member
member: uid=newuser,ou=People,dc=example,dc=com
EOF

# List devops group members
ldapsearch -h localhost -p 1389 -D "cn=administrator" -w password \\
  -b "cn=devops,ou=Groups,dc=example,dc=com" "(objectClass=*)" member

# Check user's group membership
ldapsearch -h localhost -p 1389 -D "cn=administrator" -w password \\
  -b "dc=example,dc=com" "(uid=abishek)" memberOf`}</pre>
        </div>
      </div>
    </div>
  )
}

export default DevOps
