import { generateId } from "./uuid"
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const stats = [
  { label: 'Search layer', value: 'ChromaDB' },
  { label: 'Response mode', value: 'Streaming' },
  { label: 'Upload flow', value: 'PDF ready' },
]

const quickPrompts = [
  'Summarize the uploaded document in 5 bullets.',
  'What are the key risks or action items?',
  'Pull out the most important numbers and dates.',
]

const generateSessionId = () => {
  return generateId()
}

function le(t, { token: n, ...r } = {}) {
  const base = import.meta.env.VITE_BACKEND_URL || ''
  const url = t.startsWith('http') ? t : `${base}${t}`
  const controller = new AbortController()
  const req = fetch(url, {
    ...r,
    headers: {
      ...r.headers,
      ...(n ? { Authorization: `Bearer ${n}` } : {}),
    },
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        return res.json().then((e) => {
          throw Error(e?.detail || e?.message || `Request failed with status ${res.status}`)
        }).catch(() => {
          throw Error(`Request failed with status ${res.status}: ${res.statusText}`)
        })
      }
      return res.json()
    })
    .catch((err) => {
      controller.abort()
      throw err
    })
  req.abort = () => controller.abort()
  return req
}

export default function App() {
  const storedToken = localStorage.getItem('akh_token') || ''
  const initialSessionId = localStorage.getItem('akh_session_id') || generateSessionId()
  if (!localStorage.getItem('akh_session_id')) localStorage.setItem('akh_session_id', initialSessionId)

  const [token, setToken] = useState(storedToken)
  const [user, setUser] = useState(null)
  const [sessionIdState, setSessionIdState] = useState(initialSessionId)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '', confirmPassword: '' })
  const [authError, setAuthError] = useState('')
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current_password: '', new_password: '' })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [query, setQuery] = useState('')
  const [documents, setDocuments] = useState([])
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(true)
  const [messages, setMessages] = useState([])
  const [uploadState, setUploadState] = useState({ status: 'idle', detail: 'No file uploaded yet.' })
  const [isUploading, setIsUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  
  // Toast Notification System
  const [toasts, setToasts] = useState([])
  const addToast = (message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  const fileInputRef = useRef(null)
  const seRef = useRef(null)

  useEffect(() => {
    if (!token) {
      setMessages([{ role: 'assistant', content: 'Sign in to see indexed documents, upload new PDFs, and continue your saved chat session.' }])
      setUser(null)
      setDocuments([])
      setSelectedDocuments([])
      setIsLoadingDocuments(false)
      return
    }

    const loadDocuments = async () => {
      setIsLoadingDocuments(true)
      try {
        const [meData, documentsData, messagesData] = await Promise.all([
          le('/auth/me', { token }),
          le('/upload/documents', { token }),
          le(`/auth/sessions/${sessionIdState}/messages`, { token }),
        ])

        setUser(meData)
        const nextDocuments = documentsData.documents || []
        setDocuments(nextDocuments)
        setSelectedDocuments((current) =>
          current.filter((docName) =>
            nextDocuments.some((item) => item.name === docName),
          ),
        )
        if (messagesData.messages?.length) {
          setMessages(messagesData.messages)
        } else {
          setMessages([{ role: 'assistant', content: 'Welcome back! Select your documents and start chatting.' }])
        }
      } catch (e) {
        setDocuments([])
        setMessages([{ role: 'assistant', content: 'Unable to fetch session — please sign in again.' }])
      } finally {
        setIsLoadingDocuments(false)
      }
    }

    loadDocuments()
  }, [token, sessionIdState])

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '',
    [messages]
  )

  const de = async (e) => {
    e.preventDefault()
    setIsAuthenticating(true)
    setAuthError('')

    if (authMode === 'register') {
      if (authForm.password.length < 8) {
        setAuthError('Password must be at least 8 characters.')
        setIsAuthenticating(false)
        return
      }
      if (authForm.password !== authForm.confirmPassword) {
        setAuthError('Passwords do not match.')
        setIsAuthenticating(false)
        return
      }
    }

    const payload = authMode === 'register'
      ? { username: authForm.username, password: authForm.password }
      : { username: authForm.username, password: authForm.password }

    try {
      const data = await le(`/auth/${authMode}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payload) 
      })
      localStorage.setItem('akh_token', data.access_token)
      setToken(data.access_token)
      setUser(data.user)
      setAuthError('')
      addToast(`Welcome back, ${data.user.username}!`, 'success')
      } catch (err) {
      setAuthError(err.message || 'Authentication failed.')
      addToast(err.message || 'Authentication failed.', 'error')
      } finally {
      setIsAuthenticating(false)
      }
      }

      const fe = () => {
      localStorage.removeItem('akh_token')
      setToken('')
      setUser(null)
      setMessages([])
      setDocuments([])
      setSelectedDocuments([])
      addToast('Logged out successfully.', 'info')
      }

      const pe = () => {
      const id = generateId()
      localStorage.setItem('akh_session_id', id)
      setSessionIdState(id)
      setMessages([{ id: generateId(), role: 'assistant', content: 'New session started. Select your documents and ask away.' }])
      addToast('New session started.', 'success')
      }

      const updatePassword = async (event) => {
      event.preventDefault()
      setPasswordError('')
      setPasswordMessage('')
      setIsChangingPassword(true)

      try {
      const data = await le('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
        token
      })
      setPasswordMessage(data.message || 'Password updated successfully.')
      setPasswordForm({ current_password: '', new_password: '' })
      addToast('Password updated successfully.', 'success')
      } catch (error) {
      setPasswordError(error.message || 'Failed to update password.')
      addToast(error.message || 'Failed to update password.', 'error')
      } finally {
      setIsChangingPassword(false)
      }
      }

      const handleUpload = async (file) => {
      if (!file) return

      if (documents.some((d) => d.name === file.name)) {
      setUploadState({ status: 'error', detail: `${file.name} is already indexed.` })
      addToast(`${file.name} is already indexed.`, 'warning')
      return
      }

      setIsUploading(true)
      setUploadState({ status: 'uploading', detail: `Indexing ${file.name}...` })

      const formData = new FormData()
      formData.append('file', file)

      try {
      const r = await fetch('/upload', { 
        method: 'POST',
        body: formData,
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!r.ok) {
        const err = await r.json().catch(() => null)
        throw Error(err?.detail || `Upload failed with status ${r.status}`)
      }
      const data = await r.json()
      const nextDoc = { name: data.file, chunks: data.chunks }
      setDocuments((prev) => [...prev, nextDoc].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedDocuments((prev) => prev.includes(data.file) ? prev : [...prev, data.file])
      setUploadState({ status: 'success', detail: `${data.file} indexed successfully.` })
      addToast(`${data.file} indexed successfully.`, 'success')
      } catch (err) {
      setUploadState({ status: 'error', detail: err.message || 'Upload failed.' })
      addToast(err.message || 'Upload failed.', 'error')
      } finally {
      setIsUploading(false)
      }
      }
  const ge = async (e) => {
    e.preventDefault()
    const n = query.trim()
    if (!n || isStreaming) return
    if (!selectedDocuments.length) {
      setMessages((prev) => [...prev, { id: generateId(), role: 'assistant', content: 'Select documents first.' }])
      return
    }

    seRef.current?.abort()
    setMessages((prev) => [...prev, { id: generateId(), role: 'user', content: n }, { id: 'streaming', role: 'assistant', content: '' }])
    setQuery('')
    setIsStreaming(true)

    const controller = new AbortController()
    seRef.current = controller

    try {
      const res = await fetch('/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ query: n, selected_documents: selectedDocuments, session_id: sessionIdState }),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) throw Error(`Streaming failed with status ${res.status}`)
      
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let s = ''
      while (true) {
        const { value: d, done: t } = await reader.read()
        if (t) break
        s += decoder.decode(d, { stream: true })
        const p = s.split('\n\n')
        s = p.pop() || ''
        for (const c of p) {
          const u = c.split('\n').find((l) => l.startsWith('data: '))
          if (!u) continue
          const v = JSON.parse(u.replace('data: ', ''))
          if (v.data) {
            setMessages((prev) => prev.map((m) => (m.id === 'streaming' ? { ...m, content: `${m.content}${v.data}` } : m)))
          }
        }
      }
      setMessages((prev) => prev.map((m) => m.id === 'streaming' ? { ...m, id: generateId() } : m))
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => prev.map((m) => m.id === 'streaming' ? { ...m, id: generateId(), content: m.content || `Error: ${err.message}` } : m))
      }
    } finally {
      setIsStreaming(false)
      seRef.current = null
    }
  }

  const toggleDoc = (name) => {
    setSelectedDocuments((prev) => prev.includes(name) ? prev.filter((d) => d !== name) : [...prev, name])
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-mesh px-4 py-6 text-ink sm:px-6 lg:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center rounded-[2rem] border border-white/60 bg-[#f7f1e8]/85 p-6 shadow-glow backdrop-blur">
          <section className="w-full rounded-[1.75rem] border border-[#d7c9b8] bg-white/80 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-ocean">Secure Access</p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-ink">
              {authMode === 'login' ? 'Sign in to your knowledge vault' : 'Create your account'}
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#5f5a63]">
              JWT authentication protects uploads, indexed documents, and your saved chat history.
            </p>
            <form className="mt-8 space-y-4" onSubmit={de}>
              <input
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                placeholder="Username"
                className="w-full rounded-2xl border border-[#e1d5c6] bg-[#fffaf4] px-4 py-3 outline-none"
                required
              />
              <input
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                placeholder="Password"
                className="w-full rounded-2xl border border-[#e1d5c6] bg-[#fffaf4] px-4 py-3 outline-none"
                required
                minLength={8}
              />
              {authMode === 'register' && (
                <input
                  type="password"
                  value={authForm.confirmPassword}
                  onChange={(e) => setAuthForm({ ...authForm, confirmPassword: e.target.value })}
                  placeholder="Confirm Password"
                  className="w-full rounded-2xl border border-[#e1d5c6] bg-[#fffaf4] px-4 py-3 outline-none"
                  required
                  minLength={8}
                />
              )}
              {authError && <p className="text-sm text-ember">{authError}</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-[#b9b1a8]"
                >
                  {isAuthenticating ? 'Working...' : authMode === 'login' ? 'Login' : 'Register'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setAuthError(''); }}
                  className="rounded-full border border-[#d9cab7] px-4 py-2 text-sm text-[#5f5860]"
                >
                  {authMode === 'login' ? 'Need an account?' : 'Have an account?'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-mesh px-4 py-6 text-ink sm:px-6 lg:px-10">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col gap-6 rounded-[2rem] border border-white/60 bg-[#f7f1e8]/85 p-4 shadow-glow backdrop-blur xl:p-6">
        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-hidden rounded-[1.75rem] border border-white/70 bg-ink px-6 py-8 text-white">
            <div className="mb-8 flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.32em] text-white/70">
                AI Knowledge Hub
              </span>
              <span className="rounded-full bg-ember/20 px-3 py-1 text-xs text-[#ffd3c8]">
                Live retrieval + response streaming
              </span>
              <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/70">
                {user?.username}
              </span>
            </div>
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              A document copilot that feels cinematic instead of clinical.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              Drop in PDFs, index them through your backend, and watch answers arrive
              token by token in a workspace designed to feel more like a crafted tool.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-white/15 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">{stat.label}</p>
                  <p className="mt-3 text-lg font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={pe} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition">
                New session
              </button>
              <button onClick={fe} className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10 transition">
                Logout
              </button>
            </div>
          </div>

          <section
            className={`rounded-[1.75rem] border border-[#d7c9b8] bg-white/70 p-5 transition ${
              dragActive ? 'scale-[1.01] border-ember shadow-[0_0_0_6px_rgba(240,109,79,0.12)]' : ''
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleUpload(e.dataTransfer.files?.[0]); }}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ocean">Document intake</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Feed the vault</h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-[#5f5a63]">
                  Upload a PDF once, then reuse it from your indexed library.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e7dcca] bg-[#fffaf4] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ocean">Profile</p>
                <p className="mt-2 text-sm font-semibold text-ink">{user?.username}</p>
                <form className="mt-4 space-y-2" onSubmit={updatePassword}>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    placeholder="Current password"
                    className="w-full rounded-xl border border-[#e1d5c6] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="New password (min 8 chars)"
                    className="w-full rounded-xl border border-[#e1d5c6] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button disabled={isChangingPassword} className="rounded-full border border-[#d9cab7] px-4 py-2 text-xs text-[#5f5860] hover:border-ocean hover:text-ocean transition">
                      {isChangingPassword ? 'Updating...' : 'Update password'}
                    </button>
                    {passwordMessage && <p className="text-xs text-leaf">{passwordMessage}</p>}
                    {passwordError && <p className="text-xs text-ember">{passwordError}</p>}
                  </div>
                </form>
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="group rounded-[1.5rem] border border-dashed border-[#d0bca8] bg-gradient-to-br from-[#fff7ec] to-[#f7ead8] p-6 text-left transition hover:border-ember hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-display text-2xl font-semibold text-ink">
                      {isUploading ? 'Indexing...' : 'Choose or drop a PDF'}
                    </p>
                    <p className="mt-2 text-sm text-[#6d6771]">{uploadState.detail}</p>
                  </div>
                  <div className="rounded-full bg-ink px-4 py-4 text-sm font-medium text-white transition group-hover:bg-ember">Upload</div>
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleUpload(e.target.files?.[0])} />

              <div className="flex items-center gap-3">
                <span className={`h-3 w-3 rounded-full ${uploadState.status === 'success' ? 'bg-leaf' : uploadState.status === 'error' ? 'bg-ember' : uploadState.status === 'uploading' ? 'bg-gold animate-pulse' : 'bg-[#bfb6aa]'}`} />
                <p className="text-sm text-[#645d67]">
                  {uploadState.status === 'success' ? 'Knowledge base is primed.' : uploadState.status === 'error' ? 'Upload failed.' : uploadState.status === 'uploading' ? 'Processing...' : 'Waiting for document.'}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e7dcca] bg-[#fffaf4] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ocean">Indexed library</p>
                    <p className="mt-2 text-sm text-[#655f68]">
                      {isLoadingDocuments ? 'Loading...' : documents.length ? 'Pick documents to scope chat.' : 'No docs yet.'}
                    </p>
                  </div>
                  <div className="rounded-full bg-ink px-3 py-1 text-xs text-white">{documents.length} docs</div>
                </div>
                <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isSelected = selectedDocuments.includes(doc.name)
                    return (
                      <label key={doc.name} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${isSelected ? 'border-ocean bg-[#eef7fa]' : 'border-[#eadfce] bg-white hover:border-[#d8c7b3]'}`}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleDoc(doc.name)} className="mt-1 h-4 w-4 rounded border-[#cdb79f] text-ocean focus:ring-ocean" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{doc.name}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#81766d]">{doc.chunks} chunks</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </section>

        <section className="grid flex-1 gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <aside className="rounded-[1.75rem] border border-[#dacdbc] bg-white/65 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-ocean">Prompt deck</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Start with a strong ask</h2>
            <div className="mt-6 space-y-3">
              {quickPrompts.map((p) => (
                <button key={p} onClick={() => setQuery(p)} className="w-full rounded-2xl border border-[#e8dccd] bg-[#fffaf3] px-4 py-4 text-left text-sm leading-6 text-[#534d57] transition hover:-translate-y-0.5 hover:border-ocean hover:bg-white">
                  {p}
                </button>
              ))}
            </div>
            <div className="mt-8 rounded-[1.5rem] bg-ink p-5 text-white">
              <p className="text-xs uppercase tracking-[0.26em] text-white/45">Latest answer snapshot</p>
              <p className="mt-4 text-sm leading-7 text-white/78">{lastAssistantMessage || 'Answer will appear here.'}</p>
            </div>
          </aside>

          <section className="flex min-h-[34rem] flex-col rounded-[1.75rem] border border-[#dacdbc] bg-white/75 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ocean">Conversation</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Streamed answers</h2>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto rounded-[1.5rem] bg-[#fffaf5] p-4">
              {messages.map((m) => (
                <article key={m.id || m.content} className={`max-w-[92%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm ${m.role === 'user' ? 'ml-auto bg-ink text-white' : 'border border-[#eadfce] bg-white text-[#514a55]'}`}>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.28em] opacity-55">{m.role === 'user' ? 'You' : 'Assistant'}</p>
                  {m.role === 'assistant' ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content || (isStreaming ? 'Thinking...' : '')}</ReactMarkdown>
                    </div>
                  ) : <p className="whitespace-pre-wrap">{m.content}</p>}
                </article>
              ))}
            </div>
            <form className="mt-4 rounded-[1.5rem] border border-[#e1d5c6] bg-white p-3 shadow-sm" onSubmit={ge}>
              <textarea value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ask a question..." className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-ink outline-none" rows="3" />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8d8277]">
                  {isStreaming ? 'Streaming...' : `${selectedDocuments.length} docs selected`}
                </p>
                <button type="submit" disabled={!query.trim() || isStreaming} className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ocean transition disabled:bg-[#b9b1a8]">
                  Ask the vault
                </button>
              </div>
            </form>
          </section>
        </section>
      </div>

      {/* Global Toast Container */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur transition-all animate-in fade-in slide-in-from-bottom-4 ${
              toast.type === 'error'
                ? 'border-ember/30 bg-ember/10 text-ember'
                : toast.type === 'success'
                ? 'border-green-500/30 bg-green-500/10 text-green-600'
                : 'border-[#d9cab7] bg-white/90 text-[#5f5860]'
            }`}
          >
            {toast.type === 'error' && (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        ))}
      </div>
    </main>
  )
}
