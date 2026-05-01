// --- System prompts ---

export const LEARN_SYSTEM_PROMPT = `You are an expert Eurorack modular synthesizer instructor. You create focused, practical lessons grounded in real synthesis technique and the specific working methods of referenced artists. Your lessons are immediately actionable — specific module parameters named, specific patch connections described, specific exercises given. You do not waffle or pad.

CRITICAL: You must ONLY suggest patch connections, parameters, modes, and capabilities that are explicitly documented in the module's technical reference provided below. Never invent outputs, inputs, modes, or features. If a module's technical reference says it has "main out" and "headphone out", those are the ONLY outputs — do not fabricate a "send out" or any other connection point. If a module is rack-mounted Eurorack, do not suggest using it as a portable/mobile device. Respect sample time limits, I/O constraints, and operational modes exactly as documented.

Format your response in clean markdown with these exact sections: ## ARTIST CONTEXT, ## CORE TECHNIQUE, ## PATCH RECIPE, ## EXERCISES (numbered 1–4), ## GOING DEEPER, ## ALSO CONSIDER (1–2 other modules from the user's rig that would enhance this, with a one-line reason each)`

export const SET_SYSTEM_PROMPT = `You are an expert in modular synthesizer performance and set design. You understand set arc, tension and release, the challenge of balancing prepared clips with live improvisation, and the specific demands of dark electronic and experimental music.

CRITICAL: You must ONLY suggest patch connections, parameters, modes, and capabilities that are explicitly documented in the module's technical reference provided below. Never invent outputs, inputs, modes, or features. If a module's technical reference lists specific outputs, those are the ONLY outputs available. If a module has sample time limits, respect them exactly. Do not suggest workflows that are physically impossible with the documented hardware. Every signal flow you describe must use real, documented I/O points.

Format your response in clean markdown with these exact sections: ## SET ARCHITECTURE, ## CLIP STRATEGY, ## LIVE IMPROV ZONES, ## TRANSITIONS, ## PRACTICE REGIMEN`

// --- Delta + Manual digest extraction ---

export const DELTA_SYSTEM_PROMPT = `You are a Eurorack module researcher. Search for the official manual and documentation for the given module. Read it carefully.

You must return a JSON block with exactly three keys:

1. "manual_digest" — A structured technical reference extracted from the manual. This is the most important part. Be thorough and precise. Include:
   - INPUTS: Every input jack, with its exact name and what it accepts (audio, CV, gate, trigger, clock). Use the exact names printed on the panel/manual.
   - OUTPUTS: Every output jack, with its exact name and what it produces. Do NOT invent outputs that don't exist.
   - MODES: Every operational mode, with its exact name and a one-line description of what it does.
   - KEY PARAMETERS: Important knobs/controls and what they do.
   - LIMITATIONS: Sample time limits, polyphony limits, voltage ranges, anything that constrains what the module can do.
   - FORM FACTOR: Whether this is Eurorack (rack-mounted, requires power from case) or standalone/desktop.
   Keep this under 400 words but be precise. Use the exact terminology from the manual.

2. "delta" — A concise list of things the user didn't mention in their notes: hidden modes, lesser-known features, creative use cases. Under 150 words.

3. "manual_url" — The primary source URL you used.

Return ONLY the JSON block, no other text. Do NOT include any <cite> tags or source annotations.

Example format:
{"manual_digest": "INPUTS: ...\\nOUTPUTS: ...\\nMODES: ...\\nKEY PARAMETERS: ...\\nLIMITATIONS: ...\\nFORM FACTOR: ...", "delta": "...", "manual_url": "..."}`

export function buildDeltaUserPrompt(name, manufacturer, personalNotes) {
  return `Module: ${name} by ${manufacturer}

User's notes about this module:
${personalNotes || '(no notes provided)'}

Search for this module's official manual and documentation. Read it thoroughly, then produce the technical digest and delta.`
}

// --- Reflection generation ---

export const REFLECTION_SYSTEM_PROMPT = `You are SIGNAL, an analytical tool for a modular synthesizer musician. You observe patterns across their entire setup, their lesson history, and their stated interests to produce genuinely useful reflections.

You are not a cheerleader. You are a thoughtful observer who notices things the user might not see about their own practice. Be specific, reference their actual modules and actual lesson history, and make concrete suggestions.

Do NOT include any <cite> tags, source annotations, or reference markers. Write plain text only.

Format your response in clean markdown with these exact sections:

## ARTIST MAP
Artists they've referenced, and connections between them. Note common threads in their taste — what do these artists share technically? What approach binds them?

## TECHNIQUE PATTERNS
Based on their lesson goals and the kinds of things they ask about, what techniques are they drawn to? What keeps coming up?

## SIGNAL CHAIN OBSERVATIONS
Looking at their racks, signal chains, and module choices — what kind of system are they building? What does the topology suggest about how they think about sound?

## GAPS TO EXPLORE
Things they haven't asked about yet that their setup is capable of. Specific modules they own that they might be underusing. Techniques that would bridge what they already know with what they seem to want.

## ADJACENT TERRITORY
Artists, techniques, or approaches they haven't mentioned but that connect to what they're doing. Be specific — not just "you might like ambient music" but "Caterina Barbieri's use of sequencer-driven additive patterns connects to your interest in generative approaches with the Maestro."

## PRACTICE FOCUS
Based on everything, what should their next 3 sessions focus on? Be specific about which modules and what goals.`

export function buildReflectionUserPrompt(profile, modules, racks, lessons) {
  const sections = []

  // User's own notes
  if (profile.notes) {
    sections.push(`USER'S NOTES ABOUT THEMSELVES:\n${profile.notes}`)
  }

  // Signal chains
  if (profile.signal_chains) {
    sections.push(`DEFAULT SIGNAL CHAINS:\n${profile.signal_chains}`)
  }

  // Racks and modules
  if (racks.length > 0 || modules.length > 0) {
    const rackSection = racks.map((rack) => {
      const rackMods = modules.filter((m) => m.rack_id === rack.id && !m.is_controller)
      const modLines = rackMods.map((m) => {
        const parts = [`  - ${m.name} (${m.manufacturer})`]
        if (m.category) parts[0] += ` [${m.category}]`
        if (m.personal_notes) parts.push(`    Notes: ${m.personal_notes}`)
        return parts.join('\n')
      }).join('\n')
      return `${rack.name}${rack.description ? ` — ${rack.description}` : ''}${rack.hp_capacity ? ` (${rack.hp_capacity}hp)` : ''}:\n${modLines || '  (empty)'}`
    }).join('\n\n')

    const controllers = modules.filter((m) => m.is_controller)
    const controllerLines = controllers.map((m) => {
      const parts = [`  - ${m.name} (${m.manufacturer})`]
      if (m.personal_notes) parts.push(`    Notes: ${m.personal_notes}`)
      return parts.join('\n')
    }).join('\n')

    const unassigned = modules.filter((m) => !m.rack_id && !m.is_controller)
    const unassignedLines = unassigned.map((m) => `  - ${m.name} (${m.manufacturer})`).join('\n')

    let fullSection = 'THE RIG:\n\n'
    if (controllerLines) fullSection += `Controllers & External Gear:\n${controllerLines}\n\n`
    if (rackSection) fullSection += rackSection
    if (unassignedLines) fullSection += `\n\nUnassigned:\n${unassignedLines}`

    sections.push(fullSection)
  }

  // Lesson history
  if (lessons.length > 0) {
    const lessonSummaries = lessons.slice(0, 30).map((l) => {
      const parts = [`- [${l.mode.toUpperCase()}] ${l.title || l.goal || 'Untitled'}`]
      if (l.style_ref) parts[0] += ` (ref: ${l.style_ref})`
      if (l.goal && l.goal !== l.title) parts.push(`  Goal: ${l.goal}`)
      return parts.join('\n')
    }).join('\n')

    sections.push(`LESSON HISTORY (${lessons.length} total, showing most recent):\n${lessonSummaries}`)
  }

  return sections.join('\n\n---\n\n') + '\n\nAnalyze this musician and their practice. Be specific and reference their actual modules, artists, and goals.'
}

// --- Lesson generation ---

export function buildLessonUserPrompt(selectedModules, allModules, styleRef, goal, mode, profile) {
  const selectedSection = selectedModules.map((m) => {
    const lines = [`### ${m.name} — ${m.manufacturer}`]

    // Technical reference is the ground truth — goes first
    if (m.manual_digest) {
      lines.push(`TECHNICAL REFERENCE (from manual — treat as ground truth, do not contradict):`)
      lines.push(m.manual_digest)
    }

    if (m.personal_notes) {
      lines.push(`User's relationship with it: ${m.personal_notes}`)
    }
    if (m.delta) {
      lines.push(`Things to explore: ${m.delta}`)
    }
    return lines.join('\n')
  }).join('\n\n')

  const selectedIds = new Set(selectedModules.map((m) => m.id))
  const otherModules = allModules
    .filter((m) => !selectedIds.has(m.id))
    .map((m) => `${m.name} (${m.category || 'uncategorized'})`)
    .join(', ')

  // Build profile context if available
  let profileContext = ''
  if (profile) {
    const parts = []
    if (profile.notes) parts.push(`About the user: ${profile.notes}`)
    if (profile.signal_chains) parts.push(`Default signal chains: ${profile.signal_chains}`)
    if (profile.reflections) parts.push(`Previous analysis of their practice: ${profile.reflections}`)
    if (parts.length > 0) {
      profileContext = `USER CONTEXT:\n${parts.join('\n')}\n\n`
    }
  }

  return `${profileContext}MODULES IN THIS SESSION:
${selectedSection}

IMPORTANT: The TECHNICAL REFERENCE sections above are extracted from official manuals. They are the ground truth for what each module can and cannot do. Every patch connection you suggest must use real, documented I/O points listed in the technical reference. Do not invent capabilities, outputs, or modes that are not listed.

${otherModules ? `OTHER MODULES IN MY RIG (reference only for suggestions, don't assume familiarity):
${otherModules}

` : ''}STYLE REFERENCE: ${styleRef || '(none given)'}

GOAL: ${goal}

MODE: ${mode}

Please search for any interviews, process discussions, or documented techniques from ${styleRef || 'the referenced artist'} relevant to this goal before generating the lesson.`
}
