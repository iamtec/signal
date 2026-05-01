import { useState, useEffect } from 'react'
import './ModuleModal.css'

const CATEGORIES = [
  '',
  'voice',
  'sequencer',
  'modulation',
  'effects',
  'processing',
  'controller',
  'utility',
]

export default function ModuleModal({ module, defaultRackId, defaultIsController, racks = [], onSave, onClose, onRegenerateDelta }) {
  const isEdit = !!module

  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [category, setCategory] = useState('')
  const [hp, setHp] = useState('')
  const [personalNotes, setPersonalNotes] = useState('')
  const [rackId, setRackId] = useState('')
  const [isController, setIsController] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (module) {
      setName(module.name || '')
      setManufacturer(module.manufacturer || '')
      setCategory(module.category || '')
      setHp(module.hp != null ? String(module.hp) : '')
      setPersonalNotes(module.personal_notes || '')
      setRackId(module.rack_id || '')
      setIsController(module.is_controller || false)
    } else {
      setRackId(defaultRackId || '')
      setIsController(defaultIsController || false)
    }
  }, [module, defaultRackId, defaultIsController])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !manufacturer.trim()) return

    setSaving(true)
    try {
      await onSave({
        ...(module ? { id: module.id } : {}),
        name: name.trim(),
        manufacturer: manufacturer.trim(),
        category: category || null,
        hp: isController ? null : (hp ? parseInt(hp, 10) : null),
        personal_notes: personalNotes.trim() || null,
        rack_id: isController ? null : (rackId || null),
        is_controller: isController,
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
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="section-header">
            {isEdit ? (isController ? 'Edit Controller' : 'Edit Module') : (isController ? 'Add Controller' : 'Add Module')}
          </span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {/* Controller toggle */}
          <button
            type="button"
            className={`modal-controller-toggle ${isController ? 'active' : ''}`}
            onClick={() => setIsController(!isController)}
          >
            <span className="modal-controller-indicator">
              {isController ? '●' : '○'}
            </span>
            <span>External gear (not rack-mounted)</span>
          </button>

          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isController ? 'e.g. Oxi One Mk2' : 'e.g. Maths'}
                required
              />
            </div>
            <div className="modal-field">
              <label className="modal-label">Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder={isController ? 'e.g. OXI Instruments' : 'e.g. Make Noise'}
                required
              />
            </div>
          </div>

          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">—</option>
                {CATEGORIES.filter(Boolean).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {!isController && (
              <div className="modal-field modal-field-small">
                <label className="modal-label">HP</label>
                <input
                  type="number"
                  value={hp}
                  onChange={(e) => setHp(e.target.value)}
                  placeholder="—"
                  min="1"
                  max="84"
                />
              </div>
            )}
          </div>

          {!isController && racks.length > 0 && (
            <div className="modal-field">
              <label className="modal-label">Rack</label>
              <select value={rackId} onChange={(e) => setRackId(e.target.value)}>
                <option value="">No rack (unassigned)</option>
                {racks.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="modal-field">
            <label className="modal-label">Personal Notes</label>
            <textarea
              value={personalNotes}
              onChange={(e) => setPersonalNotes(e.target.value)}
              placeholder={isController
                ? "How do you use this? What does it control, what role does it play in your setup?"
                : "What's your relationship with this module? How do you use it, what do you like about it?"
              }
              rows={4}
            />
          </div>

          {isEdit && module.delta && (
            <div className="modal-delta">
              <div className="modal-delta-header">
                <span className="section-header" style={{ marginBottom: 0 }}>
                  From the manual — things to explore
                </span>
                {onRegenerateDelta && (
                  <button
                    type="button"
                    className="modal-delta-regen"
                    onClick={() => onRegenerateDelta(module)}
                  >
                    Regenerate
                  </button>
                )}
              </div>
              <p className="modal-delta-text">{module.delta}</p>
              {module.manual_url && (
                <a
                  className="modal-delta-source"
                  href={module.manual_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Source
                </a>
              )}
            </div>
          )}

          {isEdit && !module.delta && (
            <div className="modal-delta modal-delta-pending">
              <span className="section-header" style={{ marginBottom: 0 }}>
                From the manual — things to explore
              </span>
              <p className="modal-delta-text" style={{ color: 'var(--text3)' }}>
                Delta not yet extracted. It may still be processing.
              </p>
              {onRegenerateDelta && (
                <button
                  type="button"
                  className="modal-delta-regen"
                  onClick={() => onRegenerateDelta(module)}
                >
                  Generate
                </button>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving || !name.trim() || !manufacturer.trim()}>
              {saving ? 'Saving...' : isEdit ? 'Update' : (isController ? 'Save Controller' : 'Save Module')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
