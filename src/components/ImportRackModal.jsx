import { useState, useEffect, useMemo } from 'react'
import './ImportRackModal.css'

/**
 * Parse a ModularGrid HTML table into module rows.
 *
 * Each <tr> in <tbody> has:
 *   td[0] — thumbnail (skip)
 *   td[1] — manufacturer (text node) + <a> module name + <small> description
 *   td[2] — row number
 *   td[3] — HP width (e.g. "6 HP")
 *   td[4+] — depth, current (we don't need these)
 *
 * The <tfoot> rows contain per-row HP totals — we sum to get rack capacity.
 */
function parseModularGridHTML(html) {
  const modules = []
  const errors = []

  if (!html || !html.trim()) {
    return { modules, errors, totalHp: null }
  }

  // Parse HTML string into a DOM
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Find the table — might be the root element or nested
  const table = doc.querySelector('table') || doc.querySelector('tbody')?.closest('table')

  if (!table) {
    // Maybe they pasted just tbody rows — wrap it
    const wrapped = parser.parseFromString(`<table>${html}</table>`, 'text/html')
    const wrappedTable = wrapped.querySelector('table')
    if (wrappedTable) {
      return parseFromTable(wrappedTable)
    }
    errors.push('No table found in the pasted HTML. Copy the entire table from ModularGrid.')
    return { modules, errors, totalHp: null }
  }

  return parseFromTable(table)
}

function parseFromTable(table) {
  const modules = []
  const errors = []

  // Parse tbody rows for modules
  const rows = table.querySelectorAll('tbody tr')

  rows.forEach((tr, i) => {
    const cells = tr.querySelectorAll('td')
    if (cells.length < 4) return

    // Cell 1: manufacturer + module name
    const moduleCell = cells[1]
    if (!moduleCell) return

    // Manufacturer: first text node or text before the <a>
    let manufacturer = ''
    for (const node of moduleCell.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim()
        if (text) {
          manufacturer = text
          break
        }
      }
    }

    // Module name: from the <a> tag
    const nameLink = moduleCell.querySelector('a')
    const name = nameLink ? nameLink.textContent.trim() : ''

    if (!name) {
      errors.push(`Row ${i + 1}: Could not extract module name`)
      return
    }

    if (!manufacturer) {
      // Try to get manufacturer from the cell text before the link
      const fullText = moduleCell.textContent
      const nameIndex = fullText.indexOf(name)
      if (nameIndex > 0) {
        manufacturer = fullText.slice(0, nameIndex).trim()
      }
    }

    // Cell 2: row number
    const rowText = cells[2]?.textContent?.trim() || ''
    const row = parseInt(rowText, 10) || null

    // Cell 3: HP
    const hpText = cells[3]?.textContent?.trim() || ''
    const hpMatch = hpText.match(/(\d+)\s*HP/i)
    const hp = hpMatch ? parseInt(hpMatch[1], 10) : null

    modules.push({
      name,
      manufacturer: manufacturer || 'Unknown',
      hp,
      row,
      category: null,
    })
  })

  // Parse tfoot for total HP capacity
  let totalHp = null
  const totalRow = table.querySelector('tfoot tr.total')
  if (totalRow) {
    const totalCells = totalRow.querySelectorAll('td')
    for (const cell of totalCells) {
      const text = cell.textContent
      const hpMatch = text.match(/([\d,]+)\s*HP/i)
      if (hpMatch) {
        totalHp = parseInt(hpMatch[1].replace(/,/g, ''), 10)
        break
      }
    }
  }

  // If no total row, try to find it from any tfoot row
  if (!totalHp) {
    const tfootRows = table.querySelectorAll('tfoot tr')
    for (const tr of tfootRows) {
      const text = tr.textContent
      if (text.includes('Total')) {
        const hpMatch = text.match(/([\d,]+)\s*HP/i)
        if (hpMatch) {
          totalHp = parseInt(hpMatch[1].replace(/,/g, ''), 10)
          break
        }
      }
    }
  }

  return { modules, errors, totalHp }
}

export default function ImportRackModal({ onImport, onClose }) {
  const [rackName, setRackName] = useState('')
  const [rackDesc, setRackDesc] = useState('')
  const [html, setHtml] = useState('')
  const [saving, setSaving] = useState(false)

  const { modules, errors, totalHp } = useMemo(() => {
    return parseModularGridHTML(html)
  }, [html])

  // Group by row for display
  const rowGroups = useMemo(() => {
    if (modules.length === 0) return []
    const groups = {}
    modules.forEach((m) => {
      const key = m.row || 'unknown'
      if (!groups[key]) groups[key] = []
      groups[key].push(m)
    })
    return Object.entries(groups)
      .sort(([a], [b]) => (parseInt(a) || 999) - (parseInt(b) || 999))
  }, [modules])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!rackName.trim() || modules.length === 0) return

    setSaving(true)
    try {
      await onImport({
        rackName: rackName.trim(),
        rackDesc: rackDesc.trim() || null,
        hpCapacity: totalHp,
        modules,
      })
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="section-header">Import from ModularGrid</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Rack Name</label>
              <input
                type="text"
                value={rackName}
                onChange={(e) => setRackName(e.target.value)}
                placeholder="e.g. Main Case, Performance Skiff"
                required
                autoFocus
              />
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Purpose / Description</label>
            <input
              type="text"
              value={rackDesc}
              onChange={(e) => setRackDesc(e.target.value)}
              placeholder="What's this rack for?"
            />
          </div>

          <div className="modal-field">
            <label className="modal-label">
              ModularGrid HTML — paste the table from your rack page
            </label>
            <textarea
              className="import-textarea"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={'Go to your ModularGrid rack page, right-click the modules table, Inspect Element, copy the <table>...</table> HTML, and paste it here.'}
              rows={8}
            />
            <span className="import-hint">
              Right-click the data table on your rack page → Inspect → copy the {'<table>'} element's outer HTML
            </span>
          </div>

          {errors.length > 0 && (
            <div className="import-errors">
              {errors.map((err, i) => (
                <div key={i} className="import-error-line">{err}</div>
              ))}
            </div>
          )}

          {modules.length > 0 && (
            <div className="import-preview">
              <div className="import-preview-header">
                <span className="modal-label">
                  {modules.length} module{modules.length !== 1 ? 's' : ''} detected
                </span>
                {totalHp && (
                  <span className="import-total-hp">{totalHp}hp total capacity</span>
                )}
              </div>

              <div className="import-preview-list">
                {rowGroups.map(([row, mods]) => (
                  <div key={row} className="import-row-group">
                    <span className="import-row-label">Row {row}</span>
                    {mods.map((m, i) => (
                      <div key={i} className="import-preview-item">
                        <span className="import-preview-name">{m.name}</span>
                        <span className="import-preview-mfr">{m.manufacturer}</span>
                        {m.hp && <span className="import-preview-hp">{m.hp}hp</span>}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || modules.length === 0 || !rackName.trim()}
            >
              {saving
                ? 'Importing...'
                : `Import ${modules.length} Module${modules.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
