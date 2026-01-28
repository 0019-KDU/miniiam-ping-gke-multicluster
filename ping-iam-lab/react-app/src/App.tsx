import { Routes, Route, Link, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Home from './pages/Home'
import Profile from './pages/Profile'
import Token from './pages/Token'
import Protected from './pages/Protected'
import Admin from './pages/Admin'
import DevOps from './pages/DevOps'
import { UserContext, UserInfo } from './context/UserContext'

function App() {
  const [user, setUser] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    // Fetch user info from backend (injected by PingAccess)
    fetch('/api/whoami')
      .then(res => {
        if (res.ok) return res.json()
        throw new Error('Not authenticated')
      })
      .then(data => {
        setUser(data)
        setLoading(false)
      })
      .catch(() => {
        setUser(null)
        setLoading(false)
      })
  }, [])

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/profile', label: 'Profile' },
    { path: '/token', label: 'Token' },
    { path: '/protected', label: 'Protected' },
    { path: '/admin', label: 'Admin' },
    { path: '/devops', label: 'DevOps' },
  ]

  return (
    <UserContext.Provider value={{ user, loading }}>
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <span className="logo">🔐</span>
            <span className="brand-text">Ping IAM Lab</span>
          </div>
          <ul className="nav-links">
            {navLinks.map(link => (
              <li key={link.path}>
                <Link 
                  to={link.path} 
                  className={location.pathname === link.path ? 'active' : ''}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="nav-user">
            {loading ? (
              <span className="loading">Loading...</span>
            ) : user ? (
              <span className="user-info">
                👤 {user.email || user.username || 'Authenticated'}
              </span>
            ) : (
              <span className="guest">Guest (Not Authenticated)</span>
            )}
          </div>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/token" element={<Token />} />
            <Route path="/protected" element={<Protected />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/devops" element={<DevOps />} />
          </Routes>
        </main>

        <footer className="footer">
          <p>Ping Identity IAM Lab | PingDirectory + PingFederate + PingAccess</p>
        </footer>
      </div>
    </UserContext.Provider>
  )
}

export default App
