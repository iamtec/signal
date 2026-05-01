import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from '../components/Markdown'
import './Lesson.css'

export default function Lesson({ lessonData, onNewSession, onStartOver }) {
  const [isFavorite, setIsFavorite] = useState(lessonData?.is_favorite || false)

  const toggleFavorite = useCallback(async () => {
    if (!lessonData?.id) return

    const newVal = !isFavorite
    setIsFavorite(newVal) // optimistic

    const { error } = await supabase
      .from('lessons')
      .update({ is_favorite: newVal })
      .eq('id', lessonData.id)

    if (error) {
      console.error('Error toggling favorite:', error)
      setIsFavorite(!newVal) // revert
    }
  }, [lessonData, isFavorite])

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
        <div className="lesson-meta-top">
          <div className="lesson-meta-row">
            <span className="pill">{lessonData.mode}</span>
            {lessonData.styleRef && (
              <span className="lesson-meta-ref">{lessonData.styleRef}</span>
            )}
            {formattedDate && (
              <span className="lesson-meta-date">{formattedDate}</span>
            )}
          </div>
          {lessonData.id && (
            <button
              className={`lesson-fav-btn ${isFavorite ? 'active' : ''}`}
              onClick={toggleFavorite}
              title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          )}
        </div>

        {lessonData.title && (
          <span className="lesson-meta-title">{lessonData.title}</span>
        )}

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
