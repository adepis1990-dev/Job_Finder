import React, { useEffect, useRef, useState } from 'react'
import grapesjs from 'grapesjs'
import 'grapesjs/dist/css/grapes.min.css'
import gjsPresetWebpage from 'grapesjs-preset-webpage'

// Resume-specific blocks for the editor
const RESUME_BLOCKS = [
  {
    id: 'header-block',
    label: 'Header',
    category: 'Resume Sections',
    content: `
      <div style="padding: 24px 32px; border-bottom: 2px solid #1a1a2e; margin-bottom: 16px;">
        <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #1a1a2e;">Your Name</h1>
        <p style="font-size: 14px; color: #4a5568; margin: 0 0 8px;">Job Title</p>
        <p style="font-size: 11px; color: #718096; margin: 0;">email@example.com · +40 700 000 000 · City, Country · <a href="https://linkedin.com" style="color: #2563eb;">LinkedIn</a></p>
      </div>
    `,
  },
  {
    id: 'summary-block',
    label: 'Summary',
    category: 'Resume Sections',
    content: `
      <div style="padding: 0 32px; margin-bottom: 16px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px;">Summary</h2>
        <p style="font-size: 11px; color: #2d3748; line-height: 1.6; margin: 0;">Professional summary highlighting your key strengths, experience, and career objectives. Customize this text to match your profile.</p>
      </div>
    `,
  },
  {
    id: 'experience-block',
    label: 'Experience',
    category: 'Resume Sections',
    content: `
      <div style="padding: 0 32px; margin-bottom: 16px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px;">Experience</h2>
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 11px; color: #1a1a2e;">Senior Developer</strong>
            <span style="font-size: 9px; color: #718096;">2020 - Present</span>
          </div>
          <p style="font-size: 10px; color: #4a5568; margin: 2px 0 4px;">Tech Company, City</p>
          <ul style="margin: 2px 0; padding-left: 16px; font-size: 10px; color: #2d3748;">
            <li>Led development of key platform features</li>
            <li>Managed team of 5 engineers</li>
          </ul>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 11px; color: #1a1a2e;">Developer</strong>
            <span style="font-size: 9px; color: #718096;">2017 - 2020</span>
          </div>
          <p style="font-size: 10px; color: #4a5568; margin: 2px 0 4px;">Startup Inc., City</p>
          <ul style="margin: 2px 0; padding-left: 16px; font-size: 10px; color: #2d3748;">
            <li>Built full-stack applications</li>
            <li>Improved system performance by 40%</li>
          </ul>
        </div>
      </div>
    `,
  },
  {
    id: 'education-block',
    label: 'Education',
    category: 'Resume Sections',
    content: `
      <div style="padding: 0 32px; margin-bottom: 16px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 10px;">Education</h2>
        <div style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <strong style="font-size: 11px; color: #1a1a2e;">BSc Computer Science</strong>
            <span style="font-size: 9px; color: #718096;">2013 - 2017</span>
          </div>
          <p style="font-size: 10px; color: #4a5568; margin: 2px 0;">University Name</p>
        </div>
      </div>
    `,
  },
  {
    id: 'skills-block',
    label: 'Skills',
    category: 'Resume Sections',
    content: `
      <div style="padding: 0 32px; margin-bottom: 16px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px;">Skills</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 6px;">
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">JavaScript</span>
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">React</span>
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">Python</span>
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">Node.js</span>
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">SQL</span>
          <span style="padding: 3px 10px; background: #f0f4f8; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 10px; color: #2d3748;">Docker</span>
        </div>
      </div>
    `,
  },
  {
    id: 'languages-block',
    label: 'Languages',
    category: 'Resume Sections',
    content: `
      <div style="padding: 0 32px; margin-bottom: 16px;">
        <h2 style="font-size: 13px; font-weight: 700; color: #1a1a2e; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin: 0 0 8px;">Languages</h2>
        <p style="font-size: 10px; color: #2d3748; margin: 0;">• English (Fluent) &nbsp;&nbsp; • Romanian (Native)</p>
      </div>
    `,
  },
  {
    id: 'divider-block',
    label: 'Divider',
    category: 'Layout',
    content: '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 12px 32px;" />',
  },
  {
    id: 'spacer-block',
    label: 'Spacer',
    category: 'Layout',
    content: '<div style="height: 20px;"></div>',
  },
  {
    id: 'two-columns',
    label: 'Two Columns',
    category: 'Layout',
    content: `
      <div style="display: flex; gap: 20px; padding: 0 32px; margin-bottom: 16px;">
        <div style="flex: 1; padding: 12px; background: #f7f8fa; border-radius: 6px; min-height: 60px;">Left column content</div>
        <div style="flex: 1; padding: 12px; background: #f7f8fa; border-radius: 6px; min-height: 60px;">Right column content</div>
      </div>
    `,
  },
  {
    id: 'sidebar-layout',
    label: 'Sidebar Layout',
    category: 'Layout',
    content: `
      <div style="display: flex; min-height: 100px; margin-bottom: 16px;">
        <div style="width: 200px; background: #1a1a2e; color: #fff; padding: 20px; font-size: 11px;">Sidebar content</div>
        <div style="flex: 1; padding: 20px; font-size: 11px;">Main content area</div>
      </div>
    `,
  },
  {
    id: 'colored-box',
    label: 'Colored Box',
    category: 'Shapes',
    content: '<div style="width: 100px; height: 100px; background: #2563eb; border-radius: 8px; margin: 10px;"></div>',
  },
  {
    id: 'circle',
    label: 'Circle',
    category: 'Shapes',
    content: '<div style="width: 80px; height: 80px; background: #10b981; border-radius: 50%; margin: 10px;"></div>',
  },
  {
    id: 'line-horizontal',
    label: 'Line',
    category: 'Shapes',
    content: '<div style="width: 200px; height: 3px; background: #1a1a2e; margin: 10px;"></div>',
  },
]

export default function ResumeDesigner({ onBack }) {
  const editorRef = useRef(null)
  const [editor, setEditor] = useState(null)

  useEffect(() => {
    if (editorRef.current && !editor) {
      const e = grapesjs.init({
        container: editorRef.current,
        height: '100%',
        width: 'auto',
        fromElement: false,
        storageManager: false,
        plugins: [gjsPresetWebpage],
        pluginsOpts: {
          [gjsPresetWebpage]: {
            blocksBasicOpts: { flexGrid: true },
            blocks: ['column1', 'column2', 'column3', 'column3-7', 'text', 'link', 'image', 'video'],
          },
        },
        canvas: {
          styles: [
            'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap',
          ],
        },
        styleManager: {
          appendTo: '.styles-container',
          sectors: [
            {
              name: 'General',
              open: true,
              buildProps: ['width', 'min-height', 'padding', 'margin'],
            },
            {
              name: 'Colors',
              open: true,
              buildProps: ['background-color', 'color'],
            },
            {
              name: 'Typography',
              open: true,
              buildProps: ['font-family', 'font-size', 'font-weight', 'letter-spacing', 'line-height', 'text-align'],
            },
            {
              name: 'Borders',
              open: false,
              buildProps: ['border-radius', 'border'],
            },
          ],
        },
        deviceManager: {
          devices: [
            { name: 'A4', width: '210mm' },
          ],
        },
        components: `
          <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; padding: 0; min-height: 297mm; width: 210mm; background: #fff;">
            <div style="padding: 28px 32px; border-bottom: 2px solid #1a1a2e; margin-bottom: 16px;">
              <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 4px; color: #1a1a2e;">Your Name</h1>
              <p style="font-size: 14px; color: #4a5568; margin: 0 0 8px;">Job Title</p>
              <p style="font-size: 11px; color: #718096; margin: 0;">email@example.com · +40 700 000 000 · City · <a href="https://linkedin.com" style="color: #2563eb;">LinkedIn</a></p>
            </div>
          </div>
        `,
        blockManager: {
          appendTo: '.blocks-container',
          blocks: RESUME_BLOCKS,
        },
      })

      // Add custom panels
      e.Panels.addPanel({
        id: 'basic-actions',
        el: '.panel-top',
        buttons: [
          { id: 'export-pdf', className: 'fa fa-download', command: 'export-pdf', attributes: { title: 'Export PDF' } },
        ],
      })

      // Export PDF command
      e.Commands.add('export-pdf', {
        run(editor) {
          const html = editor.getHtml()
          const css = editor.getCss()
          const printWindow = window.open('', '_blank')
          printWindow.document.write(`
            <html>
            <head>
              <title>Resume</title>
              <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
              <style>
                @media print { body { margin: 0; } @page { size: A4; margin: 0; } }
                * { box-sizing: border-box; }
                body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                ${css}
              </style>
            </head>
            <body>${html}</body>
            </html>
          `)
          printWindow.document.close()
          setTimeout(() => printWindow.print(), 500)
        }
      })

      setEditor(e)

      // Make all components resizable and draggable
      e.on('component:add', (component) => {
        component.set({
          resizable: {
            tl: 0, tr: 0, bl: 0, br: 0,  // no corner resize
            tc: 0, bc: 1,  // bottom-center only (height)
            cl: 1, cr: 1,  // left and right (width)
          },
          draggable: true,
        })
      })

      // Also apply to existing components
      e.getComponents().forEach(function applyResizable(comp) {
        comp.set({
          resizable: {
            tl: 1, tr: 1, bl: 1, br: 1,
            tc: 1, bc: 1, cl: 1, cr: 1,
          },
          draggable: true,
        })
        comp.components().forEach(applyResizable)
      })
    }

    return () => {
      if (editor) {
        editor.destroy()
      }
    }
  }, [])

  const handleExport = () => {
    if (editor) {
      editor.runCommand('export-pdf')
    }
  }

  return (
    <div style={s.page}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.backBtn} onClick={onBack}>← Back</button>
        <h2 style={s.toolbarTitle}>Resume Designer</h2>
        <button style={s.exportBtn} onClick={handleExport}>📥 Export PDF</button>
      </div>

      {/* Editor layout: left blocks panel + canvas + right styles panel */}
      <div style={s.editorLayout}>
        {/* Left panel: Blocks to drag */}
        <div style={s.leftPanel}>
          <div className="blocks-container"></div>
        </div>

        {/* Center: GrapesJS Canvas */}
        <div style={s.canvasContainer}>
          <div ref={editorRef} style={s.grapesEditor}></div>
        </div>

        {/* Right panel: Style manager */}
        <div style={s.rightPanel}>
          <div className="styles-container"></div>
        </div>
      </div>
    </div>
  )
}

const s = {
  page: { height: 'calc(100vh - 52px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  toolbar: { display: 'flex', alignItems: 'center', padding: '8px 20px', background: '#1a1a2e', gap: '14px', flexShrink: 0, zIndex: 10 },
  backBtn: { padding: '6px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.2)', background: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  toolbarTitle: { color: '#fff', fontSize: '15px', fontWeight: 700, margin: 0, flex: 1 },
  exportBtn: { padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#d97706', color: '#fff', fontSize: '12px', fontWeight: 700, cursor: 'pointer' },
  editorLayout: { flex: 1, display: 'flex', overflow: 'hidden' },
  leftPanel: { width: '220px', background: '#2d2d2d', overflowY: 'auto', flexShrink: 0, color: '#fff', fontSize: '12px' },
  canvasContainer: { flex: 1, overflow: 'hidden' },
  grapesEditor: { height: '100%', width: '100%' },
  rightPanel: { width: '240px', background: '#363636', overflowY: 'auto', flexShrink: 0, color: '#fff', fontSize: '12px' },
}
