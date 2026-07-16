import React, { useState, useRef, useEffect } from 'react'
import AuthPage from './AuthPage'
import Navbar from './Navbar'
import Dashboard from './Dashboard'
import AboutPage from './AboutPage'
import ContactPage from './ContactPage'
import EmailPreview from './EmailPreview'
import ScraperPanel from './ScraperPanel'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const THEMES = [
  { id:'classic',  label:'Classic',  accent:'#1a1a2e', layout:'single-col' },
  { id:'modern',   label:'Modern',   accent:'#2563eb', layout:'banner' },
  { id:'sidebar',  label:'Sidebar',  accent:'#0f4c81', layout:'sidebar' },
  { id:'minimal',  label:'Minimal',  accent:'#111',    layout:'centered' },
  { id:'elegant',  label:'Elegant',  accent:'#7c3aed', layout:'banner' },
  { id:'original', label:'Original', accent:'#888',    layout:'single-col' },
]

function ThemeChip({ theme, selected, onClick, disabled }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick}
      style={{ ...s.chip, ...(selected ? { ...s.chipOn, borderColor: theme.accent, color: theme.accent, boxShadow: `0 0 0 3px ${theme.accent}22` } : {}), ...(disabled ? s.chipOff : {}) }}>
      <span style={{ ...s.chipDot, background: theme.accent }} />
      {theme.label}
    </button>
  )
}

export default function App() {
  const [authData, setAuthData] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentView, setCurrentView] = useState('dashboard')

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('auth_user')
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        setAuthData({ token, user })
      } catch {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
      }
    }
    setAuthLoading(false)
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    setAuthData(null)
    setCurrentView('dashboard')
  }

  if (authLoading) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e', color: '#fff', fontSize: '16px' }}>Loading...</div>
  }

  if (!authData) {
    return <AuthPage onAuth={(data) => setAuthData(data)} />
  }

  const userLevel = authData?.user?.level || 1
  const userName = authData?.user?.name || authData?.user?.username || 'User'

  // Determine which page to show (non-service pages)
  const navPage = ['dashboard', 'about', 'contact'].includes(currentView) ? currentView : null

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        currentPage={navPage || 'dashboard'}
        onNavigate={(page) => setCurrentView(page)}
        userName={userName}
        onLogout={handleLogout}
      />

      {currentView === 'dashboard' && (
        <Dashboard
          userLevel={userLevel}
          userName={userName}
          onSelectService={(svc) => setCurrentView(svc)}
          onLogout={handleLogout}
        />
      )}
      {currentView === 'about' && <AboutPage />}
      {currentView === 'contact' && <ContactPage />}
      {['resume', 'email', 'scraper'].includes(currentView) && (
        <MainApp
          authData={authData}
          onLogout={handleLogout}
          onBack={() => setCurrentView('dashboard')}
          initialView={currentView}
        />
      )}
    </div>
  )
}

function MainApp({ authData, onLogout, onBack, initialView }) {
  const userLevel = authData?.user?.level || 1
  const userName = authData?.user?.name || authData?.user?.username || 'User'

  // Show panels based on which service was selected from dashboard
  const [viewEmailer, setViewEmailer] = useState(initialView === 'email' || (initialView === 'resume' && userLevel >= 2))
  const [viewScraper, setViewScraper] = useState(initialView === 'scraper' || (initialView === 'resume' && userLevel >= 3))
  const [emailRefreshKey, setEmailRefreshKey] = useState(0)
  const [loadedRecipients, setLoadedRecipients] = useState(null)
  const [useCases, setUseCases]     = useState({})
  const [docType,  setDocType]      = useState('resume')
  const [tone,     setTone]         = useState('professional')
  const [theme,    setTheme]        = useState('classic')
  const [photoWidth, setPhotoWidth] = useState(1.0)
  const [prompt,   setPrompt]       = useState('')
  const [title,    setTitle]        = useState('')
  const [extraFields, setExtraFields] = useState({})
  const [resumeFile, setResumeFile] = useState(null)
  const [photoFile,  setPhotoFile]  = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const [editMode, setEditMode]     = useState(false)
  const [status,   setStatus]       = useState('idle')
  const [errorMsg, setErrorMsg]     = useState('')
  const [history,  setHistory]      = useState([])
  const [histOpen, setHistOpen]     = useState(false)
  const [currentDocId, setCurrentDocId] = useState(null)

  const resumeRef = useRef(null)
  const photoRef  = useRef(null)

  useEffect(() => {
    fetch(`${API}/use-cases`).then(r => r.json()).then(setUseCases).catch(() => {})
  }, [])

  useEffect(() => {
    if (histOpen) loadHistory()
  }, [histOpen, docType])

  const loadHistory = () => {
    fetch(`${API}/documents?type=${docType}`).then(r => r.json()).then(setHistory).catch(() => {})
  }

  const loadDoc = async (id) => {
    const doc = await fetch(`${API}/documents/${id}`).then(r => r.json())
    setDocType(doc.type)
    setTone(doc.tone || 'professional')
    setTheme(doc.theme || 'classic')
    setPhotoWidth(doc.photo_width || 1.0)
    setTitle(doc.title || '')
    setPrompt(doc.content || '')
    setExtraFields(doc.extra_fields || {})
    setCurrentDocId(doc.id)
    setEditMode(true)   // auto-enable targeted edit when loading from history
    setHistOpen(false)
    setStatus('idle')
  }

  const deleteDoc = async (id) => {
    await fetch(`${API}/documents/${id}`, { method: 'DELETE' })
    loadHistory()
    if (currentDocId === id) setCurrentDocId(null)
  }

  const uc = useCases[docType] || {}
  const tones = uc.tones ? Object.entries(uc.tones) : []
  const fields = uc.fields || []

  const resetForm = () => {
    setPrompt(''); setTitle(''); setExtraFields({})
    setResumeFile(null); setPhotoFile(null); setPhotoPreview(null)
    setStatus('idle'); setErrorMsg(''); setCurrentDocId(null)
  }

  const handlePhotoChange = (e) => {
    const f = e.target.files[0]; if (!f) return
    setPhotoFile(f)
    const reader = new FileReader()
    reader.onload = ev => setPhotoPreview(ev.target.result)
    reader.readAsDataURL(f)
  }

  const handleSubmit = async (e) => {
    e.preventDefault(); setErrorMsg('')
    if (!prompt.trim()) { setErrorMsg('Please describe what you want.'); setStatus('error'); return }
    setStatus('loading')
    const fd = new FormData()
    fd.append('doc_type', docType)
    fd.append('tone', tone)
    fd.append('theme', theme)
    fd.append('photo_width', photoWidth.toString())
    fd.append('prompt', prompt)
    fd.append('title', title || `${uc.label || docType} — ${new Date().toLocaleDateString()}`)
    fd.append('extra_fields', JSON.stringify(extraFields))
    fd.append('edit_mode', (editMode && !!currentDocId).toString())
    if (currentDocId) fd.append('doc_id', currentDocId)
    if (resumeFile) fd.append('file', resumeFile)
    if (photoFile)  fd.append('photo', photoFile)
    try {
      const res = await fetch(`${API}/generate`, { method: 'POST', body: fd })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.detail || `Error ${res.status}`)
      }
      const newId = res.headers.get('X-Document-Id')
      if (newId) setCurrentDocId(newId)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url
      a.download = `${docType}.pdf`; document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
      setStatus('success')
      loadHistory()
    } catch(err) {
      setErrorMsg(err.message || 'Something went wrong.')
      setStatus('error')
    }
  }

  const isLoading = status === 'loading'
  const panelCount = 1 + (viewEmailer ? 1 : 0) + (viewScraper ? 1 : 0)

  return (
    <div style={s.page}>
      <div style={panelCount > 1 ? { ...s.splitContainer, maxWidth: panelCount === 3 ? '1900px' : '1300px' } : s.singleContainer}>
        {/* Left side — main form */}
        <div style={panelCount > 1 ? s.splitLeft : { width: '100%' }}>
          <div style={s.card}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <h1 style={s.title}>AI Document Builder</h1>
            <p style={s.subtitle}>Resume · Portfolio · Intention Letter</p>
          </div>
        </div>

        {/* Doc type tabs */}
        <div style={s.tabs}>
          {Object.entries(useCases).map(([key, cfg]) => (
            <button key={key} type="button"
              style={{ ...s.tab, ...(docType === key ? s.tabOn : s.tabOff) }}
              onClick={() => { setDocType(key); setTone('professional'); resetForm() }}>
              {cfg.icon} {cfg.label}
            </button>
          ))}
          {/* history button */}
          <button type="button" style={{ ...s.tab, ...s.tabOff, marginLeft: 'auto' }}
            onClick={() => setHistOpen(h => !h)}>
            🕓 History
          </button>
        </div>

        {/* Mode banner — shown when editing a saved doc */}
        {currentDocId && (
          <div style={s.modeBanner}>
            <div style={s.modeBannerLeft}>
              <span style={s.modeBannerIcon}>✏️</span>
              <div style={s.modeBannerText}>
                <span style={s.modeBannerLabel}>Editing saved document</span>
                <span style={s.modeBannerTitle}>{title || 'Untitled'}</span>
              </div>
            </div>
            <div style={s.modeBannerActions}>
              <button type="button"
                style={{ ...s.modeModeBtn, ...(editMode ? {} : s.modeModeBtnOn) }}
                onClick={() => setEditMode(false)}>
                🔄 Full Rewrite
              </button>
              <button type="button"
                style={{ ...s.modeModeBtn, ...(editMode ? s.modeModeBtnOn : {}) }}
                onClick={() => setEditMode(true)}>
                ✏️ Targeted Edit
              </button>
              <button type="button" style={s.modeNewBtn} onClick={resetForm}
                title="Discard and start a new document">
                ✕ New
              </button>
            </div>
            <p style={s.modeBannerHint}>
              {editMode
                ? 'Only the lines you describe will change. Everything else stays.'
                : 'The whole document will be rewritten from scratch with your instructions.'}
            </p>
          </div>
        )}

        {/* History panel */}
        {histOpen && (
          <div style={s.histPanel}>
            <p style={s.histTitle}>Saved {uc.label || docType}s</p>
            {history.length === 0
              ? <p style={s.histEmpty}>No saved documents yet.</p>
              : history.map(doc => (
                <div key={doc.id} style={s.histRow}>
                  <div style={s.histMeta}>
                    <span style={s.histName}>{doc.title}</span>
                    <span style={s.histDate}>{new Date(doc.updated_at).toLocaleDateString()}</span>
                  </div>
                  <div style={s.histActions}>
                    <button style={s.histLoad} onClick={() => loadDoc(doc.id)}>Load</button>
                    <button style={s.histDel}  onClick={() => deleteDoc(doc.id)}>✕</button>
                  </div>
                </div>
              ))}
          </div>
        )}

        <form onSubmit={handleSubmit} style={s.form}>

          {/* Title */}
          <div style={s.section}>
            <label style={s.label}>Document Title</label>
            <input style={s.input} value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder={`e.g. My ${uc.label || docType} — July 2026`} />
          </div>

          {/* Type-specific extra fields */}
          {fields.map(f => (
            <div key={f.key} style={s.section}>
              <label style={s.label}>{f.label}</label>
              {f.key === 'job_description'
                ? <textarea style={{ ...s.textarea, minHeight: 80 }} rows={3}
                    value={extraFields[f.key] || ''} placeholder={f.placeholder}
                    onChange={e => setExtraFields(ef => ({ ...ef, [f.key]: e.target.value }))} />
                : <input style={s.input} value={extraFields[f.key] || ''} placeholder={f.placeholder}
                    onChange={e => setExtraFields(ef => ({ ...ef, [f.key]: e.target.value }))} />}
            </div>
          ))}

          {/* PDF upload */}
          <div style={s.section}>
            <label style={s.label}>
              {docType === 'resume' ? 'Upload Existing Resume' : 'Upload Source PDF'}
              <span style={s.optional}> (optional)</span>
            </label>
            <div style={{ ...s.dropzone, ...(dragOver ? s.dzActive : {}), ...(resumeFile ? s.dzFilled : {}) }}
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setDragOver(false)
                const f = e.dataTransfer.files[0]
                if (f?.type === 'application/pdf') { setResumeFile(f); setStatus('idle') }
                else { setErrorMsg('Please drop a PDF.'); setStatus('error') }
              }}
              onClick={() => resumeRef.current.click()}>
              {resumeFile
                ? <span style={s.fileName}>📄 {resumeFile.name}</span>
                : <span style={s.dropHint}>Drag & drop PDF<br/><small>or tap to browse</small></span>}
              <input ref={resumeRef} type="file" accept=".pdf" style={{ display:'none' }}
                onChange={e => { setResumeFile(e.target.files[0]); setStatus('idle') }} />
            </div>
            {resumeFile && <button type="button" style={s.clearBtn}
              onClick={() => setResumeFile(null)}>Remove</button>}
          </div>

          {/* Photo upload + size */}
          <div style={s.section}>
            <label style={s.label}>Profile Photo <span style={s.optional}>(optional)</span></label>
            <div style={s.photoRow}>
              <div style={s.photoBox} onClick={() => photoRef.current.click()}>
                {photoPreview
                  ? <img src={photoPreview} alt="preview" style={s.photoImg} />
                  : <span style={s.photoPlaceholder}>👤<br/><small>Upload</small></span>}
                <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }}
                  onChange={handlePhotoChange} />
              </div>
              <div style={s.photoInfo}>
                {photoFile
                  ? <><span style={s.fileName}>🖼️ {photoFile.name}</span>
                      <button type="button" style={s.clearBtn}
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}>Remove</button></>
                  : <p style={s.photoHint}>Leave empty to auto-extract from PDF, or upload a new one.</p>}
              </div>
            </div>
            <div style={s.sliderRow}>
              <span style={s.sliderLabel}>Photo size</span>
              <input type="range" min="0.6" max="2.0" step="0.1"
                value={photoWidth} onChange={e => setPhotoWidth(parseFloat(e.target.value))}
                style={s.slider} />
              <span style={s.sliderVal}>{photoWidth.toFixed(1)}"</span>
            </div>
          </div>

          {/* Tone picker */}
          <div style={s.section}>
            <label style={s.label}>Tone</label>
            <div style={s.chipRow}>
              {tones.map(([key, cfg]) => (
                <ThemeChip key={key}
                  theme={{ id: key, label: cfg.label, accent: '#1a1a2e' }}
                  selected={tone === key}
                  onClick={() => setTone(key)} />
              ))}
            </div>
          </div>

          {/* Theme picker */}
          <div style={s.section}>
            <label style={s.label}>Theme</label>
            <div style={s.chipRow}>
              {THEMES.map(t => (
                <ThemeChip key={t.id} theme={t} selected={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  disabled={t.id === 'original' && !resumeFile} />
              ))}
            </div>
            {theme === 'original' && !resumeFile &&
              <p style={{ ...s.photoHint, color: '#e53e3e' }}>Upload a PDF to use the Original theme.</p>}
          </div>

          {/* Prompt */}
          <div style={s.section}>
            <label style={s.label}>
              {currentDocId
                ? editMode ? 'What specifically do you want to change?' : 'Instructions for the full rewrite'
                : docType === 'resume'    ? 'What do you want to change or highlight?'
                : docType === 'portfolio' ? 'Describe your projects or what to showcase'
                : 'Additional notes for your letter'}
            </label>
            <textarea style={s.textarea} rows={4} value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={
                currentDocId
                  ? editMode
                    ? 'e.g. Make my job title bold, or: add Python to the skills section'
                    : 'e.g. Rewrite everything for a Senior Data Analyst role at Google'
                  : docType === 'resume'    ? 'e.g. Tailor to a Senior Data Analyst role, highlight Python skills'
                  : docType === 'portfolio' ? 'e.g. Focus on my ML projects and open source contributions'
                  : 'e.g. Mention my passion for sustainable tech and 3 years at Acme Corp'} />
          </div>

          {status === 'error' && (
            <div style={s.errorBox}>
              {errorMsg.split('\n').map((line, i) => (
                <div key={i} style={i > 0 ? { marginTop: 4, fontFamily: 'monospace', fontSize: 12 } : {}}>
                  {i === 0 ? '⚠️ ' : ''}{line}
                </div>
              ))}
            </div>
          )}
          {status === 'success' && (
            <div style={s.successBox}>
              ✅ Generated and downloaded!
              {currentDocId && <span style={{ marginLeft: 8, fontSize: 12 }}>Saved to history ✓</span>}
            </div>
          )}

          <div style={s.btnRow}>
            <button type="submit"
              style={{ ...s.submitBtn, ...(isLoading ? s.submitOff : {}), flex: 1 }}
              disabled={isLoading}>
              {isLoading
                ? '⏳ AI is writing…'
                : currentDocId
                  ? editMode ? '✏️ Apply Edit & Download →' : '🔄 Rewrite & Download →'
                  : `Generate & Download →`}
            </button>
          </div>

        </form>
      </div>
      </div>

      {/* Right side — email preview */}
      {userLevel >= 2 && viewEmailer && (
        <div style={s.splitPanel}>
          <EmailPreview refreshKey={emailRefreshKey} loadedRecipients={loadedRecipients} />
        </div>
      )}

      {/* Right side — scraper panel */}
      {userLevel >= 3 && viewScraper && (
        <div style={s.splitPanel}>
          <ScraperPanel onLoadRecipients={(data) => setLoadedRecipients(data)} />
        </div>
      )}
      </div>

      {/* Navigation + Toggle buttons */}
      <div style={s.toggleRow}>
        <button type="button" style={s.navBtn} onClick={onBack}>
          ← Back
        </button>
        {userLevel >= 2 && (
          <button type="button" style={{ ...s.emailerToggle, ...(viewEmailer ? s.toggleActive : {}) }}
            onClick={() => setViewEmailer(v => !v)}>
            {viewEmailer ? '✕ Email' : '📧 Email'}
          </button>
        )}
        {userLevel >= 3 && (
          <button type="button" style={{ ...s.emailerToggle, ...(viewScraper ? s.toggleActive : {}) }}
            onClick={() => setViewScraper(v => !v)}>
            {viewScraper ? '✕ Job Finder' : '🕷️ Job Finder'}
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  page: { minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center',
    padding:'24px 16px 48px', background:'linear-gradient(135deg,#e8eaf6 0%,#f0f2f5 100%)' },
  singleContainer: { width:'100%', maxWidth:'640px', display:'flex', justifyContent:'center' },
  splitContainer: { width:'100%', maxWidth:'1900px', display:'flex', gap:'20px', alignItems:'flex-start' },
  splitLeft: { flex:1, minWidth:0 },
  splitPanel: { flex:1, minWidth:0, position:'sticky', top:'24px', maxHeight:'calc(100vh - 48px)', overflowY:'auto' },
  toggleRow: { position:'fixed', bottom:'20px', right:'20px', zIndex:1000, display:'flex', gap:'8px' },
  navBtn: { padding:'10px 16px', borderRadius:'24px', border:'none', cursor:'pointer',
    background:'#fff', color:'#1a1a2e', fontSize:'12px', fontWeight:600,
    boxShadow:'0 4px 16px rgba(0,0,0,0.12)' },
  emailerToggle: { padding:'10px 16px', borderRadius:'24px', border:'none', cursor:'pointer',
    background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)', color:'#fff',
    fontSize:'12px', fontWeight:600, boxShadow:'0 4px 16px rgba(0,0,0,0.2)' },
  toggleActive: { background:'linear-gradient(135deg,#e53e3e 0%,#c53030 100%)' },
  card: { width:'100%', background:'#fff', borderRadius:'16px',
    boxShadow:'0 4px 24px rgba(0,0,0,0.10)', overflow:'hidden' },
  header: { background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)', padding:'28px 28px 22px',
    display:'flex', justifyContent:'space-between', alignItems:'flex-start' },
  title:  { color:'#fff', fontSize:'22px', fontWeight:700, margin:0 },
  subtitle: { color:'#a0aec0', fontSize:'13px', marginTop:'4px' },
  logoutBtn: { padding:'6px 14px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.3)',
    background:'none', color:'#a0aec0', fontSize:'12px', fontWeight:600, cursor:'pointer' },
  backBtn: { padding:'6px 12px', borderRadius:'6px', border:'1px solid rgba(255,255,255,0.25)',
    background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:'11px', fontWeight:600,
    cursor:'pointer', whiteSpace:'nowrap' },
  tabs: { display:'flex', borderBottom:'1px solid #e2e8f0', overflowX:'auto' },
  tab: { padding:'12px 16px', border:'none', cursor:'pointer', fontSize:'13px',
    fontWeight:600, whiteSpace:'nowrap', flexShrink:0 },
  tabOn:  { background:'#fff', color:'#1a1a2e', borderBottom:'2px solid #1a1a2e' },
  tabOff: { background:'#f7f8fa', color:'#718096', borderBottom:'2px solid transparent' },
  histPanel: { background:'#f7f8fa', borderBottom:'1px solid #e2e8f0', padding:'12px 24px', maxHeight:240, overflowY:'auto' },
  histTitle: { fontSize:'12px', fontWeight:700, color:'#4a5568', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 },
  histEmpty: { fontSize:'13px', color:'#a0aec0', textAlign:'center', padding:'12px 0' },
  histRow: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #e2e8f0' },
  histMeta: { display:'flex', flexDirection:'column', gap:2 },
  histName: { fontSize:'13px', fontWeight:600, color:'#2d3748' },
  histDate: { fontSize:'11px', color:'#a0aec0' },
  histActions: { display:'flex', gap:6 },
  histLoad: { padding:'4px 10px', border:'1px solid #1a1a2e', borderRadius:6, background:'none',
    color:'#1a1a2e', fontSize:'12px', cursor:'pointer', fontWeight:600 },
  histDel: { padding:'4px 8px', border:'1px solid #feb2b2', borderRadius:6, background:'none',
    color:'#e53e3e', fontSize:'12px', cursor:'pointer' },
  form: { padding:'24px', display:'flex', flexDirection:'column', gap:'20px' },
  section: { display:'flex', flexDirection:'column', gap:'7px' },
  label: { fontSize:'11px', fontWeight:700, color:'#4a5568', textTransform:'uppercase', letterSpacing:'0.6px' },
  optional: { fontWeight:400, textTransform:'none', color:'#a0aec0', fontSize:'11px' },
  input: { padding:'10px 12px', borderRadius:'8px', border:'1px solid #e2e8f0',
    fontSize:'14px', color:'#2d3748', outline:'none', fontFamily:'inherit', background:'#fafafa' },
  dropzone: { borderWidth:'2px', borderStyle:'dashed', borderColor:'#cbd5e0', borderRadius:'10px', padding:'22px 16px',
    textAlign:'center', cursor:'pointer', background:'#f7f8fa',
    display:'flex', alignItems:'center', justifyContent:'center' },
  dzActive: { borderColor:'#667eea', borderStyle:'dashed', borderWidth:'2px', background:'#ebf4ff' },
  dzFilled: { borderColor:'#48bb78', borderStyle:'dashed', borderWidth:'2px', background:'#f0fff4' },
  dropHint: { color:'#718096', fontSize:'14px', lineHeight:'1.6' },
  fileName: { color:'#2d7d46', fontWeight:600, fontSize:'14px', wordBreak:'break-all' },
  clearBtn: { alignSelf:'flex-start', background:'none', border:'none', color:'#e53e3e',
    fontSize:'12px', cursor:'pointer', textDecoration:'underline', padding:'2px 0' },
  photoRow: { display:'flex', gap:'14px', alignItems:'flex-start' },
  photoBox: { width:'72px', height:'72px', borderRadius:'10px', borderWidth:'2px', borderStyle:'dashed', borderColor:'#cbd5e0',
    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
    overflow:'hidden', flexShrink:0, background:'#f7f8fa' },
  photoImg: { width:'100%', height:'100%', objectFit:'cover' },
  photoPlaceholder: { color:'#a0aec0', fontSize:'11px', textAlign:'center', lineHeight:1.5 },
  photoInfo: { display:'flex', flexDirection:'column', gap:'6px', justifyContent:'center' },
  photoHint: { color:'#718096', fontSize:'12px', lineHeight:'1.5', margin:0 },
  sliderRow: { display:'flex', alignItems:'center', gap:'10px', marginTop:'4px' },
  sliderLabel: { fontSize:'12px', color:'#718096', whiteSpace:'nowrap', minWidth:'70px' },
  slider: { flex:1, cursor:'pointer', accentColor:'#1a1a2e' },
  sliderVal: { fontSize:'12px', fontWeight:700, color:'#1a1a2e', minWidth:'30px' },
  chipRow: { display:'flex', flexWrap:'wrap', gap:'8px' },
  chip: { padding:'6px 14px', borderRadius:'20px', borderWidth:'1.5px', borderStyle:'solid', borderColor:'#e2e8f0',
    background:'#fafafa', cursor:'pointer', fontSize:'12px', fontWeight:600,
    color:'#4a5568', display:'flex', alignItems:'center', gap:'6px' },
  chipOn: { background:'#fff' },
  chipOff: { opacity:0.35, cursor:'not-allowed' },
  chipDot: { width:8, height:8, borderRadius:'50%', flexShrink:0 },
  textarea: { width:'100%', padding:'12px 14px', borderRadius:'8px',
    border:'1px solid #e2e8f0', fontSize:'14px', lineHeight:'1.6',
    color:'#2d3748', resize:'vertical', outline:'none', fontFamily:'inherit', background:'#fafafa' },
  errorBox:   { background:'#fff5f5', border:'1px solid #feb2b2', borderRadius:'8px', padding:'12px 14px', color:'#c53030', fontSize:'13px' },
  successBox: { background:'#f0fff4', border:'1px solid #9ae6b4', borderRadius:'8px', padding:'12px 14px', color:'#276749', fontSize:'13px', display:'flex', alignItems:'center' },
  btnRow: { display:'flex', gap:'10px' },
  submitBtn: { padding:'14px', background:'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
    color:'#fff', border:'none', borderRadius:'10px', fontSize:'15px', fontWeight:700, cursor:'pointer' },
  submitOff: { opacity:0.6, cursor:'not-allowed' },
  editToggleRow: { display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap',
    padding:'10px 12px', background:'#f0f4ff', borderRadius:'8px', border:'1px solid #dde5ff' },
  editToggleLabel: { fontSize:'11px', fontWeight:700, color:'#4a5568', textTransform:'uppercase', letterSpacing:'0.5px' },
  editToggleBtn: { padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #cbd5e0',
    background:'#fff', color:'#718096', fontSize:'12px', fontWeight:600, cursor:'pointer' },
  editToggleBtnOn: { border:'1.5px solid #1a1a2e', background:'#1a1a2e', color:'#fff' },
  editToggleHint: { fontSize:'11px', color:'#718096', fontStyle:'italic' },
  secondaryBtn: { padding:'14px 18px', background:'none', border:'1.5px solid #1a1a2e',
    color:'#1a1a2e', borderRadius:'10px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  // Mode banner
  modeBanner: { background:'linear-gradient(135deg,#f0f4ff 0%,#eef2ff 100%)',
    borderBottom:'2px solid #c7d2fe', padding:'14px 24px 10px', display:'flex',
    flexDirection:'column', gap:'8px' },
  modeBannerLeft: { display:'flex', alignItems:'center', gap:'10px' },
  modeBannerIcon: { fontSize:'18px', flexShrink:0 },
  modeBannerText: { display:'flex', flexDirection:'column', gap:'1px' },
  modeBannerLabel: { fontSize:'10px', fontWeight:700, color:'#6366f1',
    textTransform:'uppercase', letterSpacing:'0.6px' },
  modeBannerTitle: { fontSize:'14px', fontWeight:700, color:'#1e1b4b',
    whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'320px' },
  modeBannerActions: { display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' },
  modeModeBtn: { padding:'5px 12px', borderRadius:'6px', border:'1.5px solid #c7d2fe',
    background:'#fff', color:'#6366f1', fontSize:'12px', fontWeight:600, cursor:'pointer' },
  modeModeBtnOn: { border:'1.5px solid #4f46e5', background:'#4f46e5', color:'#fff' },
  modeNewBtn: { marginLeft:'auto', padding:'5px 12px', borderRadius:'6px',
    border:'1.5px solid #fca5a5', background:'none', color:'#dc2626',
    fontSize:'12px', fontWeight:600, cursor:'pointer' },
  modeBannerHint: { fontSize:'11px', color:'#6366f1', fontStyle:'italic', margin:0 },
}
