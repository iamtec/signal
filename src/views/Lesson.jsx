import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from '../components/Markdown'
import './Lesson.css'

export default function Lesson({ lessonData, isSaved, onNewSession, onStartOver, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [showTitleInput, setShowTitleInput] = useState(false)
  const [title, setTitle] = useState('')
  const [saved, setSaved] = useState(isSaved)

  const handleSave = useCallback(async () => {
    if (!title.trim()) return

    setSaving(true)
    try {
      const { error } = await supabase.from('lessons').insert({
        title: title.trim(),
        mode: lessonData.mode,
        module_ids: lessonData.moduleIds,
        style_ref: lessonData.styleRef || null,
        goal: lessonData.goal,
        content: lessonData.content,
      })

      if (error) {
        console.error('Error saving lesson:', error)
        return
      }

      setSaved(true)
      setShowTitleInput(false)
      if (onSaved) onSaved()
    } finally {
      setSaving(false)
    }
  }, [title, lessonData, onSaved])

  if (!lessonData) {
    return (
      <div className="lesson">
        <div className="lesson-empty">
          No lesson to display. Start a new session to generate one.
        </div>
      </div>
    )
  }

  const date = lessonData.createdAt || lessonData.created_at
  const formattedDate = date
    ? new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div className="lesson">
      <div className="lesson-meta">
        <div className="lesson-meta-row">
          <span className="pill">{lessonData.mode}</span>
          {lessonData.styleRef && (
            <span className="lesson-meta-ref">{lessonData.styleRef}</span>
          )}
          {formattedDate && (
            <span className="lesson-meta-date">{formattedDate}</span>
          )}
        </div>

        {lessonData.modules && lessonData.modules.length > 0 && (
          <div className="lesson-meta-modules">
            {lessonData.modules.map((m) => (
              <span key={m.id} className="lesson-module-pill">{m.name}</span>
            ))}
          </div>
        )}

        {lessonData.goal && (
          <p className="lesson-meta-goal">{lessonData.goal}</p>
        )}
      </div>

      <div className="lesson-content">
        <Markdown content={lessonData.content} />
      </div>

      <div className="lesson-actions">
        {!saved && !showTitleInput && (
          <button
            className="btn-primary"
            onClick={() => setShowTitleInput(true)}
          >
            Save Lesson
          </button>
        )}

        {!saved && showTitleInput && (
          <div className="lesson-save-row">
            <input
              type="text"
              className="lesson-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this lesson a title"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') setShowTitleInput(false)
              }}
            />
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving || !title.trim()}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowTitleInput(false)}
            >
              Cancel
            </button>
          </div>
        )}

        {saved && (
          <span className="lesson-saved-label">Saved</span>
        )}

        <div className="lesson-nav-actions">
          <button className="btn-secondary" onClick={onNewSession}>
            New Session
          </button>
          <button className="btn-secondary" onClick={onStartOver}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  )
}
