import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserManager, User, WebStorageStateStore } from 'oidc-client-ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// OIDC Configuration - Points to PingFederate via PingAccess
const oidcConfig = {
  authority: 'https://pingfederate.miniiam.local',
  client_id: 'miniiam-react-client',
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',

  // PKCE for enhanced security
  code_challenge_method: 'S256',

  // Token storage
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),

  // Security settings
  filterProtocolClaims: true,
  loadUserInfo: true,

  // Metadata endpoints
  metadata: {
    issuer: 'https://pingfederate.miniiam.local',
    authorization_endpoint: 'https://pingfederate.miniiam.local/as/authorization.oauth2',
    token_endpoint: 'https://pingfederate.miniiam.local/as/token.oauth2',
    userinfo_endpoint: 'https://pingfederate.miniiam.local/idp/userinfo.openid',
    end_session_endpoint: 'https://pingfederate.miniiam.local/idp/startSLO.ping',
    jwks_uri: 'https://pingfederate.miniiam.local/pf/JWKS',
  },
};

const userManager = new UserManager(oidcConfig);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    userManager
      .getUser()
      .then((user) => {
        setUser(user);
        setLoading(false);
      })
      .catch((error) => {
        console.error('Error loading user:', error);
        setLoading(false);
      });

    // Listen for user loaded event
    const handleUserLoaded = (user: User) => {
      setUser(user);
    };

    // Listen for user unloaded event
    const handleUserUnloaded = () => {
      setUser(null);
    };

    // Listen for access token expiring
    const handleAccessTokenExpiring = () => {
      console.log('Access token expiring, attempting silent renew...');
    };

    // Listen for access token expired
    const handleAccessTokenExpired = () => {
      console.log('Access token expired');
      setUser(null);
    };

    // Listen for silent renew error
    const handleSilentRenewError = (error: Error) => {
      console.error('Silent renew error:', error);
    };

    userManager.events.addUserLoaded(handleUserLoaded);
    userManager.events.addUserUnloaded(handleUserUnloaded);
    userManager.events.addAccessTokenExpiring(handleAccessTokenExpiring);
    userManager.events.addAccessTokenExpired(handleAccessTokenExpired);
    userManager.events.addSilentRenewError(handleSilentRenewError);

    return () => {
      userManager.events.removeUserLoaded(handleUserLoaded);
      userManager.events.removeUserUnloaded(handleUserUnloaded);
      userManager.events.removeAccessTokenExpiring(handleAccessTokenExpiring);
      userManager.events.removeAccessTokenExpired(handleAccessTokenExpired);
      userManager.events.removeSilentRenewError(handleSilentRenewError);
    };
  }, []);

  const login = async () => {
    try {
      await userManager.signinRedirect();
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await userManager.signoutRedirect();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !user.expired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export { userManager };
