import './ModuleCard.css'

export default function ModuleCard({ module, onClick, selected, selectable, draggable: isDraggable }) {
  const firstLine = module.personal_notes
    ? module.personal_notes.split('\n')[0].slice(0, 80)
    : null

  const handleDragStart = (e) => {
    if (!isDraggable) return
    e.dataTransfer.setData('text/plain', module.id)
    e.dataTransfer.effectAllowed = 'move'
    // Add a class to the dragged element after a tick (so the ghost image captures the original)
    requestAnimationFrame(() => {
      e.target.classList.add('dragging')
    })
  }

  const handleDragEnd = (e) => {
    e.target.classList.remove('dragging')
  }

  return (
    <button
      className={`module-card ${selected ? 'selected' : ''} ${selectable ? 'selectable' : ''} ${isDraggable ? 'is-draggable' : ''} ${module.is_controller ? 'is-controller' : ''}`}
      onClick={() => onClick?.(module)}
      draggable={isDraggable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {selectable && selected && (
        <span className="module-card-check">&#10003;</span>
      )}
      {isDraggable && (
        <span className="module-card-grip" title="Drag to move">&#8942;&#8942;</span>
      )}
      <div className="module-card-header">
        <span className="module-card-name">{module.name}</span>
        {module.is_controller && <span className="module-card-ext-tag">ext</span>}
        {!module.is_controller && module.hp && <span className="module-card-hp">{module.hp}hp</span>}
      </div>
      <span className="module-card-mfr">{module.manufacturer}</span>
      {module.category && (
        <span className="pill module-card-cat">{module.category}</span>
      )}
      {firstLine && (
        <p className="module-card-notes">{firstLine}</p>
      )}
      {module.delta && (
        <span className="module-card-delta-indicator" title="Delta available">&#9679;</span>
      )}
    </button>
  )
}
