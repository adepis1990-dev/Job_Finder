import React from 'react'

export default function AboutPage() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>About Us</h1>
        <p style={s.text}>
          Our company aims at bringing people the tools to succeed in today's modern day working environment.
        </p>
        <p style={s.text}>
          We build intelligent automation tools that help job seekers create professional documents,
          find relevant opportunities, and connect with employers efficiently.
        </p>
        <div style={s.values}>
          <div style={s.value}>
            <span style={s.valueIcon}>&#9997;</span>
            <h3 style={s.valueTitle}>AI-Powered Documents</h3>
            <p style={s.valueDesc}>Generate tailored resumes, portfolios, and cover letters in seconds</p>
          </div>
          <div style={s.value}>
            <span style={s.valueIcon}>&#128269;</span>
            <h3 style={s.valueTitle}>Smart Job Discovery</h3>
            <p style={s.valueDesc}>Scrape multiple platforms to find the right opportunities</p>
          </div>
          <div style={s.value}>
            <span style={s.valueIcon}>&#9993;</span>
            <h3 style={s.valueTitle}>Automated Outreach</h3>
            <p style={s.valueDesc}>Send personalized applications to multiple companies at once</p>
          </div>
        </div>
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
    width: '100%', maxWidth: '640px', background: '#fff', borderRadius: '16px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '48px 40px', textAlign: 'center',
  },
  title: {
    fontSize: '26px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 16px',
  },
  text: {
    fontSize: '15px', lineHeight: 1.7, color: '#4a5568', margin: '0 0 12px',
  },
  values: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: '20px', marginTop: '32px',
  },
  value: {
    padding: '20px 16px', borderRadius: '12px', background: '#f7f9fc',
    border: '1px solid #e8edf4',
  },
  valueIcon: { fontSize: '24px', display: 'block', marginBottom: '8px' },
  valueTitle: { fontSize: '13px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 4px' },
  valueDesc: { fontSize: '11px', color: '#718096', margin: 0, lineHeight: 1.4 },
}
