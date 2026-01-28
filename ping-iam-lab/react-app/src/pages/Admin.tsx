import { useUser } from '../context/UserContext'

function Admin() {
  const { user, loading } = useUser()
  
  const hasAdminRole = user?.roles?.some(
    role => role.toLowerCase() === 'admin' || role.toLowerCase() === 'administrators'
  )

  if (loading) {
    return (
      <div className="card">
        <h2>👑 Admin Page</h2>
        <p className="loading">Checking authorization...</p>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="card">
        <h2>👑 Admin Page</h2>
        <p>This page requires the <strong>"admin"</strong> role.</p>
        
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
        ) : hasAdminRole ? (
          <>
            <div className="status role-granted" style={{ marginBottom: '1rem' }}>
              ✅ Access Granted - Admin Role Verified
            </div>
            <div className="alert success">
              <strong>Welcome, Administrator!</strong>
              <p>You have the admin role and can access this page.</p>
            </div>
          </>
        ) : (
          <>
            <div className="status role-denied" style={{ marginBottom: '1rem' }}>
              ❌ Access Denied - Missing Admin Role (403)
            </div>
            <div className="alert error">
              <strong>Insufficient Permissions</strong>
              <p>
                You are authenticated as <strong>{user.email || user.username}</strong>, 
                but you don't have the "admin" role.
              </p>
              <p>Your current roles: {user.roles?.join(', ') || 'None'}</p>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>🔐 Role-Based Access Control (RBAC)</h2>
        <p>
          PingAccess enforces role-based access by examining claims in the user's token.
          The "roles" claim is derived from LDAP group membership in PingDirectory.
        </p>

        <h3>LDAP Group → Role Mapping</h3>
        <div className="code-block">
          <pre>{`
# PingDirectory Groups
cn=admin,ou=Groups,dc=example,dc=com
  └── members: uid=abishek

cn=devops,ou=Groups,dc=example,dc=com  
  └── members: uid=abishek, uid=john

# PingFederate Token Mapping
LDAP memberOf → roles claim in access token

# Example Token Claims
{
  "sub": "abishek",
  "email": "abishek@example.com",
  "roles": ["admin", "devops"],
  ...
}
          `}</pre>
        </div>
      </div>

      <div className="card">
        <h2>⚙️ PingAccess Rule Configuration</h2>
        <p>The rule for admin access in PingAccess:</p>
        <div className="code-block">
          <pre>{`{
  "name": "Require Admin Role",
  "className": "com.pingidentity.pa.policy.rules.AttributeRule",
  "configuration": {
    "attribute": "roles",
    "value": "admin",
    "operation": "CONTAINS",
    "failIfMissing": true,
    "rejectionHandler": {
      "statusCode": 403,
      "message": "Forbidden - Admin role required"
    }
  }
}`}</pre>
        </div>
      </div>

      {hasAdminRole && (
        <div className="card">
          <h2>🛠️ Admin Actions</h2>
          <p>As an admin, you could access administrative functions such as:</p>
          <div className="info-grid">
            <div className="info-box">
              <h4>User Management</h4>
              <p>Create, update, delete users in PingDirectory</p>
            </div>
            <div className="info-box">
              <h4>Role Assignment</h4>
              <p>Assign/remove users from groups</p>
            </div>
            <div className="info-box">
              <h4>Audit Logs</h4>
              <p>View authentication and authorization logs</p>
            </div>
            <div className="info-box">
              <h4>Configuration</h4>
              <p>Manage application settings</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
