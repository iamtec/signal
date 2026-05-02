import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import Markdown from '../components/Markdown'
import './Saved.css'

export default function Saved({ onViewLesson }) {
  const [lessons, setLessons] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null) // single ID or null
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

  const { favorites, history } = useMemo(() => {
    const favorites = lessons.filter((l) => l.is_favorite)
    const history = lessons.filter((l) => !l.is_favorite)
    return { favorites, history }
  }, [lessons])

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => prev === id ? null : id)
  }, [])

  const toggleFavorite = useCallback(async (id) => {
    const lesson = lessons.find((l) => l.id === id)
    if (!lesson) return
    const newVal = !lesson.is_favorite
    setLessons((prev) =>
      prev.map((l) => l.id === id ? { ...l, is_favorite: newVal } : l)
    )
    const { error } = await supabase
      .from('lessons')
      .update({ is_favorite: newVal })
      .eq('id', id)
    if (error) {
      setLessons((prev) =>
        prev.map((l) => l.id === id ? { ...l, is_favorite: !newVal } : l)
      )
    }
  }, [lessons])

  const handleDelete = useCallback(async (id) => {
    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (error) { console.error('Error deleting lesson:', error); return }
    setConfirming(null)
    setExpanded(null)
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

  // Find the expanded lesson for the mobile overlay
  const expandedLesson = expanded ? lessons.find((l) => l.id === expanded) : null

  const renderCard = (lesson) => {
    const isExpanded = expanded === lesson.id
    const moduleNames = getModuleNames(lesson)
    const date = new Date(lesson.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })

    return (
      <div key={lesson.id} className={`saved-card ${isExpanded ? 'is-expanded' : ''}`}>
        <div className="saved-card-header">
          <button
            className="saved-card-header-main"
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
          <button
            className={`saved-fav-btn ${lesson.is_favorite ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleFavorite(lesson.id) }}
          >
            {lesson.is_favorite ? '★' : '☆'}
          </button>
        </div>

        {/* Desktop inline expand */}
        {isExpanded && (
          <div className="saved-card-body saved-card-body-desktop">
            <div className="saved-card-content">
              <Markdown content={lesson.content} />
            </div>
            <div className="saved-card-actions">
              <button className="btn-secondary" onClick={() => handleView(lesson)}>
                View Full
              </button>
              {renderDeleteButton(lesson.id)}
            </div>
          </div>
        )}
      </div>
    )
  }

  function renderDeleteButton(id) {
    if (confirming === id) {
      return (
        <div className="saved-confirm">
          <span className="saved-confirm-text">Confirm?</span>
          <button className="saved-confirm-yes" onClick={() => handleDelete(id)}>Yes, delete</button>
          <button className="saved-confirm-no" onClick={() => setConfirming(null)}>Cancel</button>
        </div>
      )
    }
    return (
      <button className="saved-delete-btn" onClick={() => setConfirming(id)}>Delete</button>
    )
  }

  return (
    <div className="saved">
      <span className="section-header">Lessons</span>

      {loading ? (
        <div className="saved-empty">Loading...</div>
      ) : lessons.length === 0 ? (
        <div className="saved-empty">
          <p>No lessons yet.</p>
          <p className="saved-empty-sub">Generate a lesson from a new session to see it here.</p>
        </div>
      ) : (
        <div className="saved-sections">
          {favorites.length > 0 && (
            <div className="saved-section">
              <span className="saved-section-header">Favorites</span>
              <div className="saved-list">{favorites.map(renderCard)}</div>
            </div>
          )}
          <div className="saved-section">
            {favorites.length > 0 && <span className="saved-section-header">History</span>}
            {history.length > 0 ? (
              <div className="saved-list">{history.map(renderCard)}</div>
            ) : (
              favorites.length > 0 && (
                <div className="saved-history-empty">All your lessons are favorited.</div>
              )
            )}
          </div>
        </div>
      )}

      {/* Mobile full-screen overlay */}
      {expandedLesson && (
        <div className="saved-mobile-overlay">
          <div className="saved-mobile-overlay-header">
            <div className="saved-mobile-overlay-meta">
              <span className="saved-mobile-overlay-title">{expandedLesson.title}</span>
              <div className="saved-card-meta">
                <span className="pill">{expandedLesson.mode}</span>
                {expandedLesson.style_ref && (
                  <span className="saved-card-ref">{expandedLesson.style_ref}</span>
                )}
              </div>
            </div>
            <div className="saved-mobile-overlay-actions">
              <button
                className={`saved-fav-btn ${expandedLesson.is_favorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(expandedLesson.id)}
              >
                {expandedLesson.is_favorite ? '★' : '☆'}
              </button>
              <button className="saved-mobile-close" onClick={() => setExpanded(null)}>
                &times;
              </button>
            </div>
          </div>
          <div className="saved-mobile-overlay-content">
            <Markdown content={expandedLesson.content} />
          </div>
          <div className="saved-mobile-overlay-footer">
            <button className="btn-secondary" onClick={() => handleView(expandedLesson)}>
              View Full
            </button>
            {renderDeleteButton(expandedLesson.id)}
          </div>
        </div>
      )}
    </div>
  )
}
