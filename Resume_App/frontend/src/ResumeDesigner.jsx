import React, { useState, useRef, useCallback } from 'react'

const DEFAULT_SECTIONS = [
  { id: 'header', type: 'header', label: 'Header', visible: true, height: 'auto' },
  { id: 'summary', type: 'summary', label: 'Summary', visible: true, height: 'auto' },
  { id: 'experience', type: 'experience', label: 'Experience', visible: true, height: 'auto' },
  { id: 'education', type: 'education', label: 'Education', visible: true, height: 'auto' },
  { id: 'skills', type: 'skills', label: 'Skills', visible: true, height: 'auto' },
  { id: 'languages', type: 'languages', label: 'Languages', visible: true, height: 'auto' },
]

export default function ResumeDesigner({ onBack }) {
  const [sections, setSections] = useState(DEFAULT_SECTIONS)
  const [dragIdx, setDragIdx] = useState(null)
  const [accentColor, setAccentColor] = useState('#1a1a2e')
  const [data, setData] = useState({
    name: 'Your Name',
    title: 'Job Title',
    email: 'email@example.com',
    phone: '+40 700 000 000',
    linkedin: 'https://linkedin.com/in/yourprofile',
    website: '',
    location: 'City, Country',
    summary: 'Brief professional summary highlighting your key strengths and career objectives.',
    experience: [
      { title: 'Senior Developer', company: 'Tech Company', location: 'City', period: '2020 - Present', bullets: ['Led development of key features', 'Managed team of 5 engineers'] },
      { title: 'Developer', company: 'Startup Inc.', location: 'City', period: '2017 - 2020', bullets: ['Built full-stack applications', 'Improved system performance by 40%'] },
    ],
    education: [
      { degree: 'BSc Computer Science', school: 'University Name', period: '2013 - 2017' },
    ],
    skills: ['JavaScript', 'React', 'Python', 'Node.js', 'SQL', 'Git', 'Docker', 'AWS'],
    languages: ['English (Fluent)', 'Romanian (Native)'],
  })
  const previewRef = useRef(null)

  // Drag-and-drop reorder
  const handleDragStart = (idx) => setDragIdx(idx)
  const handleDragOver = (e, idx) => {
    e.preventDefault()
    if (dragIdx === null || dragIdx === idx) return
    const newSections = [...sections]
    const [moved] = newSections.splice(dragIdx, 1)
    newSections.splice(idx, 0, moved)
    setSections(newSections)
    setDragIdx(idx)
  }
  const handleDragEnd = () => setDragIdx(null)

  // Toggle section visibility
  const toggleSection = (id) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s))
  }

  // Export PDF
  const handleExport = () => {
    const content = previewRef.current
    if (!content) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
      <head>
        <title>${data.name} - Resume</title>
        <style>
          @media print { body { margin: 0; } @page { size: A4; margin: 0; } }
          * { box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 500)
  }

  // Update helpers
  const updateExp = (idx, field, value) => {
    setData(d => ({ ...d, experience: d.experience.map((e, i) => i === idx ? { ...e, [field]: value } : e) }))
  }
  const addExperience = () => {
    setData(d => ({ ...d, experience: [...d.experience, { title: 'New Role', company: 'Company', location: '', period: '2024 - Present', bullets: ['Description'] }] }))
  }
  const removeExperience = (idx) => {
    setData(d => ({ ...d, experience: d.experience.filter((_, i) => i !== idx) }))
  }
  const addEducation = () => {
    setData(d => ({ ...d, education: [...d.education, { degree: 'Degree', school: 'School', period: '2020 - 2024' }] }))
  }
  const removeEducation = (idx) => {
    setData(d => ({ ...d, education: d.education.filter((_, i) => i !== idx) }))
  }

  return (
    <div style={s.page}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h2 style={s.toolbarTitle}>Resume Designer</h2>
        <div style={s.toolbarRight}>
          <label style={s.colorLabel}>Accent:</label>
          <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
            style={{ width: 28, height: 28, border: 'none', borderRadius: 4, cursor: 'pointer' }} />
          <button style={s.exportBtn} onClick={handleExport}>📥 Export PDF</button>
        </div>
      </div>

      <div style={s.workspace}>
        {/* Left: Section Order + Editor */}
        <div style={s.editor}>
          {/* Section reorder panel */}
          <div style={s.sectionPanel}>
            <p style={s.panelTitle}>Sections (drag to reorder)</p>
            {sections.map((sec, idx) => (
              <div key={sec.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                style={{ ...s.sectionItem, opacity: dragIdx === idx ? 0.5 : 1, borderLeft: `3px solid ${sec.visible ? accentColor : '#e2e8f0'}` }}>
                <span style={s.dragHandle}>⋮⋮</span>
                <span style={s.sectionName}>{sec.label}</span>
                <button style={s.toggleBtn} onClick={() => toggleSection(sec.id)}>
                  {sec.visible ? '👁' : '👁‍🗨'}
                </button>
              </div>
            ))}
          </div>

          {/* Data editor */}
          <div style={s.dataPanel}>
            <p style={s.panelTitle}>Content</p>
            <Field label="Name" value={data.name} onChange={v => setData(d => ({ ...d, name: v }))} />
            <Field label="Title" value={data.title} onChange={v => setData(d => ({ ...d, title: v }))} />
            <Field label="Email" value={data.email} onChange={v => setData(d => ({ ...d, email: v }))} />
            <Field label="Phone" value={data.phone} onChange={v => setData(d => ({ ...d, phone: v }))} />
            <Field label="LinkedIn" value={data.linkedin} onChange={v => setData(d => ({ ...d, linkedin: v }))} />
            <Field label="Website" value={data.website} onChange={v => setData(d => ({ ...d, website: v }))} />
            <Field label="Location" value={data.location} onChange={v => setData(d => ({ ...d, location: v }))} />
            <Field label="Summary" value={data.summary} onChange={v => setData(d => ({ ...d, summary: v }))} multiline />
            <Field label="Skills (comma sep.)" value={data.skills.join(', ')} onChange={v => setData(d => ({ ...d, skills: v.split(',').map(s => s.trim()) }))} />
            <Field label="Languages (comma sep.)" value={data.languages.join(', ')} onChange={v => setData(d => ({ ...d, languages: v.split(',').map(s => s.trim()) }))} />

            {/* Experience entries */}
            <p style={{ ...s.panelTitle, marginTop: 16 }}>Experience</p>
            {data.experience.map((exp, i) => (
              <div key={i} style={s.entryCard}>
                <Field label="Title" value={exp.title} onChange={v => updateExp(i, 'title', v)} />
                <Field label="Company" value={exp.company} onChange={v => updateExp(i, 'company', v)} />
                <Field label="Period" value={exp.period} onChange={v => updateExp(i, 'period', v)} />
                <Field label="Bullets (one per line)" value={exp.bullets.join('\n')} onChange={v => updateExp(i, 'bullets', v.split('\n'))} multiline />
                <button style={s.removeBtn} onClick={() => removeExperience(i)}>Remove</button>
              </div>
            ))}
            <button style={s.addBtn} onClick={addExperience}>+ Add Experience</button>

            {/* Education entries */}
            <p style={{ ...s.panelTitle, marginTop: 16 }}>Education</p>
            {data.education.map((edu, i) => (
              <div key={i} style={s.entryCard}>
                <Field label="Degree" value={edu.degree} onChange={v => setData(d => ({ ...d, education: d.education.map((e, j) => j === i ? { ...e, degree: v } : e) }))} />
                <Field label="School" value={edu.school} onChange={v => setData(d => ({ ...d, education: d.education.map((e, j) => j === i ? { ...e, school: v } : e) }))} />
                <Field label="Period" value={edu.period} onChange={v => setData(d => ({ ...d, education: d.education.map((e, j) => j === i ? { ...e, period: v } : e) }))} />
                <button style={s.removeBtn} onClick={() => removeEducation(i)}>Remove</button>
              </div>
            ))}
            <button style={s.addBtn} onClick={addEducation}>+ Add Education</button>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div style={s.previewContainer}>
          <div ref={previewRef} style={s.preview}>
            <ResumePreview data={data} sections={sections} accentColor={accentColor} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Simple field component
function Field({ label, value, onChange, multiline }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <label style={s.fieldLabel}>{label}</label>
      {multiline
        ? <textarea style={s.fieldTextarea} value={value} rows={3} onChange={e => onChange(e.target.value)} />
        : <input style={s.fieldInput} value={value} onChange={e => onChange(e.target.value)} />
      }
    </div>
  )
}

// Live preview renders sections in order
function ResumePreview({ data, sections, accentColor }) {
  const renderSection = (sec) => {
    if (!sec.visible) return null
    switch (sec.type) {
      case 'header': return (
        <div key={sec.id} style={{ marginBottom: 16, borderBottom: `2px solid ${accentColor}`, paddingBottom: 12 }}>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: '0 0 2px', color: accentColor }}>{data.name}</h1>
          <p style={{ fontSize: 13, color: '#4a5568', margin: '0 0 6px' }}>{data.title}</p>
          <div style={{ fontSize: 10, color: '#718096', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
            {data.email && <span>{data.email}</span>}
            {data.phone && <span>{data.phone}</span>}
            {data.location && <span>{data.location}</span>}
            {data.linkedin && <a href={data.linkedin} style={{ color: accentColor, textDecoration: 'none' }}>{data.linkedin}</a>}
            {data.website && <a href={data.website} style={{ color: accentColor, textDecoration: 'none' }}>{data.website}</a>}
          </div>
        </div>
      )
      case 'summary': return (
        <div key={sec.id} style={{ marginBottom: 14 }}>
          <h2 style={sectionTitle(accentColor)}>Summary</h2>
          <p style={{ fontSize: 10, color: '#2d3748', margin: 0, lineHeight: 1.6 }}>{data.summary}</p>
        </div>
      )
      case 'experience': return (
        <div key={sec.id} style={{ marginBottom: 14 }}>
          <h2 style={sectionTitle(accentColor)}>Experience</h2>
          {data.experience.map((exp, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 11, color: '#1a1a2e' }}>{exp.title}</strong>
                <span style={{ fontSize: 9, color: '#718096' }}>{exp.period}</span>
              </div>
              <p style={{ fontSize: 10, color: '#4a5568', margin: '1px 0 4px' }}>{exp.company}{exp.location ? `, ${exp.location}` : ''}</p>
              <ul style={{ margin: '2px 0', paddingLeft: 14 }}>
                {exp.bullets.filter(b => b).map((b, j) => (
                  <li key={j} style={{ fontSize: 10, color: '#2d3748', marginBottom: 2 }}>{b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )
      case 'education': return (
        <div key={sec.id} style={{ marginBottom: 14 }}>
          <h2 style={sectionTitle(accentColor)}>Education</h2>
          {data.education.map((edu, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong style={{ fontSize: 11, color: '#1a1a2e' }}>{edu.degree}</strong>
                <span style={{ fontSize: 9, color: '#718096' }}>{edu.period}</span>
              </div>
              <p style={{ fontSize: 10, color: '#4a5568', margin: '1px 0' }}>{edu.school}</p>
            </div>
          ))}
        </div>
      )
      case 'skills': return (
        <div key={sec.id} style={{ marginBottom: 14 }}>
          <h2 style={sectionTitle(accentColor)}>Skills</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {data.skills.filter(s => s).map((skill, i) => (
              <span key={i} style={{ padding: '2px 8px', background: accentColor + '15', border: `1px solid ${accentColor}30`, borderRadius: 3, fontSize: 9, color: '#2d3748' }}>{skill}</span>
            ))}
          </div>
        </div>
      )
      case 'languages': return (
        <div key={sec.id} style={{ marginBottom: 14 }}>
          <h2 style={sectionTitle(accentColor)}>Languages</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
            {data.languages.filter(l => l).map((lang, i) => (
              <span key={i} style={{ fontSize: 10, color: '#2d3748' }}>• {lang}</span>
            ))}
          </div>
        </div>
      )
      default: return null
    }
  }

  return (
    <div style={{ width: '100%', padding: '28px 32px', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: 11, lineHeight: 1.5, color: '#1a1a2e' }}>
      {sections.map(sec => renderSection(sec))}
    </div>
  )
}

const sectionTitle = (color) => ({
  fontSize: 12, fontWeight: 700, color: color, margin: '0 0 6px',
  textTransform: 'uppercase', letterSpacing: '0.5px',
  borderBottom: `1px solid ${color}40`, paddingBottom: 3,
})

// Component styles
const s = {
  page: { minHeight: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', background: '#f5f7fa' },
  toolbar: { display: 'flex', alignItems: 'center', padding: '10px 24px', background: '#1a1a2e', gap: '16px' },
  backBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  toolbarTitle: { color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0, flex: 1 },
  toolbarRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  colorLabel: { color: '#a0aec0', fontSize: '11px', fontWeight: 600 },
  exportBtn: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d97706', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  workspace: { flex: 1, display: 'flex', gap: '16px', padding: '16px', overflow: 'hidden' },
  editor: { width: '340px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' },
  sectionPanel: { background: '#fff', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  panelTitle: { fontSize: 10, fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' },
  sectionItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', marginBottom: 4, borderRadius: 6, background: '#fafbfc', cursor: 'grab' },
  dragHandle: { color: '#a0aec0', fontSize: 12, cursor: 'grab', userSelect: 'none' },
  sectionName: { flex: 1, fontSize: 12, fontWeight: 600, color: '#2d3748' },
  toggleBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, padding: '2px 4px' },
  dataPanel: { background: '#fff', borderRadius: '10px', padding: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  fieldLabel: { fontSize: 9, fontWeight: 700, color: '#718096', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: 2 },
  fieldInput: { width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 12, color: '#1a1a2e', outline: 'none', boxSizing: 'border-box' },
  fieldTextarea: { width: '100%', padding: '6px 8px', borderRadius: 5, border: '1px solid #e2e8f0', fontSize: 12, color: '#1a1a2e', outline: 'none', resize: 'vertical', boxSizing: 'border-box' },
  entryCard: { background: '#f7f8fa', borderRadius: 6, padding: '10px', marginBottom: 8, border: '1px solid #e2e8f0' },
  removeBtn: { marginTop: 4, padding: '3px 8px', borderRadius: 4, border: '1px solid #feb2b2', background: 'none', color: '#e53e3e', fontSize: 10, cursor: 'pointer' },
  addBtn: { padding: '6px 12px', borderRadius: 6, border: '1.5px dashed #cbd5e0', background: 'none', color: '#4a5568', fontSize: 11, fontWeight: 600, cursor: 'pointer', width: '100%' },
  previewContainer: { flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '10px 0' },
  preview: { width: '210mm', minHeight: '297mm', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', borderRadius: '4px', overflow: 'hidden' },
}
