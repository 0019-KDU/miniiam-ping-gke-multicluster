import { useUser } from '../context/UserContext'

function Protected() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="card">
        <h2>🔒 Protected Page</h2>
        <p className="loading">Checking authentication...</p>
      </div>
    )
  }

  return (
    <div className="protected-page">
      <div className="card">
        <h2>🔒 Protected Page</h2>
        
        {user ? (
          <>
            <div className="status role-granted" style={{ marginBottom: '1rem' }}>
              ✅ Access Granted
            </div>
            <p>
              Welcome, <strong>{user.email || user.username}</strong>! You have successfully 
              authenticated and can access this protected resource.
            </p>
          </>
        ) : (
          <>
            <div className="status role-denied" style={{ marginBottom: '1rem' }}>
              ❌ Access Denied - Authentication Required
            </div>
            <div className="alert warning">
              <strong>How to access this page:</strong>
              <ol style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
                <li>Navigate to <a href="http://localhost:3000/protected">http://localhost:3000/protected</a></li>
                <li>PingAccess will intercept and redirect to PingFederate</li>
                <li>Login with your credentials (e.g., abishek / password)</li>
                <li>After successful authentication, you'll see this page with access granted</li>
              </ol>
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2>🛡️ How Protection Works</h2>
        <p>
          This page is protected by <strong>PingAccess</strong>. Here's what happens:
        </p>
        
        <div className="architecture">
          <pre>{`
┌──────────────────────────────────────────────────────────────────┐
│  Request: GET /protected                                         │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│  PingAccess Policy Check                                         │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Rule: /protected requires authenticated user               │  │
│  │                                                             │  │
│  │  IF session exists AND token valid:                         │  │
│  │     → Forward to upstream (React app)                       │  │
│  │     → Inject identity headers                               │  │
│  │                                                             │  │
│  │  ELSE:                                                      │  │
│  │     → Redirect to PingFederate /authorize                   │  │
│  │     → User authenticates                                    │  │
│  │     → Callback with code                                    │  │
│  │     → Exchange code for tokens                              │  │
│  │     → Create session                                        │  │
│  │     → Redirect back to /protected                           │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
          `}</pre>
        </div>
      </div>

      <div className="card">
        <h2>⚙️ PingAccess Rule Configuration</h2>
        <p>The rule for this page in PingAccess might look like:</p>
        <div className="code-block">
          <pre>{`{
  "name": "Require Authentication",
  "className": "com.pingidentity.pa.policy.rules.AuthenticatedRule",
  "configuration": {
    "anonymous": false,
    "rejectionHandler": {
      "redirectToLogin": true
    }
  },
  "supportedDestinations": ["Site"]
}`}</pre>
        </div>
      </div>

      {user && (
        <div className="card">
          <h2>📋 Your Session Info</h2>
          <table className="claims-table">
            <tbody>
              <tr>
                <td>Username</td>
                <td>{user.username || user.sub}</td>
              </tr>
              <tr>
                <td>Email</td>
                <td>{user.email}</td>
              </tr>
              <tr>
                <td>Roles</td>
                <td>
                  {user.roles?.length ? (
                    <div className="role-badges">
                      {user.roles.map((role, idx) => (
                        <span key={idx} className={`role-badge ${role.toLowerCase()}`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  ) : 'None'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default Protected
