// --- System prompts ---

export const LEARN_SYSTEM_PROMPT = `You are an expert Eurorack modular synthesizer instructor. You create focused, practical lessons grounded in real synthesis technique and the specific working methods of referenced artists. Your lessons are immediately actionable — specific module parameters named, specific patch connections described, specific exercises given. You do not waffle or pad. Format your response in clean markdown with these exact sections: ## ARTIST CONTEXT, ## CORE TECHNIQUE, ## PATCH RECIPE, ## EXERCISES (numbered 1–4), ## GOING DEEPER, ## ALSO CONSIDER (1–2 other modules from the user's rig that would enhance this, with a one-line reason each)`

export const SET_SYSTEM_PROMPT = `You are an expert in modular synthesizer performance and set design. You understand set arc, tension and release, the challenge of balancing prepared clips with live improvisation, and the specific demands of dark electronic and experimental music. Format your response in clean markdown with these exact sections: ## SET ARCHITECTURE, ## CLIP STRATEGY, ## LIVE IMPROV ZONES, ## TRANSITIONS, ## PRACTICE REGIMEN`

// --- Delta extraction ---

export const DELTA_SYSTEM_PROMPT = `You are a Eurorack module researcher. Search for the manual and documentation for the given module. Compare what you find against the user's notes. Return a JSON block with exactly two keys: "delta" (a concise list of things the user didn't mention — hidden modes, CV routing options, lesser-known features, creative use cases — under 150 words) and "manual_url" (the primary source URL you used). Return ONLY the JSON block, no other text. Do NOT include any <cite> tags, source annotations, or reference markers in the delta text — write plain readable sentences only. Example format:
{"delta": "...", "manual_url": "..."}`

export function buildDeltaUserPrompt(name, manufacturer, personalNotes) {
  return `Module: ${name} by ${manufacturer}

User's notes about this module:
${personalNotes || '(no notes provided)'}

Search for this module's manual and documentation, then identify things the user hasn't mentioned.`
}

// --- Lesson generation ---

export function buildLessonUserPrompt(selectedModules, allModules, styleRef, goal, mode) {
  const selectedSection = selectedModules.map((m) => {
    const lines = [`${m.name} — ${m.manufacturer}`]
    if (m.personal_notes) {
      lines.push(`My relationship with it: ${m.personal_notes}`)
    }
    if (m.delta) {
      lines.push(`Things I might not be thinking about: ${m.delta}`)
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

${otherModules ? `OTHER MODULES IN MY RIG (reference only for suggestions, don't assume familiarity):
${otherModules}

` : ''}STYLE REFERENCE: ${styleRef || '(none given)'}

GOAL: ${goal}

MODE: ${mode}

Please search for any interviews, process discussions, or documented techniques from ${styleRef || 'the referenced artist'} relevant to this goal before generating the lesson.`
}
