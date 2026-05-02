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

  // Past explorations
  const [explorations, setExplorations] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [expanded, setExpanded] = useState(new Set())
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
      // Fetch all context
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

      // Strip cite tags, preserve newlines
      const cleaned = content.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/[^\S\n]{2,}/g, ' ').trim()

      // Auto-save
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

      if (saveErr) {
        console.error('Error saving exploration:', saveErr)
      }

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

    // Optimistic
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
    setExplorations((prev) => prev.filter((e) => e.id !== id))
    if (id === resultId) {
      setResult(null)
      setResultId(null)
    }
  }, [resultId])

  const toggleExpand = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const loadExploration = useCallback((exploration) => {
    setResult(exploration.content)
    setResultId(exploration.id)
    setIsFavorite(exploration.is_favorite)
    setPrompt(exploration.prompt)
    setCrossRack(exploration.cross_rack)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const favorites = explorations.filter((e) => e.is_favorite)
  const history = explorations.filter((e) => !e.is_favorite)

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
            placeholder="e.g. A slow, breathing bass texture that pulses like a heartbeat with subtle metallic overtones that shimmer on the off-beats. Dark but not aggressive — more like something you'd hear in a Burial interlude."
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

      {error && (
        <div className="ask-signal-error">{error}</div>
      )}

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

      {/* History */}
      {!loadingHistory && explorations.length > 0 && (
        <div className="ask-signal-history">
          <span className="section-header" style={{ marginTop: '40px' }}>Past Explorations</span>

          {favorites.length > 0 && (
            <div className="ask-signal-history-section">
              <span className="ask-signal-history-label">Favorites</span>
              <div className="ask-signal-history-list">
                {favorites.map((ex) => renderCard(ex))}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="ask-signal-history-section">
              {favorites.length > 0 && (
                <span className="ask-signal-history-label">History</span>
              )}
              <div className="ask-signal-history-list">
                {history.map((ex) => renderCard(ex))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )

  function renderCard(ex) {
    const isExpanded = expanded.has(ex.id)
    const date = new Date(ex.created_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })

    return (
      <div key={ex.id} className="ask-signal-card">
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

        {isExpanded && (
          <div className="ask-signal-card-body">
            <div className="ask-signal-card-content">
              <Markdown content={ex.content} />
            </div>
            <div className="ask-signal-card-actions">
              <button
                className="btn-secondary"
                onClick={() => loadExploration(ex)}
              >
                Load
              </button>
              {confirming === ex.id ? (
                <div className="ask-signal-confirm">
                  <span className="ask-signal-confirm-text">Delete?</span>
                  <button className="ask-signal-confirm-yes" onClick={() => handleDelete(ex.id)}>Yes</button>
                  <button className="ask-signal-confirm-no" onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              ) : (
                <button
                  className="ask-signal-delete-btn"
                  onClick={() => setConfirming(ex.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
}
