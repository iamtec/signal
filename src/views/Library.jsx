import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { callAnthropic } from '../lib/anthropic'
import { DELTA_SYSTEM_PROMPT, buildDeltaUserPrompt, DELTA_ONLY_SYSTEM_PROMPT, buildDeltaOnlyUserPrompt } from '../prompts'
import ModuleCard from '../components/ModuleCard'
import ModuleModal from '../components/ModuleModal'
import RackModal from '../components/RackModal'
import BulkAddModal from '../components/BulkAddModal'
import ImportRackModal from '../components/ImportRackModal'
import BulkEditModal from '../components/BulkEditModal'
import './Library.css'

export default function Library() {
  const [modules, setModules] = useState([])
  const [racks, setRacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editModule, setEditModule] = useState(null)
  const [modalDefaults, setModalDefaults] = useState({})
  const [rackModalOpen, setRackModalOpen] = useState(false)
  const [editRack, setEditRack] = useState(null)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkDefaultRack, setBulkDefaultRack] = useState(null)
  const [extractingDelta, setExtractingDelta] = useState(new Set())
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [bulkEditModules, setBulkEditModules] = useState(null) // array of modules to edit, or null
  const [bulkEditRackName, setBulkEditRackName] = useState(null)
  const [dragOverRack, setDragOverRack] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  const fetchAll = useCallback(async () => {
    const [modulesRes, racksRes] = await Promise.all([
      supabase.from('modules').select('*').order('created_at', { ascending: true }),
      supabase.from('racks').select('*').order('created_at', { ascending: true }),
    ])

    if (modulesRes.error) console.error('Error fetching modules:', modulesRes.error)
    else setModules(modulesRes.data || [])

    if (racksRes.error) console.error('Error fetching racks:', racksRes.error)
    else setRacks(racksRes.data || [])

    setLoading(false)
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  // Split modules into controllers vs rack modules
  const { controllers, rackModules } = useMemo(() => {
    const controllers = modules.filter((m) => m.is_controller)
    const rackModules = modules.filter((m) => !m.is_controller)
    return { controllers, rackModules }
  }, [modules])

  // Group rack modules by rack
  const { rackGroups, unassigned } = useMemo(() => {
    const groups = racks.map((rack) => ({
      rack,
      modules: rackModules.filter((m) => m.rack_id === rack.id),
    }))
    const unassigned = rackModules.filter((m) => !m.rack_id)
    return { rackGroups: groups, unassigned }
  }, [rackModules, racks])

  const rackHpUsed = useCallback((mods) => {
    return mods.reduce((sum, m) => sum + (m.hp || 0), 0)
  }, [])

  // --- Delta extraction ---

  const extractDelta = useCallback(async (mod) => {
    setExtractingDelta((prev) => new Set([...prev, mod.id]))
    try {
      const response = await callAnthropic({
        systemPrompt: DELTA_SYSTEM_PROMPT,
        userPrompt: buildDeltaUserPrompt(mod.name, mod.manufacturer, mod.personal_notes),
        maxTokens: 2000,
        maxSearchUses: 5,
      })

      let delta = ''
      let manualDigest = ''
      let manualUrl = ''
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          delta = parsed.delta || ''
          manualDigest = parsed.manual_digest || ''
          manualUrl = parsed.manual_url || ''
        }
      } catch {
        delta = response.trim()
      }

      // Strip any <cite> tags
      const stripCites = (s) => s.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/\s{2,}/g, ' ').trim()
      delta = stripCites(delta)
      manualDigest = stripCites(manualDigest)

      await supabase
        .from('modules')
        .update({ delta, manual_digest: manualDigest, manual_url: manualUrl })
        .eq('id', mod.id)

      await fetchAll()
    } catch (err) {
      console.error('Delta extraction failed:', err)
    } finally {
      setExtractingDelta((prev) => {
        const next = new Set(prev)
        next.delete(mod.id)
        return next
      })
    }
  }, [fetchAll])

  // Delta-only regeneration (skips manual_digest if it already exists)
  const extractDeltaOnly = useCallback(async (mod) => {
    // If no manual_digest, fall back to full extraction
    if (!mod.manual_digest) {
      return extractDelta(mod)
    }

    setExtractingDelta((prev) => new Set([...prev, mod.id]))
    try {
      const response = await callAnthropic({
        systemPrompt: DELTA_ONLY_SYSTEM_PROMPT,
        userPrompt: buildDeltaOnlyUserPrompt(mod.name, mod.manufacturer, mod.personal_notes, mod.manual_digest),
        maxTokens: 800,
        maxSearchUses: 2,
      })

      let delta = ''
      let manualUrl = mod.manual_url || ''
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          delta = parsed.delta || ''
          if (parsed.manual_url) manualUrl = parsed.manual_url
        }
      } catch {
        delta = response.trim()
      }

      delta = delta.replace(/<cite[^>]*>|<\/cite>/g, '').replace(/\s{2,}/g, ' ').trim()

      await supabase
        .from('modules')
        .update({ delta, manual_url: manualUrl })
        .eq('id', mod.id)

      await fetchAll()
    } catch (err) {
      console.error('Delta-only extraction failed:', err)
    } finally {
      setExtractingDelta((prev) => {
        const next = new Set(prev)
        next.delete(mod.id)
        return next
      })
    }
  }, [fetchAll, extractDelta])

  // --- Module CRUD ---

  const handleSaveModule = useCallback(async (moduleData) => {
    if (moduleData.id) {
      const { error } = await supabase
        .from('modules')
        .update({
          name: moduleData.name,
          manufacturer: moduleData.manufacturer,
          category: moduleData.category,
          hp: moduleData.hp,
          personal_notes: moduleData.personal_notes,
          rack_id: moduleData.rack_id,
          is_controller: moduleData.is_controller,
        })
        .eq('id', moduleData.id)
      if (error) { console.error('Error updating module:', error); return }
    } else {
      const { data, error } = await supabase
        .from('modules')
        .insert({
          name: moduleData.name,
          manufacturer: moduleData.manufacturer,
          category: moduleData.category,
          hp: moduleData.hp,
          personal_notes: moduleData.personal_notes,
          rack_id: moduleData.rack_id,
          is_controller: moduleData.is_controller,
        })
        .select()
        .single()
      if (error) { console.error('Error inserting module:', error); return }
      if (data) extractDelta(data)
    }
    setModalOpen(false)
    setEditModule(null)
    setModalDefaults({})
    await fetchAll()
  }, [fetchAll, extractDelta])

  const handleDeleteModule = useCallback(async (moduleId) => {
    const { error } = await supabase.from('modules').delete().eq('id', moduleId)
    if (error) { console.error('Error deleting module:', error); return }
    setModalOpen(false)
    setEditModule(null)
    setModalDefaults({})
    await fetchAll()
  }, [fetchAll])

  // --- Bulk add ---

  const handleBulkSave = useCallback(async (parsedModules, rackId) => {
    const rows = parsedModules.map((m) => ({
      name: m.name,
      manufacturer: m.manufacturer,
      category: m.category,
      hp: m.hp,
      rack_id: rackId,
      is_controller: m.is_controller || false,
    }))

    const { data, error } = await supabase
      .from('modules')
      .insert(rows)
      .select()

    if (error) {
      console.error('Error bulk inserting modules:', error)
      return
    }

    setBulkModalOpen(false)
    setBulkDefaultRack(null)
    await fetchAll()

    if (data) {
      data.forEach((mod) => extractDelta(mod))
    }
  }, [fetchAll, extractDelta])

  // --- Import from ModularGrid ---

  const handleImport = useCallback(async ({ rackName, rackDesc, hpCapacity, modules: parsedModules }) => {
    // 1. Create the rack
    const { data: rack, error: rackError } = await supabase
      .from('racks')
      .insert({
        name: rackName,
        description: rackDesc,
        hp_capacity: hpCapacity,
      })
      .select()
      .single()

    if (rackError) {
      console.error('Error creating rack:', rackError)
      return
    }

    // 2. Insert all modules into this rack
    const rows = parsedModules.map((m) => ({
      name: m.name,
      manufacturer: m.manufacturer,
      category: m.category,
      hp: m.hp,
      rack_id: rack.id,
      is_controller: false,
    }))

    const { data, error } = await supabase
      .from('modules')
      .insert(rows)
      .select()

    if (error) {
      console.error('Error importing modules:', error)
      return
    }

    setImportModalOpen(false)
    await fetchAll()

    // Open bulk edit with the newly imported modules
    if (data && data.length > 0) {
      setBulkEditModules(data)
      setBulkEditRackName(rackName)
    }

    // Fire delta extraction for each (async, non-blocking)
    if (data) {
      data.forEach((mod) => extractDelta(mod))
    }
  }, [fetchAll, extractDelta])

  // --- Rack CRUD ---

  const handleSaveRack = useCallback(async (rackData) => {
    if (rackData.id) {
      const { error } = await supabase
        .from('racks')
        .update({
          name: rackData.name,
          description: rackData.description,
          hp_capacity: rackData.hp_capacity,
        })
        .eq('id', rackData.id)
      if (error) { console.error('Error updating rack:', error); return }
    } else {
      const { error } = await supabase.from('racks').insert({
        name: rackData.name,
        description: rackData.description,
        hp_capacity: rackData.hp_capacity,
      })
      if (error) { console.error('Error inserting rack:', error); return }
    }
    setRackModalOpen(false)
    setEditRack(null)
    await fetchAll()
  }, [fetchAll])

  const handleDeleteRack = useCallback(async (rackId) => {
    const { error } = await supabase.from('racks').delete().eq('id', rackId)
    if (error) { console.error('Error deleting rack:', error); return }
    setRackModalOpen(false)
    setEditRack(null)
    await fetchAll()
  }, [fetchAll])

  // --- Bulk edit ---

  const handleBulkEditSave = useCallback(async (updates, deleteIds) => {
    // Apply updates
    for (const update of updates) {
      const { error } = await supabase
        .from('modules')
        .update({
          personal_notes: update.personal_notes,
          category: update.category,
        })
        .eq('id', update.id)
      if (error) console.error('Error updating module:', error)
    }

    // Apply deletes
    if (deleteIds.length > 0) {
      const { error } = await supabase
        .from('modules')
        .delete()
        .in('id', deleteIds)
      if (error) console.error('Error deleting modules:', error)
    }

    setBulkEditModules(null)
    setBulkEditRackName(null)
    await fetchAll()
  }, [fetchAll])

  const handleOpenBulkEdit = useCallback((rackId, rackNameStr) => {
    const mods = rackId
      ? modules.filter((m) => m.rack_id === rackId && !m.is_controller)
      : modules.filter((m) => !m.rack_id && !m.is_controller)
    if (mods.length === 0) return
    setBulkEditModules(mods)
    setBulkEditRackName(rackNameStr || null)
  }, [modules])

  const handleRegenerateAllDeltas = useCallback(async (moduleList) => {
    // Save first, close modal, then fire extractions
    setBulkEditModules(null)
    setBulkEditRackName(null)

    // Re-fetch to get latest notes
    await fetchAll()

    // Get fresh module data
    const { data: freshModules } = await supabase
      .from('modules')
      .select('*')
      .in('id', moduleList.map((m) => m.id))

    if (freshModules) {
      freshModules.forEach((mod) => extractDeltaOnly(mod))
    }
  }, [fetchAll, extractDeltaOnly])

  // --- Drag and drop ---

  const handleDragOver = useCallback((e, rackId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverRack(rackId)
  }, [])

  const handleDragLeave = useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverRack(null)
    }
  }, [])

  const handleDrop = useCallback(async (e, targetRackId) => {
    e.preventDefault()
    setDragOverRack(null)
    setIsDragging(false)

    const moduleId = e.dataTransfer.getData('text/plain')
    if (!moduleId) return

    const mod = modules.find((m) => m.id === moduleId)
    if (!mod || mod.is_controller) return // controllers can't be dropped into racks

    const newRackId = targetRackId === 'unassigned' ? null : targetRackId
    if (mod.rack_id === newRackId) return

    setModules((prev) =>
      prev.map((m) => m.id === moduleId ? { ...m, rack_id: newRackId } : m)
    )

    const { error } = await supabase
      .from('modules')
      .update({ rack_id: newRackId })
      .eq('id', moduleId)

    if (error) {
      console.error('Error moving module:', error)
      await fetchAll()
    }
  }, [modules, fetchAll])

  // --- Handlers ---

  const handleCardClick = useCallback((mod) => {
    setEditModule(mod)
    setModalDefaults({})
    setModalOpen(true)
  }, [])

  const handleAddModule = useCallback((rackId) => {
    setEditModule(null)
    setModalDefaults({ rackId: rackId || null, isController: false })
    setModalOpen(true)
  }, [])

  const handleAddController = useCallback(() => {
    setEditModule(null)
    setModalDefaults({ rackId: null, isController: true })
    setModalOpen(true)
  }, [])

  const handleBulkAdd = useCallback((rackId) => {
    setBulkDefaultRack(rackId || null)
    setBulkModalOpen(true)
  }, [])

  const handleAddRack = useCallback(() => {
    setEditRack(null)
    setRackModalOpen(true)
  }, [])

  const handleEditRack = useCallback((rack) => {
    setEditRack(rack)
    setRackModalOpen(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    setModalOpen(false)
    setEditModule(null)
    setModalDefaults({})
  }, [])

  const handleRegenerateDelta = useCallback((mod) => {
    extractDelta(mod)
    setModalOpen(false)
    setEditModule(null)
    setModalDefaults({})
  }, [extractDelta])

  // --- Render helpers ---

  const renderModuleGrid = (mods, draggable = true) => (
    <div className="library-grid">
      {mods.map((mod) => (
        <div key={mod.id} className="library-card-wrap">
          <ModuleCard module={mod} onClick={handleCardClick} draggable={draggable} />
          {extractingDelta.has(mod.id) && (
            <div className="library-extracting">Extracting delta...</div>
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="library">
      <div className="library-header">
        <span className="section-header">Your Library</span>
        <div className="library-header-actions">
          <button className="library-action-btn library-import-btn" onClick={() => setImportModalOpen(true)}>
            Import Rack
          </button>
          <button className="library-action-btn" onClick={handleAddRack}>
            + Rack
          </button>
          <button className="library-action-btn" onClick={handleAddController}>
            + Controller
          </button>
          <button className="library-action-btn" onClick={() => handleBulkAdd(null)}>
            + Bulk Add
          </button>
          <button className="library-add-btn" onClick={() => handleAddModule(null)}>
            + Module
          </button>
        </div>
      </div>

      {loading ? (
        <div className="library-empty">Loading...</div>
      ) : modules.length === 0 && racks.length === 0 ? (
        <div className="library-empty">
          <p>No modules yet.</p>
          <p className="library-empty-sub">
            Create a rack, add modules, or add external controllers.
          </p>
        </div>
      ) : (
        <div className="library-sections">
          {/* Controllers section */}
          {controllers.length > 0 && (
            <div className="library-controllers-section">
              <div className="library-rack-header">
                <div className="library-rack-info">
                  <span className="library-section-label">Controllers &amp; External Gear</span>
                </div>
                <div className="library-rack-actions">
                  <button
                    className="library-rack-action"
                    onClick={handleAddController}
                  >
                    + Controller
                  </button>
                </div>
              </div>
              {renderModuleGrid(controllers, false)}
            </div>
          )}

          {/* Racks */}
          <div
            className="library-racks"
            onDragStart={() => setIsDragging(true)}
            onDragEnd={() => { setIsDragging(false); setDragOverRack(null) }}
          >
            {rackGroups.map(({ rack, modules: rackMods }) => {
              const used = rackHpUsed(rackMods)
              const isDropTarget = dragOverRack === rack.id
              return (
                <div
                  key={rack.id}
                  className={`library-rack-section ${isDropTarget ? 'drop-target' : ''}`}
                  onDragOver={(e) => handleDragOver(e, rack.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, rack.id)}
                >
                  <div className="library-rack-header">
                    <div className="library-rack-info">
                      <button
                        className="library-rack-name"
                        onClick={() => handleEditRack(rack)}
                        title="Edit rack"
                      >
                        {rack.name}
                      </button>
                      {rack.hp_capacity && (
                        <span className="library-rack-hp">
                          {used}/{rack.hp_capacity}hp
                        </span>
                      )}
                      {rack.description && (
                        <span className="library-rack-desc">{rack.description}</span>
                      )}
                    </div>
                    <div className="library-rack-actions">
                      {rackMods.length > 0 && (
                        <button
                          className="library-rack-action"
                          onClick={() => handleOpenBulkEdit(rack.id, rack.name)}
                        >
                          Edit All
                        </button>
                      )}
                      <button
                        className="library-rack-action"
                        onClick={() => handleBulkAdd(rack.id)}
                      >
                        Bulk Add
                      </button>
                      <button
                        className="library-rack-action"
                        onClick={() => handleAddModule(rack.id)}
                      >
                        + Module
                      </button>
                    </div>
                  </div>

                  {rack.hp_capacity && (
                    <div className="library-rack-hp-bar">
                      <div
                        className="library-rack-hp-fill"
                        style={{ width: `${Math.min(100, (used / rack.hp_capacity) * 100)}%` }}
                      />
                    </div>
                  )}

                  {rackMods.length > 0 ? (
                    renderModuleGrid(rackMods)
                  ) : (
                    <div className={`library-rack-empty ${isDropTarget ? 'library-drop-hint' : ''}`}>
                      {isDropTarget ? 'Drop here' : 'No modules in this rack yet. Drag modules here or use the buttons above.'}
                    </div>
                  )}
                </div>
              )
            })}

            {(unassigned.length > 0 || isDragging) && (
              <div
                className={`library-rack-section ${dragOverRack === 'unassigned' ? 'drop-target' : ''}`}
                onDragOver={(e) => handleDragOver(e, 'unassigned')}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'unassigned')}
              >
                <div className="library-rack-header">
                  <div className="library-rack-info">
                    <span className="library-rack-name unassigned-label">Unassigned</span>
                  </div>
                </div>
                {unassigned.length > 0 ? (
                  renderModuleGrid(unassigned)
                ) : (
                  <div className="library-rack-empty library-drop-hint">Drop here to unassign</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <ModuleModal
          module={editModule}
          defaultRackId={modalDefaults.rackId || editModule?.rack_id || null}
          defaultIsController={modalDefaults.isController || false}
          racks={racks}
          onSave={handleSaveModule}
          onClose={handleCloseModal}
          onDelete={handleDeleteModule}
          onRegenerateDelta={handleRegenerateDelta}
        />
      )}

      {rackModalOpen && (
        <RackModal
          rack={editRack}
          onSave={handleSaveRack}
          onClose={() => { setRackModalOpen(false); setEditRack(null) }}
          onDelete={handleDeleteRack}
        />
      )}

      {bulkModalOpen && (
        <BulkAddModal
          racks={racks}
          defaultRackId={bulkDefaultRack}
          onSave={handleBulkSave}
          onClose={() => { setBulkModalOpen(false); setBulkDefaultRack(null) }}
        />
      )}

      {importModalOpen && (
        <ImportRackModal
          onImport={handleImport}
          onClose={() => setImportModalOpen(false)}
        />
      )}

      {bulkEditModules && (
        <BulkEditModal
          modules={bulkEditModules}
          rackName={bulkEditRackName}
          onSave={handleBulkEditSave}
          onRegenerateAll={handleRegenerateAllDeltas}
          onClose={() => { setBulkEditModules(null); setBulkEditRackName(null) }}
        />
      )}
    </div>
  )
}
