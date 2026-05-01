import { useState, useEffect } from 'react'
import './BulkAddModal.css'

const EXAMPLE = `Maths, Make Noise, modulation, 20
Rings, Mutable Instruments, voice, 14
Pamela's NEW Workout, ALM, sequencer, 8
Morphagene, Make Noise, processing, 20`

export default function BulkAddModal({ racks, defaultRackId, onSave, onClose }) {
  const [text, setText] = useState('')
  const [rackId, setRackId] = useState(defaultRackId || '')
  const [saving, setSaving] = useState(false)
  const [parsed, setParsed] = useState([])
  const [parseErrors, setParseErrors] = useState([])

  // Parse on text change
  useEffect(() => {
    const lines = text.split('\n').filter((l) => l.trim())
    const results = []
    const errors = []

    lines.forEach((line, i) => {
      const parts = line.split(',').map((p) => p.trim())
      if (parts.length < 2 || !parts[0] || !parts[1]) {
        if (line.trim()) {
          errors.push(`Line ${i + 1}: Need at least name and manufacturer`)
        }
        return
      }

      const validCategories = ['voice', 'sequencer', 'modulation', 'effects', 'processing', 'controller', 'utility']
      const category = parts[2] && validCategories.includes(parts[2].toLowerCase())
        ? parts[2].toLowerCase()
        : null
      const hp = parts[3] ? parseInt(parts[3], 10) : null

      results.push({
        name: parts[0],
        manufacturer: parts[1],
        category,
        hp: hp && !isNaN(hp) ? hp : null,
      })
    })

    setParsed(results)
    setParseErrors(errors)
  }, [text])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (parsed.length === 0) return

    setSaving(true)
    try {
      await onSave(parsed, rackId || null)
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
      <div className="modal bulk-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="section-header">Bulk Add Modules</span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label className="modal-label">Assign to Rack</label>
            <select value={rackId} onChange={(e) => setRackId(e.target.value)}>
              <option value="">No rack (unassigned)</option>
              {racks.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          <div className="modal-field">
            <label className="modal-label">
              Modules — one per line: Name, Manufacturer, Category, HP
            </label>
            <textarea
              className="bulk-textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={EXAMPLE}
              rows={10}
              autoFocus
            />
            <span className="bulk-hint">
              Category and HP are optional. Valid categories: voice, sequencer, modulation, effects, processing, controller, utility
            </span>
          </div>

          {parseErrors.length > 0 && (
            <div className="bulk-errors">
              {parseErrors.map((err, i) => (
                <div key={i} className="bulk-error-line">{err}</div>
              ))}
            </div>
          )}

          <div className="bulk-preview">
            <span className="modal-label">
              Preview — {parsed.length} module{parsed.length !== 1 ? 's' : ''} detected
            </span>
            {parsed.length > 0 && (
              <div className="bulk-preview-list">
                {parsed.map((m, i) => (
                  <div key={i} className="bulk-preview-item">
                    <span className="bulk-preview-name">{m.name}</span>
                    <span className="bulk-preview-mfr">{m.manufacturer}</span>
                    {m.category && <span className="pill">{m.category}</span>}
                    {m.hp && <span className="bulk-preview-hp">{m.hp}hp</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || parsed.length === 0}
            >
              {saving
                ? 'Adding...'
                : `Add ${parsed.length} Module${parsed.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
