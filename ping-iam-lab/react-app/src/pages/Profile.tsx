import { useUser } from '../context/UserContext'

function Profile() {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div className="card">
        <h2>👤 User Profile</h2>
        <p className="loading">Loading user information...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="card">
        <h2>👤 User Profile</h2>
        <div className="alert warning">
          <strong>Not Authenticated</strong>
          <p>
            You are not currently authenticated. To see your profile:
          </p>
          <ol style={{ marginTop: '0.5rem', marginLeft: '1.5rem' }}>
            <li>Access this app through PingAccess at <a href="http://localhost:3000/profile">http://localhost:3000/profile</a></li>
            <li>PingAccess will redirect you to PingFederate for login</li>
            <li>After successful login, your profile will be displayed</li>
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="profile">
      <div className="card">
        <h2>👤 User Profile</h2>
        <div className="status authenticated" style={{ marginBottom: '1rem' }}>
          ✅ Authenticated User
        </div>

        <table className="claims-table">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Username</td>
              <td>{user.username || user.sub || 'N/A'}</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>{user.email || 'N/A'}</td>
            </tr>
            <tr>
              <td>Given Name</td>
              <td>{user.givenName || 'N/A'}</td>
            </tr>
            <tr>
              <td>Family Name</td>
              <td>{user.familyName || 'N/A'}</td>
            </tr>
            <tr>
              <td>Subject (sub)</td>
              <td>{user.sub || 'N/A'}</td>
            </tr>
            <tr>
              <td>Issuer (iss)</td>
              <td>{user.iss || 'N/A'}</td>
            </tr>
          </tbody>
        </table>

        <h3>🏷️ Roles / Groups</h3>
        {user.roles && user.roles.length > 0 ? (
          <div className="role-badges">
            {user.roles.map((role, idx) => (
              <span 
                key={idx} 
                className={`role-badge ${role.toLowerCase()}`}
              >
                {role}
              </span>
            ))}
          </div>
        ) : (
          <p className="loading">No roles assigned</p>
        )}
      </div>

      <div className="card">
        <h2>📋 All User Claims</h2>
        <p>Complete user object received from the backend:</p>
        <div className="code-block">
          <pre>{JSON.stringify(user, null, 2)}</pre>
        </div>
      </div>

      <div className="card">
        <h2>ℹ️ How Identity is Passed</h2>
        <p>
          When you access this app through PingAccess, your identity is passed to the backend
          via HTTP headers injected by PingAccess:
        </p>
        <div className="info-grid">
          <div className="info-box">
            <h4>X-Forwarded-User</h4>
            <p>Contains the authenticated username or subject</p>
          </div>
          <div className="info-box">
            <h4>X-Forwarded-Email</h4>
            <p>Contains the user's email address</p>
          </div>
          <div className="info-box">
            <h4>X-Forwarded-Groups</h4>
            <p>Contains comma-separated list of user roles/groups</p>
          </div>
          <div className="info-box">
            <h4>Authorization</h4>
            <p>May contain Bearer token (if configured)</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Profile
