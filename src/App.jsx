import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Library from './views/Library'
import NewSession from './views/NewSession'
import Lesson from './views/Lesson'
import Saved from './views/Saved'
import Profile from './views/Profile'

const ROUTES = {
  '/': 'library',
  '/library': 'library',
  '/session': 'session',
  '/lesson': 'lesson',
  '/saved': 'saved',
  '/profile': 'profile',
}

function getViewFromPath() {
  const path = window.location.pathname
  return ROUTES[path] || 'library'
}

function generateTitle(goal, mode) {
  if (goal && goal.trim()) {
    const trimmed = goal.trim()
    if (trimmed.length <= 50) return trimmed
    const cut = trimmed.slice(0, 50)
    const lastSpace = cut.lastIndexOf(' ')
    return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut) + '...'
  }
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${mode.toUpperCase()} session — ${date}`
}

export default function App() {
  const [currentView, setCurrentView] = useState(getViewFromPath)
  const [lessonData, setLessonData] = useState(null)

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getViewFromPath())
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((view) => {
    const path = view === 'library' ? '/' : `/${view}`
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path)
    }
    setCurrentView(view)
  }, [])

  const handleLessonGenerated = useCallback(async (data) => {
    const title = generateTitle(data.goal, data.mode)

    const { data: saved, error } = await supabase
      .from('lessons')
      .insert({
        title,
        mode: data.mode,
        module_ids: data.moduleIds,
        style_ref: data.styleRef || null,
        goal: data.goal,
        content: data.content,
        is_favorite: false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error auto-saving lesson:', error)
      setLessonData({ ...data, title, id: null, is_favorite: false })
    } else {
      setLessonData({
        ...data,
        id: saved.id,
        title: saved.title,
        is_favorite: saved.is_favorite,
        createdAt: saved.created_at,
      })
    }

    navigate('lesson')
  }, [navigate])

  const handleViewSavedLesson = useCallback((lesson) => {
    setLessonData(lesson)
    navigate('lesson')
  }, [navigate])

  const handleNewSession = useCallback(() => {
    setLessonData(null)
    navigate('session')
  }, [navigate])

  const handleStartOver = useCallback(() => {
    setLessonData(null)
    navigate('library')
  }, [navigate])

  const handleDeleteLesson = useCallback(async (lessonId) => {
    const { error } = await supabase.from('lessons').delete().eq('id', lessonId)
    if (error) {
      console.error('Error deleting lesson:', error)
      return
    }
    setLessonData(null)
    navigate('saved')
  }, [navigate])

  const renderView = () => {
    switch (currentView) {
      case 'library':
        return <Library />
      case 'session':
        return <NewSession onLessonGenerated={handleLessonGenerated} />
      case 'lesson':
        return (
          <Lesson
            lessonData={lessonData}
            onNewSession={handleNewSession}
            onStartOver={handleStartOver}
            onDelete={handleDeleteLesson}
          />
        )
      case 'saved':
        return <Saved onViewLesson={handleViewSavedLesson} />
      case 'profile':
        return <Profile />
      default:
        return <Library />
    }
  }

  return (
    <Layout currentView={currentView} onNavigate={navigate}>
      {renderView()}
    </Layout>
  )
}
