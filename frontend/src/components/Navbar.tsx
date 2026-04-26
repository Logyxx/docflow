export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-forest-border bg-bg-primary/90 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a
            href="https://logyxx.github.io"
            className="text-ink-secondary hover:text-ink-primary transition-colors text-sm"
          >
            ← Logyxx
          </a>
          <span className="text-forest-border">|</span>
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="#3a7a32" strokeWidth="1.5" />
              <path d="M7 8h10M7 12h7M7 16h5" stroke="#3a7a32" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="font-semibold text-ink-primary tracking-tight">DocFlow</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-ink-secondary">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-forest-accent animate-pulse-slow" />
          <span>Document Intelligence</span>
        </div>
      </div>
    </nav>
  )
}
