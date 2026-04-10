import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const quickPrompts = [
  'Summarize the uploaded document in 5 bullets.',
  'What are the key risks or action items?',
  'Pull out the most important numbers and dates.',
]

const stats = [
  { label: 'Search layer', value: 'ChromaDB' },
  { label: 'Response mode', value: 'Streaming' },
  { label: 'Upload flow', value: 'PDF ready' },
]

const storedToken = localStorage.getItem('akh_token') || ''
const storedSessionId = localStorage.getItem('akh_session_id') || crypto.randomUUID()

if (!localStorage.getItem('akh_session_id')) {
  localStorage.setItem('akh_session_id', storedSessionId)
}

function App() {
  const [token, setToken] = useState(storedToken)
  const [user, setUser] = useState(null)
  const [sessionId, setSessionId] = useState(storedSessionId)
  const [authMode, setAuthMode] = useState('login')
  const [authForm, setAuthForm] = useState({ username: '', password: '' })
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
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        'Upload a PDF or choose from indexed documents, then ask a question. I will stream the answer from the selected document set.',
    },
  ])
  const [uploadState, setUploadState] = useState({ status: 'idle', detail: 'No file uploaded yet.' })
  const [isUploading, setIsUploading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!token) {
      setDocuments([])
      setSelectedDocuments([])
      setMessages([
        {
          role: 'assistant',
          content:
            'Sign in to see indexed documents, upload new PDFs, and continue your saved chat session.',
        },
      ])
      setUser(null)
      setIsLoadingDocuments(false)
      return
    }

    const loadDocuments = async () => {
      setIsLoadingDocuments(true)
      try {
        const [meData, documentsData, messagesData] = await Promise.all([
          apiFetch('/auth/me', { token }),
          apiFetch('/documents', { token }),
          apiFetch(`/auth/sessions/${sessionId}/messages`, { token }),
        ])

        setUser(meData)
        const data = documentsData
        const nextDocuments = data.documents || []
        setDocuments(nextDocuments)
        setSelectedDocuments((current) =>
          current.filter((document) =>
            nextDocuments.some((item) => item.name === document),
          ),
        )
        if (messagesData.messages?.length) {
          setMessages(messagesData.messages)
        }
      } catch (_error) {
        setDocuments([])
      } finally {
        setIsLoadingDocuments(false)
      }
    }

    loadDocuments()
  }, [token, sessionId])

  const lastAssistantMessage = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant')?.content ?? '',
    [messages],
  )

  const updateStreamingMessage = (chunk) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === 'streaming'
          ? { ...message, content: `${message.content}${chunk}` }
          : message,
      ),
    )
  }

  const finishStreamingMessage = () => {
    setMessages((current) =>
      current.map((message) =>
        message.id === 'streaming' ? { ...message, id: crypto.randomUUID() } : message,
      ),
    )
  }

  const apiFetch = async (url, { token: authToken = token, headers = {}, ...options } = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
    })

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null)
      throw new Error(errorPayload?.detail || `Request failed with status ${response.status}`)
    }

    return response.json()
  }

  const submitAuth = async (event) => {
    event.preventDefault()
    setIsAuthenticating(true)
    setAuthError('')

    try {
      const data = await apiFetch(`/auth/${authMode}`, {
        token: '',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      })
      localStorage.setItem('akh_token', data.access_token)
      setToken(data.access_token)
      setUser(data.user)
    } catch (error) {
      setAuthError(error.message || 'Authentication failed.')
    } finally {
      setIsAuthenticating(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('akh_token')
    setToken('')
    setUser(null)
    setDocuments([])
    setSelectedDocuments([])
  }

  const startNewSession = () => {
    const nextSessionId = crypto.randomUUID()
    localStorage.setItem('akh_session_id', nextSessionId)
    setSessionId(nextSessionId)
    setMessages([
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'New session started. Select your documents and ask away.',
      },
    ])
  }

  const updatePassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordMessage('')
    setIsChangingPassword(true)

    try {
      const data = await apiFetch('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordForm),
      })
      setPasswordMessage(data.message || 'Password updated successfully.')
      setPasswordForm({ current_password: '', new_password: '' })
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  const handleUpload = async (file) => {
    if (!file) return

    if (documents.some((document) => document.name === file.name)) {
      setUploadState({
        status: 'error',
        detail: `${file.name} is already indexed. Select it from the library instead of uploading it again.`,
      })
      return
    }

    setIsUploading(true)
    setUploadState({ status: 'uploading', detail: `Indexing ${file.name}...` })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null)
        throw new Error(
          errorPayload?.detail || `Upload failed with status ${response.status}`,
        )
      }

      const data = await response.json()
      const nextDocument = { name: data.file, chunks: data.chunks }
      setDocuments((current) =>
        [...current, nextDocument].sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      )
      setSelectedDocuments((current) =>
        current.includes(data.file) ? current : [...current, data.file],
      )
      setUploadState({
        status: 'success',
        detail: `${file.name} indexed successfully with ${data.chunks} chunks.`,
      })
    } catch (error) {
      setUploadState({
        status: 'error',
        detail: error.message || 'Upload failed.',
      })
    } finally {
      setIsUploading(false)
    }
  }

  const sendQuery = async (nextQuery) => {
    const trimmed = nextQuery.trim()
    if (!trimmed || isStreaming) return
    if (!selectedDocuments.length) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Select at least one indexed document before starting a chat.',
        },
      ])
      return
    }

    abortRef.current?.abort()

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: trimmed },
      { id: 'streaming', role: 'assistant', content: '' },
    ])
    setQuery('')
    setIsStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: trimmed,
          selected_documents: selectedDocuments,
          session_id: sessionId,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const event of events) {
          const line = event
            .split('\n')
            .find((entry) => entry.startsWith('data: '))

          if (!line) continue

          const payload = JSON.parse(line.replace('data: ', ''))
          if (payload.data) {
            updateStreamingMessage(payload.data)
          }
        }
      }

      finishStreamingMessage()
    } catch (error) {
      if (error.name === 'AbortError') {
        setMessages((current) =>
          current.filter((message) => message.id !== 'streaming'),
        )
      } else {
        setMessages((current) =>
          current.map((message) =>
            message.id === 'streaming'
              ? {
                  ...message,
                  id: crypto.randomUUID(),
                  content:
                    message.content ||
                    `I ran into a streaming error: ${error.message || 'unknown error'}`,
                }
              : message,
          ),
        )
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }

  const toggleDocumentSelection = (name) => {
    setSelectedDocuments((current) =>
      current.includes(name)
        ? current.filter((document) => document !== name)
        : [...current, name],
    )
  }

  if (!token) {
    return (
      <main className="min-h-screen bg-mesh px-4 py-6 text-ink sm:px-6 lg:px-10">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl items-center justify-center rounded-[2rem] border border-white/60 bg-[#f7f1e8]/85 p-6 shadow-glow backdrop-blur">
          <section className="w-full rounded-[1.75rem] border border-[#d7c9b8] bg-white/80 p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-ocean">Secure Access</p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-ink">
              Sign in to your knowledge vault
            </h1>
            <p className="mt-4 text-sm leading-7 text-[#5f5a63]">
              JWT authentication protects uploads, indexed documents, and your saved chat history in PostgreSQL.
            </p>
            <form className="mt-8 space-y-4" onSubmit={submitAuth}>
              <input
                value={authForm.username}
                onChange={(event) => setAuthForm((current) => ({ ...current, username: event.target.value }))}
                placeholder="Username"
                className="w-full rounded-2xl border border-[#e1d5c6] bg-[#fffaf4] px-4 py-3 outline-none"
              />
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="Password"
                className="w-full rounded-2xl border border-[#e1d5c6] bg-[#fffaf4] px-4 py-3 outline-none"
              />
              {authError ? <p className="text-sm text-ember">{authError}</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={isAuthenticating}
                  className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-[#b9b1a8]"
                >
                  {isAuthenticating ? 'Working...' : authMode === 'login' ? 'Login' : 'Create account'}
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMode((current) => (current === 'login' ? 'register' : 'login'))}
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
              <button
                type="button"
                onClick={logout}
                className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-[#ffe8d8]"
              >
                Logout
              </button>
            </div>
            <h1 className="max-w-2xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl">
              A document copilot that feels cinematic instead of clinical.
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-white/72 sm:text-base">
              Drop in PDFs, index them through your backend, and watch answers arrive
              token by token in a workspace designed to feel more like a crafted tool
              than a default dashboard.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-white/15 bg-white/5 p-4"
                >
                  <p className="text-xs uppercase tracking-[0.24em] text-white/45">
                    {stat.label}
                  </p>
                  <p className="mt-3 text-lg font-semibold text-white">{stat.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startNewSession}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white"
              >
                New session
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-white"
              >
                Logout
              </button>
            </div>
          </div>

          <section
            className={`rounded-[1.75rem] border border-[#d7c9b8] bg-white/70 p-5 transition ${
              dragActive ? 'scale-[1.01] border-ember shadow-[0_0_0_6px_rgba(240,109,79,0.12)]' : ''
            }`}
            onDragOver={(event) => {
              event.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault()
              setDragActive(false)
              handleUpload(event.dataTransfer.files?.[0])
            }}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ocean">Document intake</p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
                  Feed the vault
                </h2>
                <p className="mt-3 max-w-md text-sm leading-7 text-[#5f5a63]">
                  Upload a PDF once, then reuse it from your indexed library whenever
                  you want to chat across one or many documents.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e7dcca] bg-[#fffaf4] p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-ocean">Profile</p>
                <p className="mt-2 text-sm font-semibold text-ink">{user?.username}</p>
                <form className="mt-4 space-y-2" onSubmit={updatePassword}>
                  <input
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        current_password: event.target.value,
                      }))
                    }
                    placeholder="Current password"
                    className="w-full rounded-xl border border-[#e1d5c6] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <input
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(event) =>
                      setPasswordForm((current) => ({
                        ...current,
                        new_password: event.target.value,
                      }))
                    }
                    placeholder="New password (min 8 chars)"
                    className="w-full rounded-xl border border-[#e1d5c6] bg-white px-3 py-2 text-sm outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={isChangingPassword}
                      className="rounded-full border border-[#d9cab7] px-4 py-2 text-xs text-[#5f5860] transition hover:border-ocean hover:text-ocean disabled:cursor-not-allowed"
                    >
                      {isChangingPassword ? 'Updating...' : 'Update password'}
                    </button>
                    {passwordMessage ? <p className="text-xs text-leaf">{passwordMessage}</p> : null}
                    {passwordError ? <p className="text-xs text-ember">{passwordError}</p> : null}
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
                      {isUploading ? 'Indexing your file...' : 'Choose or drop a PDF'}
                    </p>
                    <p className="mt-2 text-sm text-[#6d6771]">
                      {uploadState.detail}
                    </p>
                  </div>
                  <div className="rounded-full bg-ink px-4 py-4 text-sm font-medium text-white transition group-hover:bg-ember">
                    Upload
                  </div>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(event) => handleUpload(event.target.files?.[0])}
              />

              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    uploadState.status === 'success'
                      ? 'bg-leaf'
                      : uploadState.status === 'error'
                        ? 'bg-ember'
                        : uploadState.status === 'uploading'
                          ? 'bg-gold animate-pulse'
                          : 'bg-[#bfb6aa]'
                  }`}
                />
                <p className="text-sm text-[#645d67]">
                  {uploadState.status === 'success'
                    ? 'Knowledge base is primed.'
                    : uploadState.status === 'error'
                      ? 'Upload needs attention.'
                      : uploadState.status === 'uploading'
                        ? 'Processing document now.'
                        : 'Waiting for your first document.'}
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-[#e7dcca] bg-[#fffaf4] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-ocean">
                      Indexed library
                    </p>
                    <p className="mt-2 text-sm text-[#655f68]">
                      {isLoadingDocuments
                        ? 'Loading indexed documents...'
                        : documents.length
                          ? 'Pick one or more documents to scope your chat.'
                          : 'No indexed documents yet.'}
                    </p>
                  </div>
                  <div className="rounded-full bg-ink px-3 py-1 text-xs text-white">
                    {documents.length} docs
                  </div>
                </div>

                <div className="mt-4 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {documents.map((document) => {
                    const isSelected = selectedDocuments.includes(document.name)
                    return (
                      <label
                        key={document.name}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition ${
                          isSelected
                            ? 'border-ocean bg-[#eef7fa]'
                            : 'border-[#eadfce] bg-white hover:border-[#d8c7b3]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleDocumentSelection(document.name)}
                          className="mt-1 h-4 w-4 rounded border-[#cdb79f] text-ocean focus:ring-ocean"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {document.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#81766d]">
                            {document.chunks} chunks indexed
                          </p>
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
            <h2 className="mt-3 font-display text-3xl font-semibold text-ink">
              Start with a strong ask
            </h2>
            <div className="mt-6 space-y-3">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => setQuery(prompt)}
                  className="w-full rounded-2xl border border-[#e8dccd] bg-[#fffaf3] px-4 py-4 text-left text-sm leading-6 text-[#534d57] transition hover:-translate-y-0.5 hover:border-ocean hover:bg-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="mt-8 rounded-[1.5rem] bg-ink p-5 text-white">
              <p className="text-xs uppercase tracking-[0.26em] text-white/45">
                Latest answer snapshot
              </p>
              <p className="mt-4 text-sm leading-7 text-white/78">
                {lastAssistantMessage || 'Your streamed answer will appear here as a quick glance card.'}
              </p>
              <p className="mt-4 text-xs uppercase tracking-[0.24em] text-white/45">
                Active docs: {selectedDocuments.length ? selectedDocuments.join(', ') : 'none selected'}
              </p>
            </div>
          </aside>

          <section className="flex min-h-[34rem] flex-col rounded-[1.75rem] border border-[#dacdbc] bg-white/75 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4 px-1">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-ocean">Conversation</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
                  Streamed answers
                </h2>
              </div>
              <a
                href="/swagger"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-[#d9cab7] px-4 py-2 text-sm text-[#5f5860] transition hover:border-ocean hover:text-ocean"
              >
                API docs
              </a>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto rounded-[1.5rem] bg-[#fffaf5] p-4">
              {messages.map((message) => (
                <article
                  key={message.id ?? message.content}
                  className={`max-w-[92%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 shadow-sm ${
                    message.role === 'user'
                      ? 'ml-auto bg-ink text-white'
                      : 'border border-[#eadfce] bg-white text-[#514a55]'
                  }`}
                >
                  <p className="mb-2 text-[11px] uppercase tracking-[0.28em] opacity-55">
                    {message.role === 'user' ? 'You' : 'Assistant'}
                  </p>
                  {message.role === 'assistant' ? (
                    <div className="markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {message.content || (isStreaming ? 'Thinking through your documents...' : '')}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </article>
              ))}
            </div>

            <form
              className="mt-4 rounded-[1.5rem] border border-[#e1d5c6] bg-white p-3 shadow-sm"
              onSubmit={(event) => {
                event.preventDefault()
                sendQuery(query)
              }}
            >
              <label className="sr-only" htmlFor="query">
                Ask a question
              </label>
              <textarea
                id="query"
                rows="4"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ask a grounded question about the indexed document..."
                className="w-full resize-none bg-transparent px-2 py-2 text-sm leading-7 text-ink outline-none placeholder:text-[#9b8f84]"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.24em] text-[#8d8277]">
                  {isStreaming
                    ? 'Streaming response...'
                    : selectedDocuments.length
                      ? `${selectedDocuments.length} document${selectedDocuments.length > 1 ? 's' : ''} selected`
                      : 'Select documents to begin'}
                </p>
                <div className="flex items-center gap-3">
                  {isStreaming ? (
                    <button
                      type="button"
                      onClick={() => abortRef.current?.abort()}
                      className="rounded-full border border-[#d9cab7] px-4 py-2 text-sm text-[#5f5860] transition hover:border-ember hover:text-ember"
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    disabled={!query.trim() || isStreaming}
                    className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ocean disabled:cursor-not-allowed disabled:bg-[#b9b1a8]"
                  >
                    Ask the vault
                  </button>
                </div>
              </div>
            </form>
          </section>
        </section>
      </div>
    </main>
  )
}

export default App
