import { useState, useEffect, useCallback } from 'react'
import './BulkEditModal.css'

const CATEGORIES = ['', 'voice', 'sequencer', 'modulation', 'effects', 'processing', 'controller', 'utility']

export default function BulkEditModal({ modules, rackName, onSave, onRegenerateAll, onClose }) {
  // Local editable state for each module
  const [edits, setEdits] = useState({})
  const [toDelete, setToDelete] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [confirmRegenAll, setConfirmRegenAll] = useState(false)

  useEffect(() => {
    // Initialize edits from module data
    const initial = {}
    modules.forEach((m) => {
      initial[m.id] = {
        personal_notes: m.personal_notes || '',
        category: m.category || '',
      }
    })
    setEdits(initial)
  }, [modules])

  const updateField = useCallback((id, field, value) => {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }))
  }, [])

  const toggleDelete = useCallback((id) => {
    setToDelete((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Build list of updates (only modules that changed and aren't deleted)
      const updates = []
      modules.forEach((m) => {
        if (toDelete.has(m.id)) return
        const edit = edits[m.id]
        if (!edit) return
        const notesChanged = (edit.personal_notes || '') !== (m.personal_notes || '')
        const catChanged = (edit.category || '') !== (m.category || '')
        if (notesChanged || catChanged) {
          updates.push({
            id: m.id,
            personal_notes: edit.personal_notes.trim() || null,
            category: edit.category || null,
          })
        }
      })

      const deleteIds = [...toDelete]

      await onSave(updates, deleteIds)
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerateAll = useCallback(async () => {
    // Save current edits first
    setSaving(true)
    try {
      const updates = []
      modules.forEach((m) => {
        if (toDelete.has(m.id)) return
        const edit = edits[m.id]
        if (!edit) return
        const notesChanged = (edit.personal_notes || '') !== (m.personal_notes || '')
        const catChanged = (edit.category || '') !== (m.category || '')
        if (notesChanged || catChanged) {
          updates.push({
            id: m.id,
            personal_notes: edit.personal_notes.trim() || null,
            category: edit.category || null,
          })
        }
      })
      const deleteIds = [...toDelete]
      await onSave(updates, deleteIds)
    } finally {
      setSaving(false)
    }

    // Then trigger regeneration for non-deleted modules
    const activeList = modules.filter((m) => !toDelete.has(m.id))
    if (onRegenerateAll && activeList.length > 0) {
      onRegenerateAll(activeList)
    }
  }, [modules, edits, toDelete, onSave, onRegenerateAll])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const activeModules = modules.filter((m) => !toDelete.has(m.id))
  const deletedCount = toDelete.size

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bulk-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="section-header">
            {rackName ? `Edit — ${rackName}` : 'Bulk Edit Modules'}
          </span>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>

        <form className="bulk-edit-form" onSubmit={handleSubmit}>
          <div className="bulk-edit-list">
            {modules.map((m) => {
              const edit = edits[m.id] || { personal_notes: '', category: '' }
              const isDeleted = toDelete.has(m.id)

              return (
                <div key={m.id} className={`bulk-edit-item ${isDeleted ? 'deleted' : ''}`}>
                  <div className="bulk-edit-item-header">
                    <div className="bulk-edit-item-info">
                      <span className="bulk-edit-item-name">{m.name}</span>
                      <span className="bulk-edit-item-mfr">{m.manufacturer}</span>
                      {m.hp && <span className="bulk-edit-item-hp">{m.hp}hp</span>}
                    </div>
                    <button
                      type="button"
                      className={`bulk-edit-delete-btn ${isDeleted ? 'undo' : ''}`}
                      onClick={() => toggleDelete(m.id)}
                    >
                      {isDeleted ? 'Undo' : '×'}
                    </button>
                  </div>

                  {!isDeleted && (
                    <div className="bulk-edit-item-fields">
                      <div className="bulk-edit-field-row">
                        <select
                          className="bulk-edit-category"
                          value={edit.category}
                          onChange={(e) => updateField(m.id, 'category', e.target.value)}
                        >
                          <option value="">Category</option>
                          {CATEGORIES.filter(Boolean).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        className="bulk-edit-notes"
                        value={edit.personal_notes}
                        onChange={(e) => updateField(m.id, 'personal_notes', e.target.value)}
                        placeholder="Your notes on this module..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="bulk-edit-footer">
            <div className="bulk-edit-footer-left">
              <span className="bulk-edit-summary">
                {activeModules.length} module{activeModules.length !== 1 ? 's' : ''}
                {deletedCount > 0 && (
                  <span className="bulk-edit-delete-count"> — {deletedCount} to delete</span>
                )}
              </span>
              {onRegenerateAll && (
                confirmRegenAll ? (
                  <div className="bulk-edit-regen-confirm">
                    <span className="bulk-edit-regen-confirm-text">Save + regenerate all deltas?</span>
                    <button
                      type="button"
                      className="bulk-edit-regen-yes"
                      onClick={handleRegenerateAll}
                      disabled={saving}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className="bulk-edit-regen-no"
                      onClick={() => setConfirmRegenAll(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="bulk-edit-regen-btn"
                    onClick={() => setConfirmRegenAll(true)}
                    disabled={saving}
                  >
                    Regenerate All Deltas
                  </button>
                )
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" className="btn-secondary" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
