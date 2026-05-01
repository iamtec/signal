const API_URL = 'https://api.anthropic.com/v1/messages'
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

/**
 * Call Anthropic API with agentic web_search loop.
 * Keeps calling until stop_reason is "end_turn".
 *
 * @param {Object} opts
 * @param {string} opts.systemPrompt
 * @param {string} opts.userPrompt
 * @param {number} [opts.maxTokens=3000]
 * @param {number} [opts.maxSearchUses=5]
 * @param {function} [opts.onStatus] - callback for status updates
 * @returns {Promise<string>} - concatenated text response
 */
export async function callAnthropic({
  systemPrompt,
  userPrompt,
  maxTokens = 3000,
  maxSearchUses = 5,
  onStatus,
}) {
  if (!API_KEY) {
    throw new Error('VITE_ANTHROPIC_API_KEY not configured')
  }

  const messages = [
    { role: 'user', content: userPrompt },
  ]

  const tools = [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: maxSearchUses,
    },
  ]

  let iterations = 0
  const MAX_ITERATIONS = 15

  while (iterations < MAX_ITERATIONS) {
    iterations++

    if (onStatus) {
      if (iterations === 1) {
        onStatus('Searching the web...')
      } else {
        onStatus('Thinking...')
      }
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemPrompt,
        messages,
        tools,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${err}`)
    }

    const data = await response.json()

    if (data.stop_reason === 'end_turn' || data.stop_reason === 'max_tokens') {
      // Extract all text blocks
      const textBlocks = (data.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
      return textBlocks.join('\n\n')
    }

    if (data.stop_reason === 'tool_use') {
      // Push assistant message
      messages.push({ role: 'assistant', content: data.content })

      // Build tool_result blocks for each tool_use in the response
      const toolResults = data.content
        .filter((b) => b.type === 'tool_use')
        .map((toolUse) => ({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: 'Search completed.',
        }))

      messages.push({ role: 'user', content: toolResults })

      if (onStatus) {
        onStatus('Reading the room...')
      }

      continue
    }

    // Unknown stop reason — extract what we can
    const fallbackText = (data.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
    if (fallbackText.length > 0) {
      return fallbackText.join('\n\n')
    }

    throw new Error(`Unexpected stop_reason: ${data.stop_reason}`)
  }

  throw new Error('Max iterations reached in agentic loop')
}
