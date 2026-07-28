import React, { useState, useRef } from 'react'

const TEMPLATES = [
  { id: 'modern-split', name: 'Modern Split', preview: '🎨' },
  { id: 'clean-minimal', name: 'Clean Minimal', preview: '📄' },
  { id: 'executive', name: 'Executive', preview: '💼' },
  { id: 'creative', name: 'Creative', preview: '✨' },
]

export default function ResumeDesigner({ onBack }) {
  const [selectedTemplate, setSelectedTemplate] = useState('modern-split')
  const [resumeData, setResumeData] = useState({
    name: 'Your Name',
    title: 'Job Title',
    email: 'email@example.com',
    phone: '+40 700 000 000',
    linkedin: 'linkedin.com/in/yourprofile',
    location: 'City, Country',
    summary: 'Brief professional summary goes here...',
    experience: [
      { title: 'Job Title', company: 'Company', period: '2020 - Present', description: 'Key achievements and responsibilities.' },
    ],
    education: [
      { degree: 'Degree Name', school: 'University', period: '2016 - 2020' },
    ],
    skills: ['Skill 1', 'Skill 2', 'Skill 3'],
  })
  const previewRef = useRef(null)

  const handlePrint = () => {
    const content = previewRef.current
    if (!content) return
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
      <head>
        <title>${resumeData.name} - Resume</title>
        <style>
          @media print { body { margin: 0; } @page { size: A4; margin: 0; } }
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => { printWindow.print(); printWindow.close() }, 500)
  }

  return (
    <div style={s.page}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h2 style={s.toolbarTitle}>Resume Designer</h2>
        <div style={s.toolbarRight}>
          <select style={s.templateSelect}
            value={selectedTemplate}
            onChange={e => setSelectedTemplate(e.target.value)}>
            {TEMPLATES.map(t => (
              <option key={t.id} value={t.id}>{t.preview} {t.name}</option>
            ))}
          </select>
          <button style={s.exportBtn} onClick={handlePrint}>📥 Export PDF</button>
        </div>
      </div>

      <div style={s.workspace}>
        {/* Left: Editor */}
        <div style={s.editor}>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Full Name</label>
            <input style={s.editorInput} value={resumeData.name}
              onChange={e => setResumeData(d => ({ ...d, name: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Job Title</label>
            <input style={s.editorInput} value={resumeData.title}
              onChange={e => setResumeData(d => ({ ...d, title: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Email</label>
            <input style={s.editorInput} value={resumeData.email}
              onChange={e => setResumeData(d => ({ ...d, email: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Phone</label>
            <input style={s.editorInput} value={resumeData.phone}
              onChange={e => setResumeData(d => ({ ...d, phone: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>LinkedIn</label>
            <input style={s.editorInput} value={resumeData.linkedin}
              onChange={e => setResumeData(d => ({ ...d, linkedin: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Location</label>
            <input style={s.editorInput} value={resumeData.location}
              onChange={e => setResumeData(d => ({ ...d, location: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Summary</label>
            <textarea style={s.editorTextarea} value={resumeData.summary} rows={3}
              onChange={e => setResumeData(d => ({ ...d, summary: e.target.value }))} />
          </div>
          <div style={s.editorSection}>
            <label style={s.editorLabel}>Skills (comma separated)</label>
            <input style={s.editorInput} value={resumeData.skills.join(', ')}
              onChange={e => setResumeData(d => ({ ...d, skills: e.target.value.split(',').map(s => s.trim()) }))} />
          </div>
        </div>

        {/* Right: Live Preview */}
        <div style={s.previewContainer}>
          <div ref={previewRef} style={s.preview}>
            <ResumePreview data={resumeData} template={selectedTemplate} />
          </div>
        </div>
      </div>
    </div>
  )
}

function ResumePreview({ data, template }) {
  // Modern Split template
  return (
    <div style={tp.page}>
      <div style={tp.header}>
        <h1 style={tp.name}>{data.name}</h1>
        <p style={tp.title}>{data.title}</p>
        <div style={tp.contact}>
          <span>{data.email}</span>
          <span> · </span>
          <span>{data.phone}</span>
          <span> · </span>
          <span>{data.location}</span>
          {data.linkedin && <><span> · </span><a href={data.linkedin.startsWith('http') ? data.linkedin : `https://${data.linkedin}`} style={tp.link}>{data.linkedin}</a></>}
        </div>
      </div>

      <div style={tp.body}>
        {data.summary && (
          <div style={tp.section}>
            <h2 style={tp.sectionTitle}>Summary</h2>
            <p style={tp.text}>{data.summary}</p>
          </div>
        )}

        {data.experience.length > 0 && (
          <div style={tp.section}>
            <h2 style={tp.sectionTitle}>Experience</h2>
            {data.experience.map((exp, i) => (
              <div key={i} style={tp.entry}>
                <div style={tp.entryHeader}>
                  <strong>{exp.title}</strong>
                  <span style={tp.period}>{exp.period}</span>
                </div>
                <p style={tp.company}>{exp.company}</p>
                <p style={tp.text}>{exp.description}</p>
              </div>
            ))}
          </div>
        )}

        {data.education.length > 0 && (
          <div style={tp.section}>
            <h2 style={tp.sectionTitle}>Education</h2>
            {data.education.map((edu, i) => (
              <div key={i} style={tp.entry}>
                <div style={tp.entryHeader}>
                  <strong>{edu.degree}</strong>
                  <span style={tp.period}>{edu.period}</span>
                </div>
                <p style={tp.company}>{edu.school}</p>
              </div>
            ))}
          </div>
        )}

        {data.skills.length > 0 && (
          <div style={tp.section}>
            <h2 style={tp.sectionTitle}>Skills</h2>
            <div style={tp.skillsGrid}>
              {data.skills.filter(s => s).map((skill, i) => (
                <span key={i} style={tp.skillChip}>{skill}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Template styles (Modern Split)
const tp = {
  page: { width: '100%', minHeight: '297mm', background: '#fff', fontFamily: "'Segoe UI', Arial, sans-serif", fontSize: '11px', lineHeight: 1.5, color: '#1a1a2e', padding: '32px' },
  header: { marginBottom: '20px', borderBottom: '2px solid #1a1a2e', paddingBottom: '14px' },
  name: { fontSize: '26px', fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' },
  title: { fontSize: '14px', color: '#4a5568', margin: '0 0 8px' },
  contact: { fontSize: '11px', color: '#718096' },
  link: { color: '#2563eb', textDecoration: 'none' },
  body: {},
  section: { marginBottom: '18px' },
  sectionTitle: { fontSize: '13px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e2e8f0', paddingBottom: '4px' },
  entry: { marginBottom: '12px' },
  entryHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  period: { fontSize: '10px', color: '#718096', whiteSpace: 'nowrap' },
  company: { fontSize: '11px', color: '#4a5568', margin: '2px 0 4px' },
  text: { fontSize: '11px', color: '#2d3748', margin: '4px 0' },
  skillsGrid: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  skillChip: { padding: '3px 10px', background: '#f0f4f8', borderRadius: '4px', fontSize: '10px', color: '#2d3748' },
}

// Component styles
const s = {
  page: { minHeight: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', background: '#f5f7fa' },
  toolbar: { display: 'flex', alignItems: 'center', padding: '12px 24px', background: '#1a1a2e', gap: '16px' },
  backBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  toolbarTitle: { color: '#fff', fontSize: '16px', fontWeight: 700, margin: 0, flex: 1 },
  toolbarRight: { display: 'flex', gap: '10px', alignItems: 'center' },
  templateSelect: { padding: '6px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '12px' },
  exportBtn: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d97706', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  workspace: { flex: 1, display: 'flex', gap: '20px', padding: '20px 24px', overflow: 'hidden' },
  editor: { width: '320px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
  editorSection: { display: 'flex', flexDirection: 'column', gap: '4px' },
  editorLabel: { fontSize: '10px', fontWeight: 700, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.5px' },
  editorInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#1a1a2e', outline: 'none' },
  editorTextarea: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#1a1a2e', outline: 'none', resize: 'vertical' },
  previewContainer: { flex: 1, overflowY: 'auto', display: 'flex', justifyContent: 'center', padding: '20px 0' },
  preview: { width: '210mm', minHeight: '297mm', background: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '4px', overflow: 'hidden' },
}
