import { useState, useEffect } from 'react'
import './ModuleModal.css'

export default function RackModal({ rack, onSave, onClose, onDelete }) {
  const isEdit = !!rack

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [hpCapacity, setHpCapacity] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (rack) {
      setName(rack.name || '')
      setDescription(rack.description || '')
      setHpCapacity(rack.hp_capacity != null ? String(rack.hp_capacity) : '')
    }
  }, [rack])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      await onSave({
        ...(rack ? { id: rack.id } : {}),
        name: name.trim(),
        description: description.trim() || null,
        hp_capacity: hpCapacity ? parseInt(hpCapacity, 10) : null,
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
            {isEdit ? 'Edit Rack' : 'Add Rack'}
          </span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          <div className="modal-row">
            <div className="modal-field">
              <label className="modal-label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Performance Case"
                required
                autoFocus
              />
            </div>
            <div className="modal-field modal-field-small" style={{ flex: '0 0 100px' }}>
              <label className="modal-label">HP Capacity</label>
              <input
                type="number"
                value={hpCapacity}
                onChange={(e) => setHpCapacity(e.target.value)}
                placeholder="—"
                min="1"
                max="500"
              />
            </div>
          </div>

          <div className="modal-field">
            <label className="modal-label">Purpose / Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this rack for? Studio processing, live performance, sound design..."
              rows={3}
            />
          </div>

          <div className="modal-actions" style={{ justifyContent: 'space-between' }}>
            <div>
              {isEdit && onDelete && (
                confirmDelete ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      color: 'var(--text2)',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}>
                      Modules will be unassigned.
                    </span>
                    <button
                      type="button"
                      className="saved-confirm-yes"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#e25555',
                        padding: '4px 10px',
                        border: '1px solid rgba(226, 85, 85, 0.3)',
                        borderRadius: '2px',
                        background: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => onDelete(rack.id)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10px',
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: 'var(--text3)',
                        padding: '4px 10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '10px',
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: 'var(--text3)',
                      padding: '6px 12px',
                      border: '1px solid var(--border)',
                      background: 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setConfirmDelete(true)}
                  >
                    Delete Rack
                  </button>
                )
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving || !name.trim()}>
                {saving ? 'Saving...' : isEdit ? 'Update' : 'Create Rack'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
