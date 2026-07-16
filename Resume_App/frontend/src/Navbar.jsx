import React from 'react'

export default function Navbar({ currentPage, onNavigate, userName, onLogout }) {
  return (
    <nav style={s.nav}>
      <div style={s.left}>
        <span style={s.logo} onClick={() => onNavigate('dashboard')}>
          <span style={s.logoIcon}>&#9670;</span>
          Job Finder Platform
        </span>
      </div>

      <div style={s.links}>
        <button style={{ ...s.link, ...(currentPage === 'dashboard' ? s.linkActive : {}) }}
          onClick={() => onNavigate('dashboard')}>
          Home
        </button>
        <button style={{ ...s.link, ...(currentPage === 'about' ? s.linkActive : {}) }}
          onClick={() => onNavigate('about')}>
          About Us
        </button>
        <button style={{ ...s.link, ...(currentPage === 'contact' ? s.linkActive : {}) }}
          onClick={() => onNavigate('contact')}>
          Contact
        </button>
      </div>

      <div style={s.right}>
        {userName && (
          <>
            <span style={s.userName}>{userName}</span>
            <button style={s.logoutBtn} onClick={onLogout}>Logout</button>
          </>
        )}
      </div>
    </nav>
  )
}

const s = {
  nav: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 28px', background: '#1a1a2e',
    boxShadow: '0 2px 12px rgba(0,0,0,0.15)', position: 'sticky', top: 0, zIndex: 1000,
  },
  left: { display: 'flex', alignItems: 'center' },
  logo: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '15px', fontWeight: 700, color: '#fff', cursor: 'pointer',
    background: 'none', border: 'none', padding: 0,
  },
  logoIcon: { color: '#a8d8b9', fontSize: '18px' },
  links: { display: 'flex', gap: '4px' },
  link: {
    padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'none',
    color: '#a0aec0', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
    transition: 'color 0.15s, background 0.15s',
  },
  linkActive: {
    color: '#fff', background: 'rgba(255,255,255,0.1)',
  },
  right: { display: 'flex', alignItems: 'center', gap: '12px' },
  userName: { fontSize: '12px', color: '#a0aec0', fontWeight: 500 },
  logoutBtn: {
    padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)',
    background: 'none', color: '#a0aec0', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
  },
}
