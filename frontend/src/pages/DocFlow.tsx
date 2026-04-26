import { useState, useRef, useCallback } from 'react'

const BACKEND = import.meta.env.VITE_BACKEND_URL || ''

type Tab = 'upload' | 'library' | 'query'

interface Document {
  id: number
  filename: string
  doc_type: string
  confidence: number
  summary: string
  uploaded_at: string
  size_bytes: number
}

interface UploadResult {
  id: number
  filename: string
  doc_type: string
  confidence: number
  summary: string
}

const DOC_TYPE_COLORS: Record<string, string> = {
  contract: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  report: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  invoice: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  policy: 'text-forest-accent bg-forest-accent/10 border-forest-accent/20',
  unknown: 'text-ink-secondary bg-ink-secondary/10 border-ink-secondary/20',
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function DocFlow() {
  const [tab, setTab] = useState<Tab>('upload')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null)
  const [uploadError, setUploadError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [documents, setDocuments] = useState<Document[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [filterType, setFilterType] = useState('all')
  const [deleting, setDeleting] = useState<number | null>(null)

  const [question, setQuestion] = useState('')
  const [queryFilter, setQueryFilter] = useState('all')
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryAnswer, setQueryAnswer] = useState('')
  const [querySources, setQuerySources] = useState<string[]>([])
  const [queryError, setQueryError] = useState('')
  const [queryDocs, setQueryDocs] = useState<Document[]>([])
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [])

  async function uploadFile(file: File) {
    setUploading(true)
    setUploadResult(null)
    setUploadError('')
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch(`${BACKEND}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`)
      const data = await res.json()
      setUploadResult(data)
    } catch (err: any) {
      setUploadError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function loadLibrary() {
    setLibLoading(true)
    try {
      const url = filterType !== 'all' ? `${BACKEND}/documents?type=${filterType}` : `${BACKEND}/documents`
      const res = await fetch(url)
      const data = await res.json()
      setDocuments(data)
    } catch {
      setDocuments([])
    } finally {
      setLibLoading(false)
    }
  }

  async function deleteDoc(id: number) {
    setDeleting(id)
    try {
      await fetch(`${BACKEND}/documents/${id}`, { method: 'DELETE' })
      setDocuments(prev => prev.filter(d => d.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  async function loadQueryDocs() {
    try {
      const res = await fetch(`${BACKEND}/documents`)
      const data = await res.json()
      setQueryDocs(data)
    } catch {
      setQueryDocs([])
    }
  }

  function toggleDoc(id: string) {
    setSelectedDocIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function runQuery() {
    if (!question.trim()) return
    setQueryLoading(true)
    setQueryAnswer('')
    setQuerySources([])
    setQueryError('')
    const docIds = selectedDocIds.size > 0 ? Array.from(selectedDocIds) : null
    try {
      const res = await fetch(`${BACKEND}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          filter_type: queryFilter !== 'all' && !docIds ? queryFilter : null,
          doc_ids: docIds,
        }),
      })
      if (!res.ok) throw new Error(`Query failed: ${res.statusText}`)
      const data = await res.json()
      setQueryAnswer(data.answer)
      setQuerySources(data.sources || [])
    } catch (err: any) {
      setQueryError(err.message || 'Query failed')
    } finally {
      setQueryLoading(false)
    }
  }

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'upload', label: 'Upload', icon: '↑' },
    { key: 'library', label: 'Library', icon: '⊞' },
    { key: 'query', label: 'Query', icon: '?' },
  ]

  return (
    <main className="pt-14 min-h-screen">
      {/* Tab bar */}
      <div className="border-b border-forest-border bg-bg-secondary sticky top-14 z-40">
        <div className="max-w-4xl mx-auto px-6 flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => {
                setTab(t.key)
                if (t.key === 'library') loadLibrary()
                if (t.key === 'query') loadQueryDocs()
              }}
              className={`px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-forest-accent text-ink-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <span className="mr-1.5 opacity-70">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* UPLOAD TAB */}
        {tab === 'upload' && (
          <div className="space-y-8">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Upload Document</h1>
              <p className="text-ink-secondary text-sm mt-1">PDF or plain-text files — classified automatically by AI</p>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                dragging
                  ? 'border-forest-accent bg-forest-accent/5'
                  : 'border-forest-border hover:border-forest-border-light hover:bg-bg-hover'
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = '' }}
              />
              {uploading ? (
                <div className="space-y-3">
                  <div className="w-8 h-8 border-2 border-forest-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-ink-secondary text-sm">Classifying document…</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <svg className="mx-auto" width="40" height="40" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3v13M7 8l5-5 5 5" stroke="#3a7a32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 17v2a2 2 0 002 2h14a2 2 0 002-2v-2" stroke="#4a6847" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <p className="text-ink-primary font-medium">Drop a file here or click to browse</p>
                  <p className="text-ink-secondary text-xs">Supports PDF and TXT</p>
                </div>
              )}
            </div>

            {uploadError && (
              <div className="rounded-lg border border-red-800/40 bg-red-900/10 p-4 text-red-400 text-sm">{uploadError}</div>
            )}

            {uploadResult && (
              <div className="rounded-xl border border-forest-border bg-bg-card p-6 space-y-4 animate-fade-up">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-ink-secondary uppercase tracking-widest mb-1">Uploaded</p>
                    <p className="font-semibold text-ink-primary">{uploadResult.filename}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${DOC_TYPE_COLORS[uploadResult.doc_type] || DOC_TYPE_COLORS.unknown}`}>
                    {uploadResult.doc_type}
                  </span>
                </div>

                {/* Confidence bar */}
                <div>
                  <div className="flex justify-between text-xs text-ink-secondary mb-1.5">
                    <span>Classification confidence</span>
                    <span>{Math.round(uploadResult.confidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-forest-accent transition-all duration-700"
                      style={{ width: `${uploadResult.confidence * 100}%` }}
                    />
                  </div>
                </div>

                {uploadResult.summary && (
                  <div className="pt-2 border-t border-forest-border">
                    <p className="text-xs text-ink-secondary uppercase tracking-widest mb-2">Summary</p>
                    <p className="text-ink-primary text-sm leading-relaxed">{uploadResult.summary}</p>
                  </div>
                )}

                <button
                  onClick={() => { setUploadResult(null); setTab('library'); loadLibrary() }}
                  className="text-xs text-forest-accent hover:text-forest-accent-hover transition-colors"
                >
                  View in Library →
                </button>
              </div>
            )}
          </div>
        )}

        {/* LIBRARY TAB */}
        {tab === 'library' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-ink-primary">Document Library</h1>
                <p className="text-ink-secondary text-sm mt-1">{documents.length} document{documents.length !== 1 ? 's' : ''} indexed</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={filterType}
                  onChange={e => { setFilterType(e.target.value); }}
                  className="bg-bg-card border border-forest-border text-ink-primary text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-forest-accent"
                >
                  <option value="all">All types</option>
                  <option value="contract">Contract</option>
                  <option value="report">Report</option>
                  <option value="invoice">Invoice</option>
                  <option value="policy">Policy</option>
                </select>
                <button
                  onClick={loadLibrary}
                  className="px-4 py-2 text-sm bg-bg-card border border-forest-border text-ink-secondary hover:text-ink-primary hover:border-forest-border-light rounded-lg transition-colors"
                >
                  Refresh
                </button>
              </div>
            </div>

            {libLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-7 h-7 border-2 border-forest-accent border-t-transparent rounded-full animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-20 text-ink-secondary">
                <svg className="mx-auto mb-4 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm">No documents yet — upload one to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className="flex items-center gap-4 rounded-xl border border-forest-border bg-bg-card p-4 hover:border-forest-border-light transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-ink-primary truncate">{doc.filename}</p>
                        <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.unknown}`}>
                          {doc.doc_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-ink-muted">
                        <span>{formatDate(doc.uploaded_at)}</span>
                        <span>·</span>
                        <span>{formatBytes(doc.size_bytes)}</span>
                        <span>·</span>
                        <span>{Math.round(doc.confidence * 100)}% confident</span>
                      </div>
                      {doc.summary && (
                        <p className="text-xs text-ink-secondary mt-1.5 line-clamp-2">{doc.summary}</p>
                      )}
                    </div>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      disabled={deleting === doc.id}
                      className="flex-shrink-0 text-ink-muted hover:text-red-400 transition-colors p-1.5 rounded"
                      title="Delete"
                    >
                      {deleting === doc.id ? (
                        <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* QUERY TAB */}
        {tab === 'query' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-ink-primary">Query Your Corpus</h1>
              <p className="text-ink-secondary text-sm mt-1">Ask anything across your indexed documents in plain English</p>
            </div>

            {/* Document picker */}
            {queryDocs.length > 0 && (
              <div className="rounded-xl border border-forest-border bg-bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-ink-secondary uppercase tracking-widest">
                    {selectedDocIds.size === 0
                      ? 'Querying all documents'
                      : `Querying ${selectedDocIds.size} selected document${selectedDocIds.size > 1 ? 's' : ''}`}
                  </p>
                  {selectedDocIds.size > 0 && (
                    <button
                      onClick={() => setSelectedDocIds(new Set())}
                      className="text-xs text-ink-muted hover:text-ink-secondary transition-colors"
                    >
                      Clear selection
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                  {queryDocs.map(doc => {
                    const selected = selectedDocIds.has(String(doc.id))
                    return (
                      <button
                        key={doc.id}
                        onClick={() => toggleDoc(String(doc.id))}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          selected
                            ? 'bg-forest-accent/10 border border-forest-accent/40'
                            : 'hover:bg-bg-hover border border-transparent'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${
                          selected ? 'bg-forest-accent border-forest-accent' : 'border-forest-border'
                        }`}>
                          {selected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-ink-primary truncate flex-1">{doc.filename}</span>
                        <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${DOC_TYPE_COLORS[doc.doc_type] || DOC_TYPE_COLORS.unknown}`}>
                          {doc.doc_type}
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Category filter — only when no specific docs selected */}
                {selectedDocIds.size === 0 && (
                  <div className="pt-2 border-t border-forest-border flex items-center gap-2">
                    <span className="text-xs text-ink-muted">Filter by type:</span>
                    <select
                      value={queryFilter}
                      onChange={e => setQueryFilter(e.target.value)}
                      className="bg-bg-secondary border border-forest-border text-ink-primary text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-forest-accent"
                    >
                      <option value="all">All</option>
                      <option value="contract">Contracts</option>
                      <option value="report">Reports</option>
                      <option value="invoice">Invoices</option>
                      <option value="policy">Policies</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {queryDocs.length === 0 && (
              <div className="rounded-xl border border-forest-border bg-bg-card p-4 text-center text-ink-secondary text-sm">
                No documents indexed yet —{' '}
                <button onClick={() => { setTab('upload') }} className="text-forest-accent hover:underline">upload one first</button>
              </div>
            )}

            {/* Question input */}
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runQuery() } }}
                  placeholder="e.g. What are the payment terms in the contracts?"
                  rows={3}
                  className="w-full bg-bg-card border border-forest-border text-ink-primary placeholder-ink-muted text-sm rounded-xl px-4 py-3 pr-14 focus:outline-none focus:border-forest-accent resize-none"
                />
                <button
                  onClick={runQuery}
                  disabled={queryLoading || !question.trim()}
                  className="absolute right-3 bottom-3 p-2 rounded-lg bg-forest-accent hover:bg-forest-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {queryLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </div>

              {!queryAnswer && !queryLoading && (
                <div className="flex flex-wrap gap-2">
                  {[
                    'Summarise all uploaded documents',
                    'What liability clauses appear in contracts?',
                    'List all invoice amounts',
                    'What policies cover data retention?',
                  ].map(ex => (
                    <button
                      key={ex}
                      onClick={() => setQuestion(ex)}
                      className="text-xs px-3 py-1.5 rounded-full border border-forest-border text-ink-secondary hover:text-ink-primary hover:border-forest-border-light transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {queryError && (
              <div className="rounded-lg border border-red-800/40 bg-red-900/10 p-4 text-red-400 text-sm">{queryError}</div>
            )}

            {queryAnswer && (
              <div className="rounded-xl border border-forest-border bg-bg-card p-6 space-y-4 animate-fade-up">
                <div>
                  <p className="text-xs text-ink-secondary uppercase tracking-widest mb-3">Answer</p>
                  <p className="text-ink-primary text-sm leading-relaxed whitespace-pre-wrap">{queryAnswer}</p>
                </div>
                {querySources.length > 0 && (
                  <div className="pt-4 border-t border-forest-border">
                    <p className="text-xs text-ink-secondary uppercase tracking-widest mb-2">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {querySources.map(src => (
                        <span key={src} className="text-xs px-2.5 py-1 rounded-full border border-forest-border text-ink-secondary">
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
