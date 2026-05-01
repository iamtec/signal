import './Markdown.css'

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function processInline(text) {
  let result = escapeHtml(text)
  // Bold: **text**
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  // Inline code: `text`
  result = result.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
  return result
}

function isBlockStart(line) {
  if (!line) return false
  if (line.match(/^#{1,3}\s/)) return true
  if (line.match(/^\d+\.\s/)) return true
  if (line.match(/^[-*]\s/)) return true
  if (line.trimStart().startsWith('```')) return true
  return false
}

function parseMarkdown(content) {
  if (!content) return ''

  // Ensure ## headings always start on their own line
  // Handles cases where newlines were stripped from stored content
  let normalized = content.replace(/([^\n])(\s*##\s)/g, '$1\n$2')

  const lines = normalized.split('\n')
  const html = []
  let inCodeBlock = false
  let codeLines = []
  let inList = null // 'ol' | 'ul' | null
  let listItems = []

  function flushList() {
    if (inList && listItems.length > 0) {
      const tag = inList
      html.push(`<${tag} class="md-list">`)
      listItems.forEach((item) => {
        html.push(`<li>${processInline(item)}</li>`)
      })
      html.push(`</${tag}>`)
      listItems = []
      inList = null
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Fenced code blocks
    if (line.trimStart().startsWith('```')) {
      if (inCodeBlock) {
        html.push(`<pre class="md-code-block"><code>${codeLines.join('\n')}</code></pre>`)
        codeLines = []
        inCodeBlock = false
      } else {
        flushList()
        inCodeBlock = true
      }
      i++
      continue
    }

    if (inCodeBlock) {
      codeLines.push(escapeHtml(line))
      i++
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      i++
      continue
    }

    // ## Heading 2
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      flushList()
      html.push(`<h2 class="md-h2">${processInline(h2Match[1])}</h2>`)
      i++
      continue
    }

    // ### Heading 3
    const h3Match = line.match(/^### (.+)/)
    if (h3Match) {
      flushList()
      html.push(`<h3 class="md-h3">${processInline(h3Match[1])}</h3>`)
      i++
      continue
    }

    // Numbered list: 1. item
    const olMatch = line.match(/^\d+\.\s+(.+)/)
    if (olMatch) {
      if (inList !== 'ol') {
        flushList()
        inList = 'ol'
      }
      listItems.push(olMatch[1])
      i++
      continue
    }

    // Bullet list: - item (but NOT **bold** which starts with *)
    // Only match * as bullet if it's followed by a space and not another *
    const ulMatch = line.match(/^[-]\s+(.+)/) || line.match(/^\*(?!\*)[ \t]+(.+)/)
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList()
        inList = 'ul'
      }
      listItems.push(ulMatch[1])
      i++
      continue
    }

    // Paragraph — collect consecutive non-block, non-empty lines
    flushList()
    const paraLines = [line]
    i++
    while (i < lines.length) {
      const next = lines[i]
      if (next.trim() === '' || isBlockStart(next)) break
      paraLines.push(next)
      i++
    }
    html.push(`<p class="md-p">${paraLines.map(processInline).join(' ')}</p>`)
  }

  // Flush remaining
  if (inCodeBlock && codeLines.length > 0) {
    html.push(`<pre class="md-code-block"><code>${codeLines.join('\n')}</code></pre>`)
  }
  flushList()

  return html.join('\n')
}

export default function Markdown({ content }) {
  const html = parseMarkdown(content)

  return (
    <div
      className="markdown-body"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
