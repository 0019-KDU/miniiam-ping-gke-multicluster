import { useUser } from '../context/UserContext'

function Home() {
  const { user, loading } = useUser()

  return (
    <div className="home">
      <div className="card">
        <h2>🔐 Ping Identity IAM Lab</h2>
        <p>
          This lab demonstrates an enterprise-grade Identity and Access Management (IAM) flow 
          using <strong>Ping Identity</strong> products.
        </p>

        <div className="alert info">
          <strong>Current Status:</strong>{' '}
          {loading ? (
            <span className="loading">Checking authentication...</span>
          ) : user ? (
            <span className="status authenticated">✅ Authenticated as {user.email || user.username}</span>
          ) : (
            <span className="status unauthenticated">❌ Not authenticated - access via PingAccess to login</span>
          )}
        </div>
      </div>

      <div className="card">
        <h2>🏗️ Architecture Overview</h2>
        <div className="architecture">
          <pre>{`
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
│   └───────────────────────────────┬─────────────────────────────────────────┘   │
│                                   │                                             │
│              ┌────────────────────┴────────────────────┐                        │
│              │                                         │                        │
│              ▼ (unauthenticated)                       ▼ (authenticated)        │
│   ┌───────────────────────┐                 ┌───────────────────────┐           │
│   │     PingFederate      │                 │      React App        │           │
│   │   (OIDC Provider)     │                 │    (http://react)     │           │
│   │  https://localhost:9031                 │                       │           │
│   │                       │                 │  • Reads X-Forwarded  │           │
│   │  • OIDC/OAuth 2.0     │                 │    headers for user   │           │
│   │  • HTML Form Login    │                 │  • Calls /api/whoami  │           │
│   │  • Token issuance     │                 │  • Role-based UI      │           │
│   └───────────┬───────────┘                 └───────────────────────┘           │
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
          `}</pre>
        </div>
      </div>

      <div className="card">
        <h2>🧩 Component Roles</h2>
        <div className="info-grid">
          <div className="info-box">
            <h4>📁 PingDirectory</h4>
            <p>
              LDAP directory server that stores user accounts, passwords, groups, and attributes.
              Acts as the authoritative user store for authentication.
            </p>
            <p><strong>Port:</strong> 1389 (LDAP), 1636 (LDAPS)</p>
          </div>

          <div className="info-box">
            <h4>🎫 PingFederate</h4>
            <p>
              Federation server that provides OIDC/OAuth 2.0, SAML, and other authentication protocols.
              Issues tokens after validating credentials against PingDirectory.
            </p>
            <p><strong>Ports:</strong> 9999 (Admin), 9031 (Runtime)</p>
          </div>

          <div className="info-box">
            <h4>🛡️ PingAccess</h4>
            <p>
              API gateway and policy enforcement point. Protects applications, enforces access policies,
              handles token validation, and injects identity context to upstream apps.
            </p>
            <p><strong>Ports:</strong> 9000 (Admin), 3000 (Runtime)</p>
          </div>

          <div className="info-box">
            <h4>⚛️ React App</h4>
            <p>
              Sample application protected by PingAccess. Does not implement authentication itself;
              relies on PingAccess to handle login and receive user identity via headers.
            </p>
            <p><strong>Port:</strong> 5173 (Direct), via 3000 (PingAccess)</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>🔄 Authentication Flow</h2>
        <ol style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>User accesses</strong> http://localhost:3000/protected</li>
          <li><strong>PingAccess intercepts</strong> the request, finds no valid session</li>
          <li><strong>PingAccess redirects</strong> to PingFederate authorization endpoint</li>
          <li><strong>PingFederate displays</strong> login form (HTML Form Adapter)</li>
          <li><strong>User submits credentials</strong> (e.g., abishek / password)</li>
          <li><strong>PingFederate validates</strong> against PingDirectory via LDAP</li>
          <li><strong>PingFederate issues</strong> authorization code → tokens (OIDC)</li>
          <li><strong>PingAccess receives tokens</strong>, validates signature via JWKS</li>
          <li><strong>PingAccess creates session</strong>, stores tokens</li>
          <li><strong>PingAccess forwards</strong> request to React app with identity headers</li>
          <li><strong>React app displays</strong> user profile and role-based content</li>
        </ol>
      </div>

      <div className="card">
        <h2>🔗 Quick Links</h2>
        <table className="claims-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>URL</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>PingFederate Admin</td>
              <td><a href="https://localhost:9999/pingfederate/app" target="_blank" rel="noopener">https://localhost:9999/pingfederate/app</a></td>
              <td>Admin console for PF configuration</td>
            </tr>
            <tr>
              <td>PingAccess Admin</td>
              <td><a href="https://localhost:9000" target="_blank" rel="noopener">https://localhost:9000</a></td>
              <td>Admin console for PA configuration</td>
            </tr>
            <tr>
              <td>PingAccess Runtime</td>
              <td><a href="http://localhost:3000" target="_blank" rel="noopener">http://localhost:3000</a></td>
              <td>Protected app entry point</td>
            </tr>
            <tr>
              <td>React App (Direct)</td>
              <td><a href="http://localhost:5173" target="_blank" rel="noopener">http://localhost:5173</a></td>
              <td>Direct access (bypasses PA)</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default Home
