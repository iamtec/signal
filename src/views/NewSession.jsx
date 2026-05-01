import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { callAnthropic } from '../lib/anthropic'
import {
  LEARN_SYSTEM_PROMPT,
  SET_SYSTEM_PROMPT,
  buildLessonUserPrompt,
} from '../prompts'
import ModuleCard from '../components/ModuleCard'
import ProgressBar from '../components/ProgressBar'
import './NewSession.css'

const MAX_MODULES = 6

export default function NewSession({ onLessonGenerated }) {
  const [step, setStep] = useState(1)
  const [modules, setModules] = useState([])
  const [racks, setRacks] = useState([])
  const [profile, setProfile] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])
  const [mode, setMode] = useState('learn')
  const [styleRef, setStyleRef] = useState('')
  const [goal, setGoal] = useState('')
  const [generating, setGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    async function load() {
      const [modulesRes, racksRes, profileRes] = await Promise.all([
        supabase.from('modules').select('*').order('created_at', { ascending: true }),
        supabase.from('racks').select('*').order('created_at', { ascending: true }),
        supabase.from('profile').select('*').limit(1).single(),
      ])
      setModules(modulesRes.data || [])
      setRacks(racksRes.data || [])
      if (profileRes.data) setProfile(profileRes.data)
    }
    load()
  }, [])

  // Split controllers from rack modules, group by rack
  const { controllers, rackGroups, unassigned } = useMemo(() => {
    const controllers = modules.filter((m) => m.is_controller)
    const rackMods = modules.filter((m) => !m.is_controller)
    const groups = racks.map((rack) => ({
      rack,
      modules: rackMods.filter((m) => m.rack_id === rack.id),
    })).filter((g) => g.modules.length > 0)
    const unassigned = rackMods.filter((m) => !m.rack_id)
    return { controllers, rackGroups: groups, unassigned }
  }, [modules, racks])

  const toggleModule = useCallback((mod) => {
    setSelectedIds((prev) => {
      if (prev.includes(mod.id)) {
        return prev.filter((id) => id !== mod.id)
      }
      if (prev.length >= MAX_MODULES) return prev
      return [...prev, mod.id]
    })
  }, [])

  const selectedModules = modules.filter((m) => selectedIds.includes(m.id))

  const canAdvanceStep2 = selectedIds.length > 0
  const canAdvanceStep3 = goal.trim().length > 0

  const handleGenerate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    setStatusMsg('Reading the room...')

    try {
      const systemPrompt = mode === 'learn' ? LEARN_SYSTEM_PROMPT : SET_SYSTEM_PROMPT
      const userPrompt = buildLessonUserPrompt(
        selectedModules,
        modules,
        styleRef,
        goal,
        mode,
        profile,
      )

      const content = await callAnthropic({
        systemPrompt,
        userPrompt,
        maxTokens: 3000,
        maxSearchUses: 5,
        onStatus: setStatusMsg,
      })

      onLessonGenerated({
        content,
        mode,
        styleRef,
        goal,
        moduleIds: selectedIds,
        modules: selectedModules,
        allModules: modules,
        createdAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('Generation error:', err)
      setError(err.message)
      setGenerating(false)
    }
  }, [mode, styleRef, goal, selectedIds, selectedModules, modules, onLessonGenerated])

  const renderModuleGrid = (mods) => (
    <div className="session-module-grid">
      {mods.map((mod) => (
        <ModuleCard
          key={mod.id}
          module={mod}
          onClick={toggleModule}
          selected={selectedIds.includes(mod.id)}
          selectable
        />
      ))}
    </div>
  )

  return (
    <div className="new-session">
      <span className="section-header">New Session</span>
      <ProgressBar currentStep={step} />

      {/* Step 1: Select modules */}
      {step === 1 && (
        <div className="session-step">
          <p className="session-step-desc">
            Select up to {MAX_MODULES} modules for this session.
          </p>

          {modules.length === 0 ? (
            <div className="session-empty">
              No modules in your library yet. Add some from the Library view first.
            </div>
          ) : (
            <div className="session-rack-groups">
              {controllers.length > 0 && (
                <div className="session-rack-group">
                  <div className="session-rack-label">
                    <span className="session-rack-name">Controllers &amp; External Gear</span>
                  </div>
                  {renderModuleGrid(controllers)}
                </div>
              )}
              {rackGroups.map(({ rack, modules: rackMods }) => (
                <div key={rack.id} className="session-rack-group">
                  <div className="session-rack-label">
                    <span className="session-rack-name">{rack.name}</span>
                    {rack.description && (
                      <span className="session-rack-desc">{rack.description}</span>
                    )}
                  </div>
                  {renderModuleGrid(rackMods)}
                </div>
              ))}
              {unassigned.length > 0 && (
                <div className="session-rack-group">
                  {(rackGroups.length > 0 || controllers.length > 0) && (
                    <div className="session-rack-label">
                      <span className="session-rack-name unassigned">Unassigned</span>
                    </div>
                  )}
                  {renderModuleGrid(unassigned)}
                </div>
              )}
            </div>
          )}

          <div className="session-footer">
            <span className="session-count">
              {selectedIds.length}/{MAX_MODULES} selected
            </span>
            <button
              className="btn-primary"
              onClick={() => setStep(2)}
              disabled={!canAdvanceStep2}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Mode and intent */}
      {step === 2 && (
        <div className="session-step">
          <div className="session-field">
            <label className="session-label">Mode</label>
            <div className="session-mode-toggle">
              <button
                className={`session-mode-btn ${mode === 'learn' ? 'active' : ''}`}
                onClick={() => setMode('learn')}
              >
                Learn
              </button>
              <button
                className={`session-mode-btn ${mode === 'set' ? 'active' : ''}`}
                onClick={() => setMode('set')}
              >
                Set
              </button>
            </div>
          </div>

          <div className="session-field">
            <label className="session-label">
              Who's approach are you channeling?
            </label>
            <input
              type="text"
              value={styleRef}
              onChange={(e) => setStyleRef(e.target.value)}
              placeholder="e.g. Rival Consoles, Flying Lotus, Rødhåd"
            />
          </div>

          <div className="session-field">
            <label className="session-label">
              What do you want to figure out?
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Be specific. What technique, sound, or challenge are you working on?"
              rows={4}
            />
          </div>

          <div className="session-footer">
            <button className="btn-secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn-primary"
              onClick={() => setStep(3)}
              disabled={!canAdvanceStep3}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Generate */}
      {step === 3 && (
        <div className="session-step">
          <div className="session-summary">
            <div className="session-summary-section">
              <span className="session-label">Modules</span>
              <div className="session-summary-pills">
                {selectedModules.map((m) => (
                  <span key={m.id} className="pill">{m.name}</span>
                ))}
              </div>
            </div>

            <div className="session-summary-section">
              <span className="session-label">Mode</span>
              <span className="pill">{mode}</span>
            </div>

            {styleRef && (
              <div className="session-summary-section">
                <span className="session-label">Style Reference</span>
                <span className="session-summary-value">{styleRef}</span>
              </div>
            )}

            <div className="session-summary-section">
              <span className="session-label">Goal</span>
              <span className="session-summary-value">{goal}</span>
            </div>
          </div>

          {error && (
            <div className="session-error">
              {error}
            </div>
          )}

          <div className="session-footer">
            <button
              className="btn-secondary"
              onClick={() => setStep(2)}
              disabled={generating}
            >
              Back
            </button>
            <button
              className="btn-primary btn-generate"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? statusMsg : 'Generate'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
