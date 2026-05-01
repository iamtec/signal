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

function parseMarkdown(content) {
  if (!content) return ''

  const lines = content.split('\n')
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

  for (let i = 0; i < lines.length; i++) {
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
      continue
    }

    if (inCodeBlock) {
      codeLines.push(escapeHtml(line))
      continue
    }

    // Empty line
    if (line.trim() === '') {
      flushList()
      continue
    }

    // ## Heading 2
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      flushList()
      html.push(`<h2 class="md-h2">${escapeHtml(h2Match[1])}</h2>`)
      continue
    }

    // ### Heading 3
    const h3Match = line.match(/^### (.+)/)
    if (h3Match) {
      flushList()
      html.push(`<h3 class="md-h3">${escapeHtml(h3Match[1])}</h3>`)
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
      continue
    }

    // Bullet list: - item or * item
    const ulMatch = line.match(/^[-*]\s+(.+)/)
    if (ulMatch) {
      if (inList !== 'ul') {
        flushList()
        inList = 'ul'
      }
      listItems.push(ulMatch[1])
      continue
    }

    // Paragraph
    flushList()
    html.push(`<p class="md-p">${processInline(line)}</p>`)
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
