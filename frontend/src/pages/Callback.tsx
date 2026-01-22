import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userManager } from '../auth/AuthContext';

const Callback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const user = await userManager.signinRedirectCallback();
        console.log('User authenticated:', user);

        // Navigate to intended destination or dashboard
        const returnUrl = sessionStorage.getItem('returnUrl') || '/dashboard';
        sessionStorage.removeItem('returnUrl');
        navigate(returnUrl);
      } catch (err) {
        console.error('Authentication callback error:', err);
        setError(err instanceof Error ? err.message : 'Authentication failed');
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '600px', margin: '5rem auto' }}>
          <div className="card-title">Authentication Error</div>
          <div className="card-body">
            <div className="alert alert-error">
              <strong>Error:</strong> {error}
            </div>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading">
      <div className="spinner"></div>
      <p style={{ marginTop: '1rem' }}>Completing authentication...</p>
    </div>
  );
};

export default Callback;
