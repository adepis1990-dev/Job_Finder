import React, { useState, useEffect } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const IS_LOCAL = API.includes('localhost')

export default function ScraperPanel({ onLoadRecipients }) {
  const [scrapers, setScrapers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loadingSource, setLoadingSource] = useState(null)
  const [scraping, setScraping] = useState({})
  const [scrapeResults, setScrapeResults] = useState({})

  // Generic options state per scraper: { maps: { category: 'IT', max_results: 10, location: 'Iasi' }, ... }
  const [scraperOpts, setScraperOpts] = useState({})

  useEffect(() => {
    fetch(`${API}/scrapers`)
      .then(r => r.json())
      .then(data => {
        setScrapers(data)
        // Initialize options with defaults from each scraper's options config
        const defaults = {}
        for (const sc of data) {
          if (sc.options) {
            defaults[sc.id] = {}
            for (const [key, opt] of Object.entries(sc.options)) {
              defaults[sc.id][key] = opt.default
            }
          }
        }
        setScraperOpts(defaults)
        setLoading(false)
      })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [])

  const refreshScrapers = () => {
    fetch(`${API}/scrapers`).then(r => r.json()).then(setScrapers).catch(() => {})
  }

  const setOpt = (scraperId, key, value) => {
    setScraperOpts(prev => ({
      ...prev,
      [scraperId]: { ...(prev[scraperId] || {}), [key]: value }
    }))
  }

  // Countdown timers per scraper (seconds remaining)
  const [countdowns, setCountdowns] = useState({})

  // Countdown tick effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const next = { ...prev }
        let changed = false
        for (const key of Object.keys(next)) {
          if (next[key] > 0) {
            next[key] -= 1
            changed = true
            if (next[key] === 0) {
              // Timer finished — auto refresh scrapers list
              refreshScrapers()
            }
          }
        }
        return changed ? next : prev
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const runScraper = async (name) => {
    setScraping(prev => ({ ...prev, [name]: true }))
    setScrapeResults(prev => ({ ...prev, [name]: null }))
    try {
      const opts = scraperOpts[name] || {}
      const params = new URLSearchParams()
      if (opts.category) params.set('category', opts.category)
      if (opts.max_results) params.set('max_results', String(opts.max_results))
      if (opts.location) params.set('location', opts.location)
      if (opts.keywords) params.set('keywords', opts.keywords)

      // On production: trigger GitHub Actions; on local: run directly
      const endpoint = IS_LOCAL ? `/scrape/${name}` : `/trigger-scrape/${name}`
      const url = `${API}${endpoint}?${params}`

      const res = await fetch(url, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Error')
      setScrapeResults(prev => ({ ...prev, [name]: data }))
      refreshScrapers()

      // Start countdown on production (GitHub Actions takes ~3-5 min)
      if (!IS_LOCAL && data.success) {
        setCountdowns(prev => ({ ...prev, [name]: 240 })) // 4 min countdown
      }
    } catch (e) {
      setScrapeResults(prev => ({ ...prev, [name]: { success: false, error: e.message } }))
    } finally {
      setScraping(prev => ({ ...prev, [name]: false }))
    }
  }

  const loadSource = async (name) => {
    setLoadingSource(name)
    try {
      const res = await fetch(`${API}/scraper-results/${name}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      if (onLoadRecipients) onLoadRecipients(data)
    } catch (e) {
      alert(`Could not load: ${e.message}`)
    } finally {
      setLoadingSource(null)
    }
  }

  const runMerge = async () => {
    setLoadingSource('merging')
    try {
      const res = await fetch(`${API}/scrape/merge`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Merge error')
      refreshScrapers()
      loadAll()
    } catch (e) {
      alert(`Merge failed: ${e.message}`)
      setLoadingSource(null)
    }
  }

  const loadAll = async () => {
    setLoadingSource('all')
    try {
      const res = await fetch(`${API}/scraper-results-all`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || `Error ${res.status}`)
      }
      const data = await res.json()
      if (onLoadRecipients) onLoadRecipients(data)
    } catch (e) {
      alert(`Could not load: ${e.message}`)
    } finally {
      setLoadingSource(null)
    }
  }

  if (loading) return <div style={s.container}><p style={s.loadingText}>Loading...</p></div>
  if (error) return <div style={s.container}><p style={s.errorText}>Error: {error}</p></div>

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>🕷️ Scraper / Sources</h2>
        <span style={s.badge}>{scrapers.length} sources</span>
      </div>

      {/* Info */}
      <div style={s.infoBar}>
        <span>Select a source to load recipients into the Emailer</span>
      </div>

      {/* Scrapers list */}
      <div style={s.scraperList}>
        {scrapers.map(sc => {
          const opts = scraperOpts[sc.id] || {}
          return (
          <div key={sc.id} style={s.scraperCard}>
            <div style={s.scraperHeader}>
              <div style={s.scraperInfo}>
                <span style={s.scraperIcon}>{sc.icon}</span>
                <div style={s.scraperMeta}>
                  <span style={s.scraperName}>{sc.name}</span>
                  <span style={s.scraperDesc}>{sc.description}</span>
                </div>
              </div>
              <div style={s.btnGroup}>
                <button
                  style={{ ...s.scrapeBtn, ...(scraping[sc.id] ? s.btnDisabled : {}) }}
                  disabled={scraping[sc.id]}
                  onClick={() => runScraper(sc.id)}>
                  {scraping[sc.id] ? '⏳...' : '▶ Scrape'}
                </button>
                <button
                  style={{ ...s.loadBtn, ...(loadingSource === sc.id || !sc.has_results ? s.btnDisabled : {}) }}
                  disabled={loadingSource === sc.id || !sc.has_results}
                  onClick={() => loadSource(sc.id)}>
                  {loadingSource === sc.id ? '⏳...' : '📥 Load'}
                </button>
              </div>
            </div>

            {/* Options filters (shown for all scrapers that have options) */}
            {sc.options && (
              <div style={s.optionsPanel}>
                {Object.entries(sc.options).map(([key, opt]) => (
                  <div key={key} style={s.optionRow}>
                    <label style={s.optionLabel}>{opt.label}</label>
                    {opt.type === 'select' ? (
                      <select style={s.optionSelect}
                        value={opts[key] || opt.default}
                        onChange={e => setOpt(sc.id, key, e.target.value)}>
                        {(opt.choices || []).map(c => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                    ) : opt.type === 'number' ? (
                      <input type="number" style={s.optionInput}
                        min={opt.min || 1} max={opt.max || 50}
                        value={opts[key] || opt.default}
                        onChange={e => setOpt(sc.id, key, parseInt(e.target.value) || opt.default)} />
                    ) : (
                      <input type="text" style={s.optionInput}
                        value={opts[key] || opt.default}
                        placeholder={opt.placeholder || ''}
                        onChange={e => setOpt(sc.id, key, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Status + scrape result */}
            <div style={s.scraperStatus}>
              {sc.has_results ? (
                <span style={s.statusOk}>
                  ✓ {sc.result_count} results
                  {sc.last_run && <span style={s.statusDate}> · {new Date(sc.last_run).toLocaleDateString()}</span>}
                </span>
              ) : (
                <span style={s.statusEmpty}>No results file yet</span>
              )}
            </div>
            {scrapeResults[sc.id] && (
              <div style={scrapeResults[sc.id].success ? s.resultOk : s.resultErr}>
                {scrapeResults[sc.id].success
                  ? `✅ ${scrapeResults[sc.id].message || scrapeResults[sc.id].result_count + ' results found'}`
                  : `⚠️ ${scrapeResults[sc.id].error || 'Error'}`}
                {countdowns[sc.id] > 0 && (
                  <span style={{ marginLeft: 8, fontWeight: 400 }}>
                    ⏱ Ready in ~{Math.floor(countdowns[sc.id] / 60)}:{String(countdowns[sc.id] % 60).padStart(2, '0')}
                  </span>
                )}
                {countdowns[sc.id] === 0 && scrapeResults[sc.id].success && !IS_LOCAL && (
                  <span style={{ marginLeft: 8, fontWeight: 700 }}> — Ready! Click Load</span>
                )}
              </div>
            )}
          </div>
        )})}
      </div>

      {/* Merge + Load All */}
      <div style={s.loadAllSection}>
        <div style={s.loadAllInfo}>
          <span style={s.loadAllLabel}>📦 All sources</span>
          <span style={s.loadAllHint}>Combine + load rezultate_all.json</span>
        </div>
        <div style={s.btnGroup}>
          <button style={{ ...s.mergeBtn, ...(loadingSource === 'merging' ? s.btnDisabled : {}) }}
            disabled={loadingSource === 'merging'}
            onClick={IS_LOCAL ? runMerge : () => runScraper('all')}>
            {loadingSource === 'merging' ? '⏳...' : '🔗 Merge'}
          </button>
          <button style={{ ...s.loadAllBtn, ...(loadingSource === 'all' ? s.btnDisabled : {}) }}
            disabled={loadingSource === 'all'}
            onClick={loadAll}>
            {loadingSource === 'all' ? '⏳...' : '📥 Load All'}
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={s.footer}>
        <span>Playwright + Chromium</span>
        <span>headed mode</span>
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
  infoBar: {
    padding: '10px 20px', background: '#f0f4ff', borderBottom: '1px solid #dde5ff',
    fontSize: '11px', color: '#4a5568',
  },
  scraperList: {
    flex: 1, overflowY: 'auto', padding: '12px 16px',
    display: 'flex', flexDirection: 'column', gap: 10,
  },
  scraperCard: {
    border: '1px solid #e2e8f0', borderRadius: 10, padding: '12px 14px',
    background: '#fafbfc',
  },
  scraperHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  scraperInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  scraperIcon: { fontSize: '22px', flexShrink: 0 },
  scraperMeta: { display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 },
  scraperName: { fontSize: '13px', fontWeight: 700, color: '#1a1a2e' },
  scraperDesc: { fontSize: '11px', color: '#718096', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  loadBtn: {
    padding: '6px 12px', borderRadius: 6, border: '1.5px solid #2563eb',
    background: '#fff', color: '#2563eb', fontSize: '11px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  scrapeBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none',
    background: '#1a1a2e', color: '#fff', fontSize: '11px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  btnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  btnGroup: { display: 'flex', gap: 6, flexShrink: 0 },
  optionsPanel: {
    marginTop: 8, padding: '8px 10px', background: '#f0f4ff',
    borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6,
    border: '1px solid #dde5ff',
  },
  optionRow: { display: 'flex', alignItems: 'center', gap: 8 },
  optionLabel: {
    fontSize: '11px', fontWeight: 600, color: '#4a5568', minWidth: 70, flexShrink: 0,
  },
  optionSelect: {
    flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e0',
    fontSize: '12px', color: '#2d3748', background: '#fff',
  },
  optionInput: {
    flex: 1, padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e0',
    fontSize: '12px', color: '#2d3748', background: '#fff', maxWidth: 100,
  },
  resultOk: {
    marginTop: 6, padding: '5px 10px', borderRadius: 6,
    background: '#f0fff4', border: '1px solid #9ae6b4',
    fontSize: '11px', color: '#276749', fontWeight: 600,
  },
  resultErr: {
    marginTop: 6, padding: '5px 10px', borderRadius: 6,
    background: '#fff5f5', border: '1px solid #feb2b2',
    fontSize: '11px', color: '#c53030',
  },
  scraperStatus: { marginTop: 6, paddingTop: 6, borderTop: '1px solid #edf2f7' },
  statusOk: { fontSize: '11px', color: '#38a169', fontWeight: 600 },
  statusDate: { color: '#a0aec0', fontWeight: 400 },
  statusEmpty: { fontSize: '11px', color: '#a0aec0', fontStyle: 'italic' },
  loadAllSection: {
    padding: '14px 16px', borderTop: '2px solid #e2e8f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    background: '#f7f8fa',
  },
  loadAllInfo: { display: 'flex', flexDirection: 'column', gap: 2 },
  loadAllLabel: { fontSize: '13px', fontWeight: 700, color: '#1a1a2e' },
  loadAllHint: { fontSize: '10px', color: '#718096' },
  loadAllBtn: {
    padding: '8px 14px', borderRadius: 6, border: 'none',
    background: 'linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)',
    color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  mergeBtn: {
    padding: '8px 14px', borderRadius: 6, border: '1.5px solid #1a1a2e',
    background: '#fff', color: '#1a1a2e', fontSize: '11px',
    fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
  },
  footer: {
    padding: '10px 20px',
    background: '#f7f8fa', borderTop: '1px solid #e2e8f0',
    display: 'flex', justifyContent: 'space-between',
    fontSize: '11px', color: '#a0aec0', fontWeight: 500,
  },
}
