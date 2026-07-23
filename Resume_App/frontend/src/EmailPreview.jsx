import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export default function EmailPreview({ refreshKey, loadedRecipients }) {
  const [data, setData] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedRecipient, setExpandedRecipient] = useState(null)
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState(null)

  // Gmail OAuth state
  const [gmailConnected, setGmailConnected] = useState(false)
  const [gmailEmail, setGmailEmail] = useState('')
  const [gmailTokens, setGmailTokens] = useState(null)

  // Check for stored Gmail tokens on mount
  useEffect(() => {
    const stored = localStorage.getItem('gmail_tokens')
    if (stored) {
      try {
        const tokens = JSON.parse(stored)
        setGmailTokens(tokens)
        setGmailConnected(true)
        setGmailEmail(tokens.email || '')
      } catch {}
    }
  }, [])

  // Listen for OAuth callback message from popup
  useEffect(() => {
    const handler = (event) => {
      if (event.data?.type === 'gmail-oauth-callback' && event.data.code) {
        // Exchange code for tokens
        const fd = new FormData()
        fd.append('code', event.data.code)
        fetch(`${API}/gmail/callback`, { method: 'POST', body: fd })
          .then(r => r.json())
          .then(tokens => {
            setGmailTokens(tokens)
            setGmailConnected(true)
            setGmailEmail(tokens.email || '')
            localStorage.setItem('gmail_tokens', JSON.stringify(tokens))
          })
          .catch(e => alert('Gmail connection failed: ' + e.message))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const connectGmail = async () => {
    try {
      const res = await fetch(`${API}/gmail/auth-url`)
      const { auth_url } = await res.json()
      // Open popup for Google consent
      const popup = window.open(auth_url, 'gmail-oauth', 'width=500,height=600,scrollbars=yes')
      // The popup will redirect to our callback page which posts message back
    } catch (e) {
      alert('Could not start Gmail connection: ' + e.message)
    }
  }

  const disconnectGmail = () => {
    setGmailConnected(false)
    setGmailEmail('')
    setGmailTokens(null)
    localStorage.removeItem('gmail_tokens')
  }

  const authHeaders = { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }

  const loadData = () => {
    Promise.all([
      fetch(`${API}/email-preview`, { headers: authHeaders }).then(r => r.json()),
      fetch(`${API}/attachments`, { headers: authHeaders }).then(r => r.json()),
    ])
      .then(([preview, atts]) => {
        setData(preview)
        setAttachments(atts)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { loadData() }, [])

  // Refresh when scraper completes (refreshKey changes)
  useEffect(() => {
    if (refreshKey > 0) loadData()
  }, [refreshKey])

  // When loadedRecipients changes, override the recipients in data
  useEffect(() => {
    if (loadedRecipients && loadedRecipients.recipients) {
      setData(prev => prev ? {
        ...prev,
        recipients: loadedRecipients.recipients,
        total_recipients: loadedRecipients.total,
        _loaded_source: loadedRecipients.source_label,
      } : prev)
    }
  }, [loadedRecipients])

  const refreshAttachments = () => {
    fetch(`${API}/attachments`, { headers: authHeaders }).then(r => r.json()).then(setAttachments).catch(() => {})
  }

  const deleteAttachment = async (id) => {
    await fetch(`${API}/attachments/${id}`, { method: 'DELETE', headers: authHeaders })
    refreshAttachments()
  }

  const removeRecipient = async (email) => {
    // If recipients were loaded from scraper (not from default file), just remove locally
    if (data._loaded_source) {
      setData(prev => ({
        ...prev,
        recipients: prev.recipients.filter(r => r.email !== email),
        total_recipients: prev.total_recipients - 1,
      }))
      return
    }
    // Otherwise try to remove from rezultate_all.json via backend
    try {
      const res = await fetch(`${API}/recipients/${encodeURIComponent(email)}`, { method: 'DELETE' })
      if (res.ok) {
        setData(prev => ({
          ...prev,
          recipients: prev.recipients.filter(r => r.email !== email),
          total_recipients: prev.total_recipients - 1,
        }))
      } else {
        // If not found in file, still remove from local display
        setData(prev => ({
          ...prev,
          recipients: prev.recipients.filter(r => r.email !== email),
          total_recipients: prev.total_recipients - 1,
        }))
      }
    } catch (e) {
      // On error, remove locally anyway
      setData(prev => ({
        ...prev,
        recipients: prev.recipients.filter(r => r.email !== email),
        total_recipients: prev.total_recipients - 1,
      }))
    }
  }

  const handleSendEmails = async (testMode = false) => {
    if (!testMode && !window.confirm(
      `Are you sure you want to send ${data.total_recipients} emails? This action is irreversible.`
    )) return
    setSending(true)
    setSendResult(null)
    try {
      if (gmailConnected && gmailTokens) {
        // Send via Gmail OAuth
        const recipients = testMode
          ? [{ email: gmailEmail, companyName: 'your company' }]
          : data.recipients.filter(r => r.email && !r.email.includes('no email found'))

        const fd = new FormData()
        fd.append('access_token', gmailTokens.access_token)
        if (gmailTokens.refresh_token) fd.append('refresh_token', gmailTokens.refresh_token)
        fd.append('recipients_json', JSON.stringify(recipients))
        fd.append('subject', data.subject || 'Job Application')
        fd.append('body_html', data.body_html || '')

        const res = await fetch(`${API}/gmail/send-bulk`, {
          method: 'POST', body: fd, headers: authHeaders
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result.detail || 'Gmail send failed')
        setSendResult(result)
      } else {
        // Fallback: SMTP send
        const res = await fetch(`${API}/send-emails?test_mode=${testMode}`, { method: 'POST', headers: authHeaders })
        const result = await res.json()
        if (!res.ok) throw new Error(result.detail || 'Send failed')
        setSendResult(result)
      }
    } catch (e) {
      setSendResult({ error: e.message })
    } finally {
      setSending(false)
    }
  }

  if (loading) return <div style={s.container}><p style={s.loadingText}>Loading preview...</p></div>
  if (error) return <div style={s.container}><p style={s.errorText}>Error: {error}</p></div>
  if (!data) return null

  const bodyPreview = data.body_html
    ? data.body_html
        .replace(/\{companyName\}/g, 'your company')
        .replace(/\{fromName\}/g, data.from_name || '[Name]')
    : ''

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>📧 Email Preview</h2>
        <span style={s.badge}>
          {gmailConnected ? `✓ ${gmailEmail}` : data.configured ? '✓ Configured' : '⚠ Connect Gmail to send'}
        </span>
      </div>

      {/* Gmail connect */}
      <div style={s.gmailSection}>
        {gmailConnected ? (
          <div style={s.gmailConnected}>
            <span style={s.gmailLabel}>📨 Sending as <strong>{gmailEmail}</strong></span>
            <button style={s.gmailDisconnect} onClick={disconnectGmail}>Disconnect</button>
          </div>
        ) : (
          <button style={s.gmailConnect} onClick={connectGmail}>
            Connect Gmail
          </button>
        )}
      </div>

      {/* Config section */}
      <div style={s.section}>
        <div style={s.fieldRow}>
          <span style={s.fieldLabel}>From:</span>
          <span style={s.fieldValue}>
            {gmailConnected ? gmailEmail : (data.from_name ? `${data.from_name} <${data.from_email}>` : '—')}
          </span>
        </div>
        <div style={s.fieldRow}>
          <span style={s.fieldLabel}>Subject:</span>
          <span style={s.fieldValue}>{data.subject || 'Job Application'}</span>
        </div>
      </div>

      {/* Body preview */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Email body</p>
        <div style={s.emailBody} dangerouslySetInnerHTML={{ __html: bodyPreview }} />
      </div>

      {/* Attachments from Supabase */}
      <div style={s.section}>
        <p style={s.sectionTitle}>
          Attachments ({attachments.length})
        </p>
        {attachments.length === 0 ? (
          <p style={s.emptyText}>No attachments yet. Generate a CV or Cover Letter to save it automatically.</p>
        ) : (
          <div style={s.attachmentList}>
            {attachments.map(att => (
              <div key={att.id} style={s.attachmentRow}>
                <div style={s.attachmentInfo}>
                  <span style={s.attachmentIcon}>
                    {att.file_type === 'cv' ? '📄' : att.file_type === 'cover_letter' ? '✉️' : '📎'}
                  </span>
                  <div style={s.attachmentMeta}>
                    <span style={s.attachmentName}>{att.file_name}</span>
                    <span style={s.attachmentDetails}>
                      {att.file_type} · {att.file_size ? `${(att.file_size / 1024).toFixed(0)} KB` : '—'} · {new Date(att.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div style={s.attachmentActions}>
                  <a href={att.url} target="_blank" rel="noopener noreferrer" style={s.attachmentLink}>↓</a>
                  <button style={s.attachmentDel} onClick={() => deleteAttachment(att.id)}>✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipients */}
      <div style={s.section}>
        <p style={s.sectionTitle}>
          Recipients ({data.total_recipients})
          {data._loaded_source && (
            <span style={{ marginLeft: 8, color: '#2563eb', fontWeight: 700, textTransform: 'none', letterSpacing: 0 }}>
              — {data._loaded_source}
            </span>
          )}
        </p>
        <div style={s.recipientList}>
          {data.recipients.map((r, i) => (
            <div key={i} style={s.recipientRow}
              onClick={() => setExpandedRecipient(expandedRecipient === i ? null : i)}>
              <div style={s.recipientMain}>
                <span style={s.recipientIndex}>{i + 1}.</span>
                <div style={s.recipientInfo}>
                  <span style={s.recipientName}>{r.companyName}</span>
                  <span style={s.recipientEmail}>{r.email}</span>
                </div>
                <span style={s.recipientSource}>{r.source}</span>
                <button style={s.recipientDel}
                  title="Remove recipient"
                  onClick={(e) => { e.stopPropagation(); removeRecipient(r.email) }}>
                  ✕
                </button>
              </div>
              {expandedRecipient === i && (
                <div style={s.recipientExpanded}>
                  <p style={s.expandedLabel}>Personalized subject:</p>
                  <p style={s.expandedValue}>{data.subject}</p>
                  <p style={s.expandedLabel}>Body will contain:</p>
                  <p style={s.expandedValue}>...at <strong>{r.companyName}</strong>...</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Send result */}
      {sendResult && (
        <div style={s.section}>
          {sendResult.error ? (
            <div style={s.sendError}>⚠️ {sendResult.error}</div>
          ) : (
            <div style={s.sendSuccess}>
              ✅ Sent: {sendResult.sent}/{sendResult.total}
              {sendResult.failed > 0 && (
                <span style={{ color: '#e53e3e', marginLeft: 8 }}>
                  ({sendResult.failed} failed)
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Send buttons */}
      <div style={s.sendSection}>
        <button style={s.sendTestBtn}
          disabled={sending || (!data.configured && !gmailConnected)}
          onClick={() => handleSendEmails(true)}>
          {sending ? '⏳...' : '🧪 Test (to self)'}
        </button>
        <button style={s.sendAllBtn}
          disabled={sending || (!data.configured && !gmailConnected) || data.total_recipients === 0}
          onClick={() => handleSendEmails(false)}>
          {sending ? '⏳ Sending...' : `📤 Send ${data.total_recipients} emails`}
        </button>
      </div>

      {/* Summary footer */}
      <div style={s.footer}>
        <span>📊 {data.total_recipients} emails</span>
        <span>⏱ ~{Math.ceil((data.total_recipients * 2) / 60)} min estimated</span>
      </div>
    </div>
  )
}

const s = {
  container: {
    height: '100%', display: 'flex', flexDirection: 'column',
    background: '#fff', borderRadius: '12px', overflow: 'hidden',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
  },
  loadingText: { padding: 24, color: '#718096', textAlign: 'center' },
  errorText: { padding: 24, color: '#e53e3e', textAlign: 'center' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px 20px', background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
  },
  title: { color: '#fff', fontSize: '16px', fontWeight: 700, margin: 0 },
  badge: {
    padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
    background: 'rgba(255,255,255,0.15)', color: '#a0e8af',
  },
  section: {
    padding: '14px 20px', borderBottom: '1px solid #f0f0f0',
  },
  sectionTitle: {
    fontSize: '11px', fontWeight: 700, color: '#4a5568',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, marginTop: 0,
  },
  fieldRow: {
    display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6,
  },
  fieldLabel: {
    fontSize: '12px', fontWeight: 700, color: '#4a5568', minWidth: 55, flexShrink: 0,
  },
  fieldValue: {
    fontSize: '13px', color: '#2d3748', wordBreak: 'break-all',
  },
  emailBody: {
    background: '#f9fafb', border: '1px solid #e2e8f0', borderRadius: 8,
    padding: '12px 14px', fontSize: '13px', lineHeight: 1.6, color: '#333',
    maxHeight: 180, overflowY: 'auto',
  },
  recipientList: {
    maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
  },
  recipientRow: {
    padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #f0f0f0', background: '#fafafa',
    transition: 'background 0.15s',
  },
  recipientMain: {
    display: 'flex', alignItems: 'center', gap: 8,
  },
  recipientIndex: {
    fontSize: '11px', color: '#a0aec0', fontWeight: 600, minWidth: 20,
  },
  recipientInfo: {
    display: 'flex', flexDirection: 'column', flex: 1, gap: 1,
  },
  recipientName: {
    fontSize: '13px', fontWeight: 600, color: '#2d3748',
  },
  recipientEmail: {
    fontSize: '11px', color: '#718096',
  },
  recipientSource: {
    fontSize: '10px', color: '#a0aec0', background: '#edf2f7',
    padding: '2px 6px', borderRadius: 4, whiteSpace: 'nowrap',
  },
  recipientDel: {
    marginLeft: 6, padding: '2px 6px', borderRadius: 4,
    border: '1px solid #feb2b2', background: 'none',
    color: '#e53e3e', fontSize: '11px', cursor: 'pointer',
    flexShrink: 0, lineHeight: 1,
  },
  recipientExpanded: {
    marginTop: 8, paddingTop: 8, borderTop: '1px solid #e2e8f0',
  },
  expandedLabel: {
    fontSize: '10px', fontWeight: 700, color: '#718096', margin: '4px 0 2px',
    textTransform: 'uppercase',
  },
  expandedValue: {
    fontSize: '12px', color: '#2d3748', margin: '0 0 4px',
  },
  footer: {
    marginTop: 'auto', padding: '12px 20px',
    background: '#f7f8fa', borderTop: '1px solid #e2e8f0',
    display: 'flex', justifyContent: 'space-between',
    fontSize: '12px', color: '#718096', fontWeight: 600,
  },
  emptyText: {
    fontSize: '12px', color: '#a0aec0', fontStyle: 'italic', margin: 0,
  },
  attachmentList: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  attachmentRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px', borderRadius: 6, background: '#f0fff4',
    border: '1px solid #c6f6d5',
  },
  attachmentInfo: {
    display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0,
  },
  attachmentIcon: { fontSize: '16px', flexShrink: 0 },
  attachmentMeta: {
    display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0,
  },
  attachmentName: {
    fontSize: '12px', fontWeight: 600, color: '#276749',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  attachmentDetails: {
    fontSize: '10px', color: '#68d391',
  },
  attachmentActions: {
    display: 'flex', gap: 6, flexShrink: 0,
  },
  attachmentLink: {
    padding: '3px 8px', borderRadius: 4, background: '#276749',
    color: '#fff', fontSize: '12px', fontWeight: 700, textDecoration: 'none',
  },
  attachmentDel: {
    padding: '3px 6px', borderRadius: 4, border: '1px solid #feb2b2',
    background: 'none', color: '#e53e3e', fontSize: '11px', cursor: 'pointer',
  },
  sendSection: {
    padding: '14px 20px', borderTop: '1px solid #e2e8f0',
    display: 'flex', gap: 8,
  },
  sendTestBtn: {
    padding: '10px 14px', borderRadius: 8, border: '1.5px solid #1a1a2e',
    background: 'none', color: '#1a1a2e', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  sendAllBtn: {
    flex: 1, padding: '10px 14px', borderRadius: 8, border: 'none',
    background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
    color: '#fff', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
  },
  sendError: {
    background: '#fff5f5', border: '1px solid #feb2b2', borderRadius: 8,
    padding: '10px 12px', color: '#c53030', fontSize: '12px',
  },
  sendSuccess: {
    background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8,
    padding: '10px 12px', color: '#276749', fontSize: '12px', fontWeight: 600,
  },
  gmailSection: {
    padding: '10px 20px', borderBottom: '1px solid #f0f0f0',
    display: 'flex', alignItems: 'center',
  },
  gmailConnect: {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: '#4285f4', color: '#fff', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer', width: '100%',
  },
  gmailConnected: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', gap: 8,
  },
  gmailLabel: {
    fontSize: '12px', color: '#276749',
  },
  gmailDisconnect: {
    padding: '4px 10px', borderRadius: 4, border: '1px solid #feb2b2',
    background: 'none', color: '#e53e3e', fontSize: '11px', cursor: 'pointer',
  },
}
