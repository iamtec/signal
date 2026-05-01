import { useState, useEffect, useCallback } from 'react'
import Layout from './components/Layout'
import Library from './views/Library'
import NewSession from './views/NewSession'
import Lesson from './views/Lesson'
import Saved from './views/Saved'

const ROUTES = {
  '/': 'library',
  '/library': 'library',
  '/session': 'session',
  '/lesson': 'lesson',
  '/saved': 'saved',
}

function getViewFromPath() {
  const path = window.location.pathname
  return ROUTES[path] || 'library'
}

export default function App() {
  const [currentView, setCurrentView] = useState(getViewFromPath)
  const [lessonData, setLessonData] = useState(null)
  const [viewLessonData, setViewLessonData] = useState(null)

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

  const handleLessonGenerated = useCallback((data) => {
    setLessonData(data)
    navigate('lesson')
  }, [navigate])

  const handleViewSavedLesson = useCallback((lesson) => {
    setViewLessonData(lesson)
    navigate('lesson')
  }, [navigate])

  const handleNewSession = useCallback(() => {
    setLessonData(null)
    setViewLessonData(null)
    navigate('session')
  }, [navigate])

  const handleStartOver = useCallback(() => {
    setLessonData(null)
    setViewLessonData(null)
    navigate('library')
  }, [navigate])

  const handleLessonSaved = useCallback(() => {
    setLessonData(null)
    setViewLessonData(null)
  }, [])

  const renderView = () => {
    switch (currentView) {
      case 'library':
        return <Library />
      case 'session':
        return <NewSession onLessonGenerated={handleLessonGenerated} />
      case 'lesson':
        return (
          <Lesson
            lessonData={viewLessonData || lessonData}
            isSaved={!!viewLessonData}
            onNewSession={handleNewSession}
            onStartOver={handleStartOver}
            onSaved={handleLessonSaved}
          />
        )
      case 'saved':
        return <Saved onViewLesson={handleViewSavedLesson} />
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
