const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createRemoteJWKSet, jwtVerify, decodeJwt } = require('jose');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuration
const config = {
  pfIssuerUrl: process.env.PF_ISSUER_URL || 'https://pingfederate:9031',
  pfJwksUrl: process.env.PF_JWKS_URL || 'https://pingfederate:9031/pf/JWKS',
  trustedIssuers: (process.env.TRUSTED_ISSUERS || 'https://localhost:9031,https://pingfederate:9031').split(','),
  jwtAudience: process.env.JWT_AUDIENCE || 'react-app',
  logLevel: process.env.LOG_LEVEL || 'info'
};

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// Trust self-signed certificates in development
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// JWKS client (lazy initialized)
let jwks = null;
const getJwks = () => {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(config.pfJwksUrl));
  }
  return jwks;
};

// Helper: Extract user info from headers (injected by PingAccess)
const extractUserFromHeaders = (req) => {
  const user = {
    username: req.headers['x-forwarded-user'] || req.headers['x-pa-subject'],
    email: req.headers['x-forwarded-email'] || req.headers['x-pa-email'],
    givenName: req.headers['x-forwarded-given-name'] || req.headers['x-pa-given-name'],
    familyName: req.headers['x-forwarded-family-name'] || req.headers['x-pa-family-name'],
    roles: [],
    source: 'headers'
  };

  // Parse roles from header (comma-separated or JSON array)
  const rolesHeader = req.headers['x-forwarded-groups'] || req.headers['x-pa-groups'] || '';
  if (rolesHeader) {
    try {
      user.roles = JSON.parse(rolesHeader);
    } catch {
      user.roles = rolesHeader.split(',').map(r => r.trim()).filter(Boolean);
    }
  }

  return user;
};

// Helper: Extract and validate JWT token
const extractTokenFromHeader = (req) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
};

// Helper: Verify JWT token
const verifyToken = async (token) => {
  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: config.trustedIssuers,
      audience: config.jwtAudience
    });
    return { valid: true, payload };
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return { valid: false, error: error.message };
  }
};

// ============================================================================
// Health Check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend-api',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend-api',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Who Am I - Returns current user info from headers or token
// ============================================================================
app.get('/api/whoami', async (req, res) => {
  // First, try to get user from headers (PingAccess injection)
  const headerUser = extractUserFromHeaders(req);
  
  // Check if we have a Bearer token
  const token = extractTokenFromHeader(req);
  
  if (token) {
    try {
      const decoded = decodeJwt(token);
      
      // Merge token claims with header data
      return res.json({
        username: decoded.sub || headerUser.username,
        email: decoded.email || headerUser.email,
        givenName: decoded.given_name || decoded.givenName || headerUser.givenName,
        familyName: decoded.family_name || decoded.familyName || headerUser.familyName,
        roles: decoded.roles || decoded.groups || headerUser.roles || [],
        sub: decoded.sub,
        iss: decoded.iss,
        aud: decoded.aud,
        exp: decoded.exp,
        iat: decoded.iat,
        source: 'token'
      });
    } catch (error) {
      console.error('Failed to decode token:', error.message);
    }
  }
  
  // If we have header-based user info
  if (headerUser.username || headerUser.email) {
    return res.json(headerUser);
  }
  
  // No authentication found
  return res.status(401).json({
    error: 'Not authenticated',
    message: 'No user information found in headers or token'
  });
});

// ============================================================================
// Token Info - Returns token details for debugging
// ============================================================================
app.get('/api/token-info', async (req, res) => {
  const token = extractTokenFromHeader(req);
  
  if (!token) {
    return res.status(401).json({
      error: 'No token provided',
      message: 'Authorization header with Bearer token required'
    });
  }
  
  try {
    const decoded = decodeJwt(token);
    const verification = await verifyToken(token);
    
    res.json({
      accessToken: token.substring(0, 50) + '...',
      decodedAccessToken: decoded,
      verified: verification.valid,
      verificationError: verification.error,
      issuer: decoded.iss,
      audience: decoded.aud,
      subject: decoded.sub,
      expiration: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      issuedAt: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null
    });
  } catch (error) {
    res.status(400).json({
      error: 'Invalid token',
      message: error.message
    });
  }
});

// ============================================================================
// Verify Token - Validates a token and returns claims
// ============================================================================
app.post('/api/verify-token', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({
      error: 'Token required',
      message: 'Provide token in request body'
    });
  }
  
  const result = await verifyToken(token);
  
  if (result.valid) {
    res.json({
      valid: true,
      claims: result.payload
    });
  } else {
    res.status(401).json({
      valid: false,
      error: result.error
    });
  }
});

// ============================================================================
// Protected Resource - Requires authentication
// ============================================================================
app.get('/api/protected', async (req, res) => {
  const headerUser = extractUserFromHeaders(req);
  const token = extractTokenFromHeader(req);
  
  if (!token && !headerUser.username) {
    return res.status(401).json({
      error: 'Authentication required',
      message: 'This endpoint requires authentication'
    });
  }
  
  res.json({
    message: 'You have access to this protected resource',
    user: headerUser.username || 'authenticated',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// Admin Resource - Requires admin role
// ============================================================================
app.get('/api/admin', async (req, res) => {
  const headerUser = extractUserFromHeaders(req);
  const token = extractTokenFromHeader(req);
  
  let roles = headerUser.roles || [];
  
  if (token) {
    try {
      const decoded = decodeJwt(token);
      roles = decoded.roles || decoded.groups || roles;
    } catch {}
  }
  
  const hasAdminRole = roles.some(
    r => r.toLowerCase() === 'admin' || r.toLowerCase() === 'administrators'
  );
  
  if (!hasAdminRole) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin role required',
      yourRoles: roles
    });
  }
  
  res.json({
    message: 'Welcome, Administrator!',
    adminData: {
      totalUsers: 42,
      activeConnections: 15,
      lastBackup: new Date().toISOString()
    }
  });
});

// ============================================================================
// DevOps Resource - Requires devops role
// ============================================================================
app.get('/api/devops', async (req, res) => {
  const headerUser = extractUserFromHeaders(req);
  const token = extractTokenFromHeader(req);
  
  let roles = headerUser.roles || [];
  
  if (token) {
    try {
      const decoded = decodeJwt(token);
      roles = decoded.roles || decoded.groups || roles;
    } catch {}
  }
  
  const hasDevOpsRole = roles.some(
    r => r.toLowerCase() === 'devops' || r.toLowerCase() === 'developers'
  );
  
  if (!hasDevOpsRole) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'DevOps role required',
      yourRoles: roles
    });
  }
  
  res.json({
    message: 'Welcome, DevOps Engineer!',
    deployments: {
      production: { status: 'healthy', version: '1.2.3' },
      staging: { status: 'deploying', version: '1.2.4' },
      development: { status: 'healthy', version: '1.3.0-dev' }
    }
  });
});

// ============================================================================
// Debug Headers - Shows all received headers (useful for debugging)
// ============================================================================
app.get('/api/debug/headers', (req, res) => {
  res.json({
    headers: req.headers,
    userFromHeaders: extractUserFromHeaders(req)
  });
});

// ============================================================================
// Error Handler
// ============================================================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message
  });
});

// ============================================================================
// Start Server
// ============================================================================
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║         Ping IAM Lab - Backend API                        ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port ${PORT}                              ║
║                                                            ║
║  Endpoints:                                                ║
║    GET  /health           - Health check                   ║
║    GET  /api/whoami       - Current user info              ║
║    GET  /api/token-info   - Token details                  ║
║    POST /api/verify-token - Verify a token                 ║
║    GET  /api/protected    - Protected resource             ║
║    GET  /api/admin        - Admin only                     ║
║    GET  /api/devops       - DevOps only                    ║
║    GET  /api/debug/headers - Debug headers                 ║
║                                                            ║
║  Configuration:                                            ║
║    PF Issuer:  ${config.pfIssuerUrl.padEnd(32)}        ║
║    JWKS URL:   ${config.pfJwksUrl.substring(0, 32).padEnd(32)}...  ║
╚════════════════════════════════════════════════════════════╝
  `);
});
