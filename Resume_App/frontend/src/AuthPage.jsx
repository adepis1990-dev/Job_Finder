import React, { useState } from 'react'

const API = 'http://localhost:8000'

export default function AuthPage({ onAuth }) {
  const [username, setUsername] = useState('user')
  const [password, setPassword] = useState('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const fd = new FormData()
      fd.append('username', username)
      fd.append('password', password)

      const res = await fetch(`${API}/auth/login`, { method: 'POST', body: fd })
      const data = await res.json()

      if (!res.ok) throw new Error(data.detail || 'Invalid credentials')

      // Store token and user info
      localStorage.setItem('auth_token', data.access_token)
      localStorage.setItem('auth_user', JSON.stringify(data.user))
      onAuth({ token: data.access_token, user: data.user })
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.header}>
          <h1 style={s.title}>AI Document Builder</h1>
          <p style={s.subtitle}>Sign in to access your workspace</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Username</label>
            <input type="text" style={s.input} value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username" required autoFocus />
          </div>

          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input type="password" style={s.input} value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>

          {error && <div style={s.error}>{error}</div>}

          <button type="submit" style={s.submitBtn} disabled={loading}>
            {loading ? '...' : 'Sign In'}
          </button>
        </form>

        <div style={s.footer}>
          <p style={s.hint}>Contact admin for account access</p>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    padding: '20px',
  },
  card: {
    width: '100%', maxWidth: '380px', background: '#fff', borderRadius: '16px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden',
  },
  header: {
    padding: '32px 32px 20px', textAlign: 'center',
  },
  title: {
    fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: 0,
  },
  subtitle: {
    fontSize: '13px', color: '#718096', marginTop: '6px',
  },
  form: {
    padding: '0 32px 24px', display: 'flex', flexDirection: 'column', gap: '16px',
  },
  field: {
    display: 'flex', flexDirection: 'column', gap: '5px',
  },
  label: {
    fontSize: '11px', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '12px 14px', borderRadius: '8px', border: '1.5px solid #e2e8f0',
    fontSize: '14px', color: '#2d3748', outline: 'none', fontFamily: 'inherit',
    background: '#fafafa',
  },
  error: {
    background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: '8px',
    padding: '10px 12px', color: '#c53030', fontSize: '12px',
  },
  submitBtn: {
    padding: '14px', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px',
    fontWeight: 700, cursor: 'pointer', marginTop: '4px',
  },
  footer: {
    padding: '16px 32px 20px', textAlign: 'center',
    borderTop: '1px solid #f0f0f0', background: '#fafbfc',
  },
  hint: {
    fontSize: '12px', color: '#a0aec0', margin: 0,
  },
}
