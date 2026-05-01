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
{"manual_digest": "INPUTS: ...\nOUTPUTS: ...\nMODES: ...\nKEY PARAMETERS: ...\nLIMITATIONS: ...\nFORM FACTOR: ...", "delta": "...", "manual_url": "..."}`

export function buildDeltaUserPrompt(name, manufacturer, personalNotes) {
  return `Module: ${name} by ${manufacturer}

User's notes about this module:
${personalNotes || '(no notes provided)'}

Search for this module's official manual and documentation. Read it thoroughly, then produce the technical digest and delta.`
}

// --- Lesson generation ---

export function buildLessonUserPrompt(selectedModules, allModules, styleRef, goal, mode) {
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

  return `MODULES IN THIS SESSION:
${selectedSection}

IMPORTANT: The TECHNICAL REFERENCE sections above are extracted from official manuals. They are the ground truth for what each module can and cannot do. Every patch connection you suggest must use real, documented I/O points listed in the technical reference. Do not invent capabilities, outputs, or modes that are not listed.

${otherModules ? `OTHER MODULES IN MY RIG (reference only for suggestions, don't assume familiarity):
${otherModules}

` : ''}STYLE REFERENCE: ${styleRef || '(none given)'}

GOAL: ${goal}

MODE: ${mode}

Please search for any interviews, process discussions, or documented techniques from ${styleRef || 'the referenced artist'} relevant to this goal before generating the lesson.`
}
