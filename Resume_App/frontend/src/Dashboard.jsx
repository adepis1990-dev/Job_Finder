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

function AccountingIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Calculator/ledger */}
      <rect x="10" y="6" width="28" height="36" rx="3" fill="#eef2f7" stroke="#4a6fa5" strokeWidth="1.5" />
      <rect x="14" y="10" width="20" height="8" rx="2" fill="#4a6fa5" />
      <text x="24" y="16" textAnchor="middle" fontSize="5" fill="#fff" fontWeight="700" fontFamily="Arial">1,250.00</text>
      {/* Grid lines (ledger rows) */}
      <rect x="14" y="22" width="9" height="4" rx="1" fill="#c8d8e8" />
      <rect x="25" y="22" width="9" height="4" rx="1" fill="#c8d8e8" />
      <rect x="14" y="28" width="9" height="4" rx="1" fill="#d8e4f0" />
      <rect x="25" y="28" width="9" height="4" rx="1" fill="#d8e4f0" />
      <rect x="14" y="34" width="9" height="4" rx="1" fill="#c8d8e8" />
      <rect x="25" y="34" width="9" height="4" rx="1" fill="#c8d8e8" />
    </svg>
  )
}

function BillingIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Invoice/receipt */}
      <path d="M12 6 L36 6 L36 40 L33 38 L30 40 L27 38 L24 40 L21 38 L18 40 L15 38 L12 40 Z"
        fill="#eef7f0" stroke="#3d8b5e" strokeWidth="1.5" />
      {/* Dollar sign */}
      <circle cx="24" cy="18" r="6" fill="#3d8b5e" opacity="0.15" />
      <text x="24" y="21" textAnchor="middle" fontSize="10" fill="#3d8b5e" fontWeight="700" fontFamily="Arial">$</text>
      {/* Lines */}
      <rect x="16" y="28" width="16" height="2" rx="1" fill="#a8d4b9" />
      <rect x="16" y="33" width="12" height="2" rx="1" fill="#c8ecd6" />
    </svg>
  )
}

function ReportingIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
      {/* Chart/graph */}
      <rect x="10" y="6" width="28" height="36" rx="3" fill="#f3eef8" stroke="#7c5aab" strokeWidth="1.5" />
      {/* Bar chart */}
      <rect x="15" y="28" width="5" height="10" rx="1" fill="#7c5aab" opacity="0.4" />
      <rect x="22" y="22" width="5" height="16" rx="1" fill="#7c5aab" opacity="0.6" />
      <rect x="29" y="16" width="5" height="22" rx="1" fill="#7c5aab" opacity="0.8" />
      {/* Trend line */}
      <polyline points="15,26 22,20 29,14 35,11" stroke="#7c5aab" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="35" cy="11" r="2" fill="#7c5aab" />
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
    active: true,
  },
  {
    id: 'accounting',
    title: 'Accounting',
    description: 'Track expenses, invoices and financial reports',
    icon: AccountingIcon,
    level: 3,
    color: '#4a6fa5',
    bgColor: '#f0f5fc',
    borderColor: '#c6d8f0',
    active: false,
  },
  {
    id: 'billing',
    title: 'Billing',
    description: 'Manage subscriptions, payments and client invoicing',
    icon: BillingIcon,
    level: 3,
    color: '#3d8b5e',
    bgColor: '#f0faf4',
    borderColor: '#c6f0d5',
    active: false,
  },
  {
    id: 'reporting',
    title: 'Reporting',
    description: 'Analytics dashboards, performance metrics and insights',
    icon: ReportingIcon,
    level: 3,
    color: '#7c5aab',
    bgColor: '#f8f4fc',
    borderColor: '#ddd0ee',
    active: false,
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
            const locked = userLevel < svc.level
            const inactive = !svc.active
            const disabled = locked || inactive
            const Icon = svc.icon
            return (
              <button
                key={svc.id}
                style={{
                  ...s.card,
                  background: disabled ? '#f7f8fa' : svc.bgColor,
                  borderColor: disabled ? '#e2e8f0' : svc.borderColor,
                  opacity: disabled ? 0.55 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                disabled={disabled}
                onClick={() => !disabled && onSelectService(svc.id)}
              >
                <div style={s.cardIcon}>
                  <Icon />
                </div>
                <div style={s.cardContent}>
                  <h3 style={{ ...s.cardTitle, color: disabled ? '#a0aec0' : svc.color }}>{svc.title}</h3>
                  <p style={s.cardDesc}>{svc.description}</p>
                </div>
                {!inactive && locked && (
                  <span style={s.lockBadge}>Level {svc.level} required</span>
                )}
                {!disabled && (
                  <span style={{ ...s.openBadge, background: svc.color }}>Open</span>
                )}
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
  comingSoonBadge: {
    marginTop: '8px', padding: '6px 14px', borderRadius: '8px',
    background: '#edf2f7', color: '#718096', fontSize: '11px', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  lockBadge: {
    position: 'absolute', top: '12px', right: '12px',
    fontSize: '9px', fontWeight: 700, color: '#a0aec0',
    background: '#edf2f7', padding: '3px 8px', borderRadius: '8px',
    textTransform: 'uppercase', letterSpacing: '0.3px',
  },
}
