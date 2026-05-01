import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { callAnthropic } from '../lib/anthropic'
import {
  REFLECTION_SYSTEM_PROMPT,
  buildReflectionUserPrompt,
} from '../prompts'
import Markdown from '../components/Markdown'
import './Profile.css'

export default function Profile() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notes, setNotes] = useState('')
  const [signalChains, setSignalChains] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState(null)
  const saveTimeout = useRef(null)

  // Fetch profile + supporting data
  const fetchProfile = useCallback(async () => {
    const { data, error } = await supabase
      .from('profile')
      .select('*')
      .limit(1)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      // If no row exists, create one
      if (error.code === 'PGRST116') {
        const { data: created } = await supabase
          .from('profile')
          .insert({ notes: '', signal_chains: '' })
          .select()
          .single()
        if (created) {
          setProfile(created)
          setNotes(created.notes || '')
          setSignalChains(created.signal_chains || '')
        }
      }
    } else {
      setProfile(data)
      setNotes(data.notes || '')
      setSignalChains(data.signal_chains || '')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Auto-save with debounce
  const saveProfile = useCallback(async (newNotes, newChains) => {
    if (!profile) return
    setSaving(true)
    setSaved(false)

    const { error } = await supabase
      .from('profile')
      .update({
        notes: newNotes,
        signal_chains: newChains,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id)

    if (error) {
      console.error('Error saving profile:', error)
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }, [profile])

  const handleNotesChange = useCallback((val) => {
    setNotes(val)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveProfile(val, signalChains), 1000)
  }, [signalChains, saveProfile])

  const handleChainsChange = useCallback((val) => {
    setSignalChains(val)
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveProfile(notes, val), 1000)
  }, [notes, saveProfile])

  // Generate reflections
  const generateReflections = useCallback(async () => {
    if (!profile) return
    setGenerating(true)
    setError(null)
    setStatusMsg('Analyzing your practice...')

    try {
      // Fetch all data for the reflection
      const [modulesRes, racksRes, lessonsRes] = await Promise.all([
        supabase.from('modules').select('*').order('created_at', { ascending: true }),
        supabase.from('racks').select('*').order('created_at', { ascending: true }),
        supabase.from('lessons').select('id, title, mode, style_ref, goal, created_at').order('created_at', { ascending: false }),
      ])

      const currentProfile = {
        notes,
        signal_chains: signalChains,
      }

      const userPrompt = buildReflectionUserPrompt(
        currentProfile,
        modulesRes.data || [],
        racksRes.data || [],
        lessonsRes.data || [],
      )

      const content = await callAnthropic({
        systemPrompt: REFLECTION_SYSTEM_PROMPT,
        userPrompt,
        maxTokens: 3000,
        maxSearchUses: 5,
        onStatus: setStatusMsg,
      })

      // Strip cite tags
      const cleaned = content.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/\s{2,}/g, ' ').trim()

      // Save reflections to profile
      const { error: updateError } = await supabase
        .from('profile')
        .update({
          reflections: cleaned,
          reflections_updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (updateError) {
        console.error('Error saving reflections:', updateError)
      }

      setProfile((prev) => ({
        ...prev,
        reflections: cleaned,
        reflections_updated_at: new Date().toISOString(),
      }))
    } catch (err) {
      console.error('Reflection generation error:', err)
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }, [profile, notes, signalChains])

  if (loading) {
    return (
      <div className="profile">
        <div className="profile-loading">Loading...</div>
      </div>
    )
  }

  const reflectionsDate = profile?.reflections_updated_at
    ? new Date(profile.reflections_updated_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="profile">
      <div className="profile-columns">
        {/* Left: User's space */}
        <div className="profile-left">
          <div className="profile-section">
            <div className="profile-section-header">
              <span className="section-header">About You</span>
              {saving && <span className="profile-save-status">Saving...</span>}
              {saved && <span className="profile-save-status saved">Saved</span>}
            </div>
            <textarea
              className="profile-textarea"
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Your background, what you're working toward, what kind of music you make, what stage you're at with modular. This context helps SIGNAL give you better lessons."
              rows={8}
            />
          </div>

          <div className="profile-section">
            <span className="section-header">Signal Chains</span>
            <p className="profile-hint">
              Describe your default signal flow for each rack. How do things typically connect? What goes where?
            </p>
            <textarea
              className="profile-textarea"
              value={signalChains}
              onChange={(e) => handleChainsChange(e.target.value)}
              placeholder={"e.g.\nPerformance case: Oxi One → sequencing BIA + Manis via OXI Pipe. Voices → C4RBN filter → Bartender mixer → Optx ADAT out.\n\nStudio rack: Arbhar granular processing ← fed from Morphagene. Mimeophon as send effect from Bartender aux."}
              rows={10}
            />
          </div>
        </div>

        {/* Right: SIGNAL's reflections */}
        <div className="profile-right">
          <div className="profile-section">
            <div className="profile-section-header">
              <span className="section-header">SIGNAL's Reflections</span>
              <button
                className="profile-regen-btn"
                onClick={generateReflections}
                disabled={generating}
              >
                {generating ? statusMsg : (profile?.reflections ? 'Regenerate' : 'Generate')}
              </button>
            </div>

            {error && (
              <div className="profile-error">{error}</div>
            )}

            {profile?.reflections ? (
              <div className="profile-reflections">
                {reflectionsDate && (
                  <span className="profile-reflections-date">
                    Last updated {reflectionsDate}
                  </span>
                )}
                <div className="profile-reflections-content">
                  <Markdown content={profile.reflections} />
                </div>
              </div>
            ) : (
              <div className="profile-reflections-empty">
                {generating ? (
                  <span className="profile-generating">{statusMsg}</span>
                ) : (
                  <>
                    <p>No reflections yet.</p>
                    <p className="profile-reflections-empty-sub">
                      Add some notes about yourself and your signal chains, then hit Generate. SIGNAL will analyze your rig, your lesson history, and your interests to surface patterns and suggestions.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
