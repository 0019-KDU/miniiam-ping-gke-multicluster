import { useAuth } from '../auth/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

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
            <Link to="/dashboard" className="nav-link active">
              Dashboard
            </Link>
          </li>
          <li>
            <Link to="/profile" className="nav-link">
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
          <div className="card-title">Welcome to MiniIAM Dashboard</div>
          <div className="card-body">
            <p>
              You are successfully authenticated! This application demonstrates a production-grade
              Identity and Access Management (IAM) solution using the Ping Identity stack.
            </p>
          </div>
        </div>

        <div className="info-grid">
          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              User Information
            </h3>
            <div className="info-item">
              <div className="info-label">Username</div>
              <div className="info-value">{user?.profile.preferred_username || user?.profile.sub}</div>
            </div>
            <div className="info-item" style={{ marginTop: '1rem' }}>
              <div className="info-label">Email</div>
              <div className="info-value">{user?.profile.email || 'N/A'}</div>
            </div>
            <div className="info-item" style={{ marginTop: '1rem' }}>
              <div className="info-label">Status</div>
              <div className="info-value">
                <span className="badge badge-success">Authenticated</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
              Session Details
            </h3>
            <div className="info-item">
              <div className="info-label">Token Type</div>
              <div className="info-value">{user?.token_type || 'Bearer'}</div>
            </div>
            <div className="info-item" style={{ marginTop: '1rem' }}>
              <div className="info-label">Expires At</div>
              <div className="info-value">
                {user?.expires_at
                  ? new Date(user.expires_at * 1000).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
            <div className="info-item" style={{ marginTop: '1rem' }}>
              <div className="info-label">Scope</div>
              <div className="info-value">{user?.scope || 'N/A'}</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Architecture Components
          </h3>
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Frontend</div>
              <div className="info-value">
                React SPA with OIDC Client
                <br />
                <span className="badge badge-success" style={{ marginTop: '0.5rem' }}>Active</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Policy Engine</div>
              <div className="info-value">
                PingAccess
                <br />
                <span className="badge badge-success" style={{ marginTop: '0.5rem' }}>Protected</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Identity Provider</div>
              <div className="info-value">
                PingFederate (OIDC)
                <br />
                <span className="badge badge-success" style={{ marginTop: '0.5rem' }}>Connected</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">User Store</div>
              <div className="info-value">
                PingDirectory (LDAP)
                <br />
                <span className="badge badge-primary" style={{ marginTop: '0.5rem' }}>Replicated</span>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>
            Security Features
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div className="alert alert-success">
              ✓ Zero Trust Architecture - All traffic authenticated and encrypted
            </div>
            <div className="alert alert-success">
              ✓ mTLS Service Mesh - Mutual TLS between all services via Istio
            </div>
            <div className="alert alert-success">
              ✓ OIDC with PKCE - Enhanced OAuth2 security flow
            </div>
            <div className="alert alert-success">
              ✓ Multi-Cluster Replication - High availability across regions
            </div>
            <div className="alert alert-success">
              ✓ Policy-Based Access Control - Fine-grained authorization via PingAccess
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Dashboard;
