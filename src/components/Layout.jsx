import './Layout.css'

const NAV_ITEMS = [
  { key: 'library', label: 'Library', icon: '◧' },
  { key: 'session', label: 'New Session', icon: '▹' },
  { key: 'ask', label: 'Ask Signal', icon: '◇' },
  { key: 'saved', label: 'Saved', icon: '≡' },
  { key: 'profile', label: 'Profile', icon: '◉' },
]

export default function Layout({ currentView, onNavigate, children }) {
  return (
    <div className="layout">
      <header className="top-nav">
        <div className="top-nav-inner">
          <button className="logo" onClick={() => onNavigate('library')}>
            SIGNAL
          </button>
          <nav className="top-nav-links">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                className={`top-nav-link ${currentView === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main-content">
        {children}
      </main>

      <nav className="bottom-tabs">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            className={`bottom-tab ${currentView === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
          >
            <span className="bottom-tab-icon">{item.icon}</span>
            <span className="bottom-tab-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
