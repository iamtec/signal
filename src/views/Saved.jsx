import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from '../components/Markdown'
import './Saved.css'

export default function Saved({ onViewLesson }) {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(new Set())
  const [confirming, setConfirming] = useState(null)
  const [modules, setModules] = useState({})

  const fetchLessons = useCallback(async () => {
    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching lessons:', error)
    } else {
      setLessons(data || [])
    }
    setLoading(false)
  }, [])

  const fetchModules = useCallback(async () => {
    const { data } = await supabase.from('modules').select('id, name, category')
    if (data) {
      const map = {}
      data.forEach((m) => { map[m.id] = m })
      setModules(map)
    }
  }, [])

  useEffect(() => {
    fetchLessons()
    fetchModules()
  }, [fetchLessons, fetchModules])

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleDelete = useCallback(async (id) => {
    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (error) {
      console.error('Error deleting lesson:', error)
      return
    }
    setConfirming(null)
    setLessons((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const handleView = useCallback((lesson) => {
    const lessonModules = (lesson.module_ids || [])
      .map((id) => modules[id])
      .filter(Boolean)

    onViewLesson({
      ...lesson,
      modules: lessonModules,
      moduleIds: lesson.module_ids || [],
      styleRef: lesson.style_ref,
      createdAt: lesson.created_at,
    })
  }, [modules, onViewLesson])

  const getModuleNames = (lesson) => {
    return (lesson.module_ids || [])
      .map((id) => modules[id]?.name)
      .filter(Boolean)
  }

  return (
    <div className="saved">
      <span className="section-header">Saved Lessons</span>

      {loading ? (
        <div className="saved-empty">Loading...</div>
      ) : lessons.length === 0 ? (
        <div className="saved-empty">
          <p>No saved lessons yet.</p>
          <p className="saved-empty-sub">
            Generate a lesson and save it to see it here.
          </p>
        </div>
      ) : (
        <div className="saved-list">
          {lessons.map((lesson) => {
            const isExpanded = expanded.has(lesson.id)
            const moduleNames = getModuleNames(lesson)
            const date = new Date(lesson.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })

            return (
              <div key={lesson.id} className="saved-card">
                <button
                  className="saved-card-header"
                  onClick={() => toggleExpand(lesson.id)}
                >
                  <div className="saved-card-top">
                    <span className="saved-card-title">{lesson.title}</span>
                    <span className="saved-card-chevron">
                      {isExpanded ? '−' : '+'}
                    </span>
                  </div>
                  <div className="saved-card-meta">
                    <span className="pill">{lesson.mode}</span>
                    {lesson.style_ref && (
                      <span className="saved-card-ref">{lesson.style_ref}</span>
                    )}
                    <span className="saved-card-date">{date}</span>
                  </div>
                  {moduleNames.length > 0 && (
                    <div className="saved-card-modules">
                      {moduleNames.map((name, i) => (
                        <span key={i} className="saved-module-pill">{name}</span>
                      ))}
                    </div>
                  )}
                </button>

                {isExpanded && (
                  <div className="saved-card-body">
                    <div className="saved-card-content">
                      <Markdown content={lesson.content} />
                    </div>
                    <div className="saved-card-actions">
                      <button
                        className="btn-secondary"
                        onClick={() => handleView(lesson)}
                      >
                        View Full
                      </button>
                      {confirming === lesson.id ? (
                        <div className="saved-confirm">
                          <span className="saved-confirm-text">Confirm?</span>
                          <button
                            className="saved-confirm-yes"
                            onClick={() => handleDelete(lesson.id)}
                          >
                            Yes, delete
                          </button>
                          <button
                            className="saved-confirm-no"
                            onClick={() => setConfirming(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="saved-delete-btn"
                          onClick={() => setConfirming(lesson.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
