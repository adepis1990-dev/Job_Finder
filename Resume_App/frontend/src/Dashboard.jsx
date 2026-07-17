import React from 'react'
import KandinskyBackground from './backgrounds/background1'

// Service card icons as inline SVGs
function ResumeIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Scroll/document */}
      <rect x="10" y="6" width="28" height="36" rx="3" fill="#e8f4ec" stroke="#4a9e6e" strokeWidth="1.5" />
      <rect x="10" y="6" width="28" height="10" rx="3" fill="#4a9e6e" />
      <text x="24" y="14" textAnchor="middle" fontSize="6" fill="#fff" fontWeight="700" fontFamily="Arial">RESUME</text>
      {/* Lines */}
      <rect x="15" y="20" width="18" height="2" rx="1" fill="#a8d8b9" />
      <rect x="15" y="25" width="14" height="2" rx="1" fill="#c8ecd6" />
      <rect x="15" y="30" width="16" height="2" rx="1" fill="#a8d8b9" />
      <rect x="15" y="35" width="10" height="2" rx="1" fill="#c8ecd6" />
      {/* Scroll curl at bottom */}
      <path d="M10 39 Q10 44 14 44 L34 44 Q38 44 38 39" fill="none" stroke="#4a9e6e" strokeWidth="1.5" />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      <rect x="6" y="12" width="36" height="24" rx="3" fill="#e8f0fc" stroke="#4a7ec8" strokeWidth="1.5" />
      <path d="M6 15 L24 27 L42 15" stroke="#4a7ec8" strokeWidth="1.5" fill="none" />
      <circle cx="36" cy="14" r="6" fill="#f4a8b5" />
      <text x="36" y="17" textAnchor="middle" fontSize="7" fill="#fff" fontWeight="700" fontFamily="Arial">3</text>
    </svg>
  )
}

function ScraperIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Spider/web */}
      <circle cx="24" cy="24" r="16" fill="#f3eef8" stroke="#8b6db5" strokeWidth="1.5" strokeDasharray="3 2" />
      <circle cx="24" cy="24" r="8" fill="#e8ddf2" stroke="#8b6db5" strokeWidth="1" />
      <circle cx="24" cy="24" r="3" fill="#8b6db5" />
      {/* Legs */}
      <line x1="24" y1="8" x2="24" y2="16" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="24" y1="32" x2="24" y2="40" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="8" y1="24" x2="16" y2="24" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="32" y1="24" x2="40" y2="24" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="12" y1="12" x2="18" y2="18" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="30" y1="30" x2="36" y2="36" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="12" y1="36" x2="18" y2="30" stroke="#8b6db5" strokeWidth="1.2" />
      <line x1="30" y1="18" x2="36" y2="12" stroke="#8b6db5" strokeWidth="1.2" />
    </svg>
  )
}

const SERVICES = [
  {
    id: 'resume-ai',
    title: 'Resume AI',
    description: 'AI-powered document builder, email campaign & job finder — all in one',
    icon: ResumeIcon,
    level: 1,
    color: '#4a9e6e',
    bgColor: '#f0faf4',
    borderColor: '#c6f0d5',
  },
]

export default function Dashboard({ userLevel, userName, onSelectService, onLogout }) {
  return (
    <div style={s.page}>
      <KandinskyBackground />

      {/* Main content */}
      <div style={s.content}>
        <h1 style={s.heading}>Your Workspace</h1>
        <p style={s.subheading}>Select a service to get started</p>

        <div style={s.grid}>
          {SERVICES.map(svc => {
            const Icon = svc.icon
            return (
              <button
                key={svc.id}
                style={{
                  ...s.card,
                  background: svc.bgColor,
                  borderColor: svc.borderColor,
                  cursor: 'pointer',
                }}
                onClick={() => onSelectService(svc.id)}
              >
                <div style={s.cardIcon}>
                  <Icon />
                </div>
                <div style={s.cardContent}>
                  <h3 style={{ ...s.cardTitle, color: svc.color }}>{svc.title}</h3>
                  <p style={s.cardDesc}>{svc.description}</p>
                </div>
                <span style={{ ...s.openBadge, background: svc.color }}>Open</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight: 'calc(100vh - 52px)', position: 'relative', overflow: 'hidden',
    background: 'linear-gradient(160deg, #dbe9f8 0%, #ede4f8 30%, #dff5e8 60%, #fef0dc 100%)',
    display: 'flex', flexDirection: 'column',
  },
  content: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '40px 24px', position: 'relative', zIndex: 10,
  },
  heading: {
    fontSize: '28px', fontWeight: 700, color: '#1a1a2e', margin: 0, textAlign: 'center',
  },
  subheading: {
    fontSize: '14px', color: '#718096', marginTop: '8px', marginBottom: '40px', textAlign: 'center',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '20px', width: '100%', maxWidth: '920px',
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    padding: '28px 24px', borderRadius: '16px', border: '2px solid',
    textAlign: 'center', transition: 'transform 0.15s, box-shadow 0.15s',
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
    position: 'relative',
  },
  cardIcon: { marginBottom: '4px' },
  cardContent: { display: 'flex', flexDirection: 'column', gap: '4px' },
  cardTitle: { fontSize: '16px', fontWeight: 700, margin: 0 },
  cardDesc: { fontSize: '12px', color: '#718096', margin: 0, lineHeight: 1.5 },
  lockBadge: {
    position: 'absolute', top: '12px', right: '12px',
    fontSize: '9px', fontWeight: 700, color: '#a0aec0',
    background: '#edf2f7', padding: '3px 8px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  openBadge: {
    marginTop: '8px', padding: '6px 18px', borderRadius: '8px',
    color: '#fff', fontSize: '12px', fontWeight: 700,
  },
}
