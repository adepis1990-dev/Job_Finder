import React from 'react'

export default function ContactPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Contact</h1>
        <p style={s.text}>
          Have questions or need support? Reach out to us.
        </p>

        <div style={s.contactCard}>
          <div style={s.contactRow}>
            <span style={s.contactIcon}>&#9993;</span>
            <div>
              <p style={s.contactLabel}>Email</p>
              <a href="mailto:adepis1990@gmail.com" style={s.contactValue}>adepis1990@gmail.com</a>
            </div>
          </div>
        </div>

        <p style={s.note}>
          We typically respond within 24 hours.
        </p>
      </div>
    </div>
  )
}

const s = {
  page: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '40px 24px',
    background: 'linear-gradient(160deg, #f0f7ff 0%, #faf5ff 30%, #f5fdf8 60%, #fff9f0 100%)',
    minHeight: 'calc(100vh - 52px)',
  },
  card: {
    width: '100%', maxWidth: '480px', background: '#fff', borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', textAlign: 'center',
  },
  title: {
    fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px',
  },
  text: {
    fontSize: '14px', color: '#718096', margin: '0 0 28px', lineHeight: 1.6,
  },
  contactCard: {
    background: '#f7f9fc', borderRadius: '12px', border: '1px solid #e8edf4',
    padding: '24px', display: 'inline-block',
  },
  contactRow: {
    display: 'flex', alignItems: 'center', gap: '14px',
  },
  contactIcon: { fontSize: '24px' },
  contactLabel: { fontSize: '11px', color: '#a0aec0', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'left' },
  contactValue: { fontSize: '15px', color: '#2563eb', fontWeight: 600, textDecoration: 'none' },
  note: {
    fontSize: '12px', color: '#a0aec0', marginTop: '24px', fontStyle: 'italic',
  },
}
