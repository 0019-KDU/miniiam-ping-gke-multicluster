import { useAuth } from '../auth/AuthContext';
import { Link } from 'react-router-dom';

const Profile: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">MiniIAM</div>
        <ul className="navbar-nav">
          <li>
            <Link to="/dashboard" className="nav-link">
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/profile" className="nav-link active">
              Profile
            </Link>
          </li>
          <li>
            <button className="btn btn-secondary" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </nav>

      <div className="container">
        <div className="card">
          <div className="card-title">User Profile</div>
          <div className="card-body">
            <p>Complete user profile information from PingDirectory via PingFederate.</p>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Profile Claims</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {user?.profile && Object.entries(user.profile).map(([key, value]) => (
              <div key={key} className="info-item">
                <div className="info-label">{key}</div>
                <div className="info-value">
                  {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Access Token (Truncated)</h3>
          <div className="info-item">
            <code style={{ display: 'block', padding: '1rem', backgroundColor: '#f4f4f4', borderRadius: '4px', wordBreak: 'break-all' }}>
              {user?.access_token ? `${user.access_token.substring(0, 100)}...` : 'N/A'}
            </code>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            This JWT access token is validated by PingAccess on every API request using token introspection.
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>ID Token (Truncated)</h3>
          <div className="info-item">
            <code style={{ display: 'block', padding: '1rem', backgroundColor: '#f4f4f4', borderRadius: '4px', wordBreak: 'break-all' }}>
              {user?.id_token ? `${user.id_token.substring(0, 100)}...` : 'N/A'}
            </code>
          </div>
          <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            This JWT ID token contains user identity claims from PingFederate.
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Token Lifecycle</h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div className="info-item">
              <div className="info-label">Issued At</div>
              <div className="info-value">
                {user?.profile.iat
                  ? new Date(user.profile.iat * 1000).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Expires At</div>
              <div className="info-value">
                {user?.expires_at
                  ? new Date(user.expires_at * 1000).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Time Remaining</div>
              <div className="info-value">
                {user?.expires_at
                  ? `${Math.floor((user.expires_at * 1000 - Date.now()) / 60000)} minutes`
                  : 'N/A'}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Expired</div>
              <div className="info-value">
                {user?.expired ? (
                  <span className="badge badge-danger">Yes</span>
                ) : (
                  <span className="badge badge-success">No</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Profile;
