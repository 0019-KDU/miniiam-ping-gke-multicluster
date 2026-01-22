import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async () => {
    try {
      await login();
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '5rem auto' }}>
        <div className="card-title">MiniIAM Login</div>
        <div className="card-body">
          <p style={{ marginBottom: '2rem' }}>
            Welcome to MiniIAM - Multi-Cluster Ping Identity Demo Platform
          </p>

          <div className="alert alert-info" style={{ marginBottom: '2rem' }}>
            <strong>Demo Authentication</strong>
            <br />
            This application uses PingFederate for authentication via OpenID Connect (OIDC) with PKCE flow.
            <br />
            <br />
            Protected by PingAccess policy engine with Zero Trust architecture.
          </div>

          <button className="btn btn-primary" onClick={handleLogin} style={{ width: '100%' }}>
            Sign In with PingFederate
          </button>

          <div style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <strong>Architecture:</strong>
            <ul style={{ marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
              <li>React Frontend (this app)</li>
              <li>PingAccess - Web Access Management</li>
              <li>PingFederate - Identity Provider</li>
              <li>PingDirectory - LDAP User Store with Multi-Cluster Replication</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
