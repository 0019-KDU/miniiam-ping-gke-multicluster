import { useState, useEffect } from 'react'
import { useUser } from '../context/UserContext'

interface TokenInfo {
  accessToken?: string
  idToken?: string
  decodedAccessToken?: Record<string, unknown>
  decodedIdToken?: Record<string, unknown>
  error?: string
}

function Token() {
  const { user, loading } = useUser()
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [tokenLoading, setTokenLoading] = useState(false)

  useEffect(() => {
    if (user) {
      setTokenLoading(true)
      fetch('/api/token-info')
        .then(res => {
          if (res.ok) return res.json()
          throw new Error('Failed to get token info')
        })
        .then(data => {
          setTokenInfo(data)
          setTokenLoading(false)
        })
        .catch(err => {
          setTokenInfo({ error: err.message })
          setTokenLoading(false)
        })
    }
  }, [user])

  const decodeJwt = (token: string): Record<string, unknown> | null => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(payload)
    } catch {
      return null
    }
  }

  if (loading) {
    return (
      <div className="card">
        <h2>🎫 Token Information</h2>
        <p className="loading">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="card">
        <h2>🎫 Token Information</h2>
        <div className="alert warning">
          <strong>Not Authenticated</strong>
          <p>Access this page via PingAccess to see token information.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="token-page">
      <div className="card">
        <h2>🎫 Token Information</h2>
        <p>
          This page shows the tokens issued by PingFederate and validated by PingAccess.
          The tokens contain claims about the authenticated user.
        </p>

        {tokenLoading && <p className="loading">Fetching token information...</p>}
        
        {tokenInfo?.error && (
          <div className="alert error">
            <strong>Error:</strong> {tokenInfo.error}
            <p>Token information may not be available depending on PingAccess configuration.</p>
          </div>
        )}
      </div>

      {tokenInfo?.idToken && (
        <div className="card">
          <h2>🆔 ID Token</h2>
          <p>The ID Token contains identity claims about the authenticated user:</p>
          
          <h3>Raw Token (JWT)</h3>
          <div className="code-block">
            <pre style={{ wordBreak: 'break-all' }}>
              {tokenInfo.idToken.substring(0, 100)}...
            </pre>
          </div>

          <h3>Decoded Claims</h3>
          <div className="code-block">
            <pre>
              {JSON.stringify(
                tokenInfo.decodedIdToken || decodeJwt(tokenInfo.idToken), 
                null, 
                2
              )}
            </pre>
          </div>
        </div>
      )}

      {tokenInfo?.accessToken && (
        <div className="card">
          <h2>🔑 Access Token</h2>
          <p>The Access Token is used to access protected resources:</p>
          
          <h3>Raw Token (JWT)</h3>
          <div className="code-block">
            <pre style={{ wordBreak: 'break-all' }}>
              {tokenInfo.accessToken.substring(0, 100)}...
            </pre>
          </div>

          <h3>Decoded Claims</h3>
          <div className="code-block">
            <pre>
              {JSON.stringify(
                tokenInfo.decodedAccessToken || decodeJwt(tokenInfo.accessToken), 
                null, 
                2
              )}
            </pre>
          </div>
        </div>
      )}

      <div className="card">
        <h2>📚 OIDC Token Types</h2>
        <div className="info-grid">
          <div className="info-box">
            <h4>ID Token</h4>
            <p>
              Contains claims about the authentication event and the user's identity.
              Audience is the client application.
            </p>
          </div>
          <div className="info-box">
            <h4>Access Token</h4>
            <p>
              Used to access protected APIs. Contains scopes and may include custom claims.
              Validated by resource servers.
            </p>
          </div>
          <div className="info-box">
            <h4>Refresh Token</h4>
            <p>
              Used to obtain new access tokens without re-authentication.
              Typically has longer lifetime.
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>🔍 Token Validation</h2>
        <p>PingAccess validates tokens using:</p>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Signature:</strong> Verified against PingFederate's JWKS endpoint</li>
          <li><strong>Issuer (iss):</strong> Must match configured PingFederate issuer URL</li>
          <li><strong>Audience (aud):</strong> Must match the expected client ID</li>
          <li><strong>Expiration (exp):</strong> Token must not be expired</li>
          <li><strong>Not Before (nbf):</strong> Token must be valid (if present)</li>
        </ul>
        
        <h3>JWKS Endpoint</h3>
        <div className="code-block">
          <pre>https://pingfederate:9031/pf/JWKS</pre>
        </div>
      </div>
    </div>
  )
}

export default Token
