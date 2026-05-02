import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { callAnthropic } from '../lib/anthropic'
import {
  ASK_SIGNAL_SYSTEM_PROMPT,
  buildAskSignalUserPrompt,
} from '../prompts'
import Markdown from '../components/Markdown'
import './AskSignal.css'

export default function AskSignal() {
  const [prompt, setPrompt] = useState('')
  const [crossRack, setCrossRack] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [resultId, setResultId] = useState(null)
  const [isFavorite, setIsFavorite] = useState(false)

  const [explorations, setExplorations] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [expanded, setExpanded] = useState(null) // single ID or null
  const [confirming, setConfirming] = useState(null)

  const fetchExplorations = useCallback(async () => {
    const { data } = await supabase
      .from('explorations')
      .select('*')
      .order('created_at', { ascending: false })
    setExplorations(data || [])
    setLoadingHistory(false)
  }, [])

  useEffect(() => {
    fetchExplorations()
  }, [fetchExplorations])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setError(null)
    setResult(null)
    setResultId(null)
    setIsFavorite(false)
    setStatusMsg('Thinking about your sound...')

    try {
      const [modulesRes, racksRes, profileRes] = await Promise.all([
        supabase.from('modules').select('*').order('created_at', { ascending: true }),
        supabase.from('racks').select('*').order('created_at', { ascending: true }),
        supabase.from('profile').select('*').limit(1).single(),
      ])

      const userPrompt = buildAskSignalUserPrompt(
        prompt,
        modulesRes.data || [],
        racksRes.data || [],
        profileRes.data || null,
        crossRack,
      )

      const content = await callAnthropic({
        systemPrompt: ASK_SIGNAL_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 4000,
        maxSearchUses: 5,
        onStatus: setStatusMsg,
      })

      const cleaned = content.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/[^\S\n]{2,}/g, ' ').trim()

      const { data: saved, error: saveErr } = await supabase
        .from('explorations')
        .insert({
          prompt: prompt.trim(),
          content: cleaned,
          cross_rack: crossRack,
          is_favorite: false,
        })
        .select()
        .single()

      if (saveErr) console.error('Error saving exploration:', saveErr)

      setResult(cleaned)
      setResultId(saved?.id || null)
      await fetchExplorations()
    } catch (err) {
      console.error('Ask Signal error:', err)
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }, [prompt, crossRack, fetchExplorations])

  const toggleFavorite = useCallback(async (id) => {
    if (!id) return
    const exploration = explorations.find((e) => e.id === id)
    const current = id === resultId ? isFavorite : (exploration?.is_favorite || false)
    const newVal = !current

    if (id === resultId) setIsFavorite(newVal)
    setExplorations((prev) =>
      prev.map((e) => e.id === id ? { ...e, is_favorite: newVal } : e)
    )

    const { error } = await supabase
      .from('explorations')
      .update({ is_favorite: newVal })
      .eq('id', id)

    if (error) {
      if (id === resultId) setIsFavorite(!newVal)
      setExplorations((prev) =>
        prev.map((e) => e.id === id ? { ...e, is_favorite: !newVal } : e)
      )
    }
  }, [explorations, resultId, isFavorite])

  const handleDelete = useCallback(async (id) => {
    const { error } = await supabase.from('explorations').delete().eq('id', id)
    if (error) { console.error('Error deleting exploration:', error); return }
    setConfirming(null)
    setExpanded(null)
    setExplorations((prev) => prev.filter((e) => e.id !== id))
    if (id === resultId) { setResult(null); setResultId(null) }
  }, [resultId])

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => prev === id ? null : id)
  }, [])

  const loadExploration = useCallback((exploration) => {
    setResult(exploration.content)
    setResultId(exploration.id)
    setIsFavorite(exploration.is_favorite)
    setPrompt(exploration.prompt)
    setCrossRack(exploration.cross_rack)
    setExpanded(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const favExplorations = explorations.filter((e) => e.is_favorite)
  const histExplorations = explorations.filter((e) => !e.is_favorite)
  const expandedExploration = expanded ? explorations.find((e) => e.id === expanded) : null

  function renderDeleteButton(id) {
    if (confirming === id) {
      return (
        <div className="ask-signal-confirm">
          <span className="ask-signal-confirm-text">Delete?</span>
          <button className="ask-signal-confirm-yes" onClick={() => handleDelete(id)}>Yes</button>
          <button className="ask-signal-confirm-no" onClick={() => setConfirming(null)}>Cancel</button>
        </div>
      )
    }
    return (
      <button className="ask-signal-delete-btn" onClick={() => setConfirming(id)}>Delete</button>
    )
  }

  function renderCard(ex) {
    const isExpanded = expanded === ex.id
    const date = new Date(ex.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })

    return (
      <div key={ex.id} className={`ask-signal-card ${isExpanded ? 'is-expanded' : ''}`}>
        <div className="ask-signal-card-header">
          <button
            className="ask-signal-card-main"
            onClick={() => toggleExpand(ex.id)}
          >
            <span className="ask-signal-card-prompt">{ex.prompt}</span>
            <div className="ask-signal-card-meta">
              {ex.cross_rack && <span className="pill">cross-rack</span>}
              <span className="ask-signal-card-date">{date}</span>
            </div>
          </button>
          <button
            className={`ask-signal-fav-btn ${ex.is_favorite ? 'active' : ''}`}
            onClick={() => toggleFavorite(ex.id)}
          >
            {ex.is_favorite ? '★' : '☆'}
          </button>
        </div>

        {/* Desktop inline expand */}
        {isExpanded && (
          <div className="ask-signal-card-body ask-signal-card-body-desktop">
            <div className="ask-signal-card-content">
              <Markdown content={ex.content} />
            </div>
            <div className="ask-signal-card-actions">
              <button className="btn-secondary" onClick={() => loadExploration(ex)}>Load</button>
              {renderDeleteButton(ex.id)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="ask-signal">
      <span className="section-header">Ask Signal</span>

      <div className="ask-signal-input-area">
        <div className="ask-signal-field">
          <label className="ask-signal-label">Describe the sound you want to make</label>
          <textarea
            className="ask-signal-textarea"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. A slow, breathing bass texture that pulses like a heartbeat with subtle metallic overtones that shimmer on the off-beats."
            rows={4}
          />
        </div>

        <div className="ask-signal-options">
          <button
            className={`ask-signal-crossrack ${crossRack ? 'active' : ''}`}
            onClick={() => setCrossRack(!crossRack)}
          >
            <span className="ask-signal-crossrack-indicator">
              {crossRack ? '●' : '○'}
            </span>
            <span>Allow cross-rack suggestions</span>
          </button>

          <button
            className="btn-primary ask-signal-generate"
            onClick={handleGenerate}
            disabled={generating || !prompt.trim()}
          >
            {generating ? statusMsg : 'Ask Signal'}
          </button>
        </div>
      </div>

      {error && <div className="ask-signal-error">{error}</div>}

      {result && (
        <div className="ask-signal-result">
          <div className="ask-signal-result-header">
            <span className="ask-signal-result-prompt">{prompt}</span>
            <div className="ask-signal-result-actions">
              {crossRack && <span className="pill">cross-rack</span>}
              {resultId && (
                <button
                  className={`ask-signal-fav-btn ${isFavorite ? 'active' : ''}`}
                  onClick={() => toggleFavorite(resultId)}
                >
                  {isFavorite ? '★' : '☆'}
                </button>
              )}
            </div>
          </div>
          <div className="ask-signal-result-content">
            <Markdown content={result} />
          </div>
        </div>
      )}

      {!loadingHistory && explorations.length > 0 && (
        <div className="ask-signal-history">
          <span className="section-header" style={{ marginTop: '40px' }}>Past Explorations</span>

          {favExplorations.length > 0 && (
            <div className="ask-signal-history-section">
              <span className="ask-signal-history-label">Favorites</span>
              <div className="ask-signal-history-list">{favExplorations.map(renderCard)}</div>
            </div>
          )}

          {histExplorations.length > 0 && (
            <div className="ask-signal-history-section">
              {favExplorations.length > 0 && <span className="ask-signal-history-label">History</span>}
              <div className="ask-signal-history-list">{histExplorations.map(renderCard)}</div>
            </div>
          )}
        </div>
      )}

      {/* Mobile full-screen overlay */}
      {expandedExploration && (
        <div className="ask-signal-mobile-overlay">
          <div className="ask-signal-mobile-overlay-header">
            <div className="ask-signal-mobile-overlay-meta">
              <span className="ask-signal-mobile-overlay-prompt">{expandedExploration.prompt}</span>
              {expandedExploration.cross_rack && <span className="pill">cross-rack</span>}
            </div>
            <div className="ask-signal-mobile-overlay-actions">
              <button
                className={`ask-signal-fav-btn ${expandedExploration.is_favorite ? 'active' : ''}`}
                onClick={() => toggleFavorite(expandedExploration.id)}
              >
                {expandedExploration.is_favorite ? '★' : '☆'}
              </button>
              <button className="ask-signal-mobile-close" onClick={() => setExpanded(null)}>
                &times;
              </button>
            </div>
          </div>
          <div className="ask-signal-mobile-overlay-content">
            <Markdown content={expandedExploration.content} />
          </div>
          <div className="ask-signal-mobile-overlay-footer">
            <button className="btn-secondary" onClick={() => loadExploration(expandedExploration)}>Load</button>
            {renderDeleteButton(expandedExploration.id)}
          </div>
        </div>
      )}
    </div>
  )
}
