# Function Line-by-Line Documentation

This guide documents the current backend and frontend source files with line-number references.

## Backend

### [backend/app/config.py](/home/lokesh3440/development/ai-knowledge-hub/backend/app/config.py)
- `L2-L5`: Imports standard library + `dotenv` loader.
- `L8`: Computes backend base directory from current file path.
- `L9`: Loads `.env` so config values are available through `os.getenv`.
- `L11-L24`: Reads and normalizes runtime settings (LLM, embeddings, JWT, DB, Chroma).

### [backend/app/db.py](/home/lokesh3440/development/ai-knowledge-hub/backend/app/db.py)
- `L9`: Creates SQLAlchemy engine from `DATABASE_URL`.
- `L10`: Creates session factory (`SessionLocal`) used per request.

#### `class Base` (`L13-L14`)
- `L13-L14`: SQLAlchemy declarative base for ORM models.

#### `class User` (`L17-L26`)
- `L18`: Table name `users`.
- `L20-L23`: User columns (`id`, `username`, `password_hash`, `created_at`).
- `L25`: Relationship to chat sessions.

#### `class ChatSession` (`L28-L47`)
- `L29`: Table name `chat_sessions`.
- `L31-L39`: Session columns (`id`, `user_id`, `title`, timestamps).
- `L41`: Back reference to owning `User`.
- `L42-L46`: Ordered relationship to `ChatMessage` rows.

#### `class ChatMessage` (`L49-L58`)
- `L50`: Table name `chat_messages`.
- `L52-L56`: Message columns (`id`, `session_id`, `role`, `content`, `created_at`).
- `L58`: Back reference to parent session.

#### `get_db()` (`L61-L66`)
- `L62`: Opens DB session.
- `L63-L65`: Yields session to route dependencies.
- `L66`: Ensures close in `finally`.

#### `init_db()` (`L69-L70`)
- `L70`: Creates tables if missing.

### [backend/app/main.py](/home/lokesh3440/development/ai-knowledge-hub/backend/app/main.py)
- `L7-L14`: FastAPI app metadata + docs URLs.
- `L16-L22`: CORS for local frontend origins.
- `L24`: Initializes DB schema on startup.
- `L26-L28`: Registers `auth`, `upload`, `chat` routers.

### [backend/routes/auth.py](/home/lokesh3440/development/ai-knowledge-hub/backend/routes/auth.py)
- `L9`: Router with `/auth` prefix.

#### `class Credentials` (`L12-L15`)
- `L13-L14`: Login/register payload shape.

#### `class PasswordChangePayload` (`L17-L20`)
- `L18-L19`: Change-password request shape.

#### `register()` (`L22-L37`)
- `L24`: Finds existing username.
- `L25-L27`: Rejects duplicates (`409`).
- `L28`: Creates `User` with hashed password.
- `L29-L31`: Persists + refreshes row.
- `L33-L37`: Returns bearer token + user profile.

#### `login()` (`L40-L50`)
- `L42`: Fetches user by username.
- `L43-L44`: Verifies credentials or returns `401`.
- `L46-L50`: Returns JWT token and user info.

#### `me()` (`L53-L55`)
- `L54-L55`: Returns currently authenticated user identity.

#### `change_password()` (`L58-L74`)
- `L64-L65`: Validates current password.
- `L67-L68`: Enforces minimum new password length.
- `L70-L72`: Stores new password hash.
- `L74`: Returns success payload.

#### `get_session_messages()` (`L77-L102`)
- `L83-L87`: Validates session belongs to current user.
- `L88-L89`: Returns empty list for missing session.
- `L91-L96`: Loads session messages ordered by time.
- `L97-L102`: Serializes messages for frontend.

### [backend/routes/chat.py](/home/lokesh3440/development/ai-knowledge-hub/backend/routes/chat.py)
#### `class Query` (`L15-L18`)
- `L16-L18`: Chat payload (`query`, selected docs, `session_id`).

#### `_ensure_session()` (`L21-L32`)
- `L22-L26`: Looks up session by `session_id` + `user_id`.
- `L27-L31`: Creates session if not found.
- `L32`: Returns ensured session.

#### `chat()` (`L35-L46`)
- `L41`: Ensures session exists.
- `L42`: Saves user message.
- `L43`: Gets assistant answer from RAG (`ask`).
- `L44-L45`: Saves assistant message + commits.
- `L46`: Returns non-stream response.

#### `chat_stream()` (`L49-L74`)
- `L55-L57`: Ensures session and stores user message.
- `L59-L73`: Defines SSE generator.
- `L61-L64`: Streams chunks from `stream_answer`.
- `L65-L72`: Persists final assistant content.
- `L74`: Returns `StreamingResponse`.

### [backend/routes/upload.py](/home/lokesh3440/development/ai-knowledge-hub/backend/routes/upload.py)
- `L14`: Worker count for parallel embedding calls.

#### `upload()` (`L17-L57`)
- `L19-L23`: Duplicate filename guard.
- `L25`: Temporary local file path.
- `L28-L29`: Writes uploaded file to disk.
- `L32`: Extracts text from PDF.
- `L35`: Chunks text.
- `L36-L41`: Rejects empty-text documents.
- `L44-L45`: Parallel embeddings via thread pool.
- `L48`: Stores embeddings/chunks to vector store.
- `L51`: Deletes temporary file.
- `L53-L57`: Returns upload summary.

#### `documents()` (`L60-L62`)
- `L61-L62`: Returns indexed document list (auth-protected).

### [backend/services/auth.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/auth.py)
- `L15`: HTTP Bearer auth extractor.

#### `hash_password()` (`L18-L21`)
- `L19`: Generates random salt.
- `L20`: PBKDF2 hash.
- `L21`: Stores as `salt_hex:digest_hex`.

#### `verify_password()` (`L24-L29`)
- `L25-L27`: Parses stored salt/hash.
- `L28`: Recomputes hash from input password.
- `L29`: Constant-time compare.

#### `create_access_token()` (`L32-L39`)
- `L33`: Computes expiry timestamp.
- `L34-L38`: Builds JWT claims (`sub`, `username`, `exp`).
- `L39`: Signs token using configured algorithm/secret.

#### `get_current_user()` (`L42-L66`)
- `L46-L48`: Rejects missing credentials.
- `L50-L54`: Decodes/validates JWT.
- `L55-L59`: Rejects bad/expired token.
- `L61-L63`: Loads user row from DB.
- `L63-L64`: Rejects missing user.
- `L66`: Returns authenticated `User`.

### [backend/services/chunking.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/chunking.py)
#### `chunk_text()` (`L2-L15`)
- `L3`: Whitespace normalization.
- `L4-L5`: Handles empty text.
- `L7-L8`: Initializes chunk list and stride (`size-overlap`).
- `L10-L13`: Sliding window chunking with overlap.
- `L15`: Returns chunk list.

### [backend/services/embedding.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/embedding.py)
- `L7`: Loads local sentence-transformer model once at import.

#### `get_embedding()` (`L10-L19`)
- `L11-L12`: Rejects blank text.
- `L14-L18`: Encodes text to normalized numpy embedding.
- `L19`: Converts embedding to plain Python list.

### [backend/services/llm.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/llm.py)
- `L5-L8`: Creates OpenAI-compatible client with custom base URL.

#### `generate_answer()` (`L10-L70`)
- `L11-L24`: Builds strict prompt with context and question.
- `L26-L32`: Calls chat completions API.
- `L34-L69`: Handles multiple response shapes (string/dict/object).
- `L70`: Final fallback converts response to string.

### [backend/services/parser.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/parser.py)
#### `parse_pdf()` (`L4-L9`)
- `L5`: Initializes aggregate text buffer.
- `L6-L8`: Iterates pages and appends extracted text.
- `L9`: Returns full parsed text.

### [backend/services/rag.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/rag.py)
#### `ask()` (`L7-L38`)
- `L8`: Embeds user query.
- `L9`: Retrieves relevant chunks with optional doc filter.
- `L10`: Joins chunks into context.
- `L12-L28`: Calls chat completion.
- `L30-L38`: Normalizes response output.

#### `stream_answer()` (`L41-L69`)
- `L42-L45`: Embeds query and constructs context.
- `L47-L64`: Starts streaming LLM call.
- `L66-L69`: Emits SSE-friendly `{"data": delta}` chunks.

### [backend/services/search.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/search.py)
This is legacy SQLite search code and is not used by the current Chroma path.

#### `cosine_similarity()` (`L6-L7`)
- Computes cosine similarity from two vectors.

#### `search()` (`L9-L19`)
- Loads stored embeddings from SQLite, scores, sorts, returns top results.

### [backend/services/vectorstore.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/vectorstore.py)
#### `get_chroma_client()` (`L13-L27`)
- `L14`: Uses cloud path only if cloud config is complete.
- `L16-L21`: Tries `chromadb.CloudClient`.
- `L22-L24`: Falls back to local on any cloud exception.
- `L26`: Local persistent client fallback.

#### `has_document()` (`L34-L40`)
- Checks if any vector entry exists with `metadata.source == filename`.

#### `list_documents()` (`L43-L63`)
- Reads metadatas from Chroma.
- Aggregates chunk counts per source filename.
- Returns sorted document summary list.

#### `add_chunks()` (`L65-L82`)
- Creates deterministic IDs `filename:index`.
- Builds chunk metadata (`source`, `chunk_index`).
- Writes docs + embeddings + metadata to Chroma collection.

#### `_build_where_clause()` (`L85-L94`)
- Returns `None` for no filtering.
- Builds single-source filter for one doc.
- Builds `$or` clause for multi-doc selection.

#### `search()` (`L97-L104`)
- Builds filter clause.
- Queries Chroma with query embedding and `top_k`.
- Returns first documents list (or empty list).

## Frontend

### [frontend/src/main.jsx](/home/lokesh3440/development/ai-knowledge-hub/frontend/src/main.jsx)
- `L1-L4`: Imports React bootstrapping and root app.
- `L6-L10`: Mounts `<App />` inside `#root` wrapped in `StrictMode`.

### [frontend/src/App.jsx](/home/lokesh3440/development/ai-knowledge-hub/frontend/src/App.jsx)
#### Top-level constants (`L5-L22`)
- `L5-L15`: Static UI cards/prompts.
- `L17-L22`: Loads persisted auth/session from `localStorage`.

#### `App()` component (`L24+`)
- `L25-L53`: Declares all UI/data state refs.

#### `useEffect loadDocuments` block (`L54-L99`)
- `L55-L68`: Handles logged-out state cleanup.
- `L70-L99`: Loads `/auth/me`, `/documents`, and session messages in parallel.

#### `lastAssistantMessage` (`L101-L104`)
- Memoized helper for latest assistant summary card.

#### `updateStreamingMessage(chunk)` (`L106-L114`)
- Appends incoming streamed token text to placeholder message.

#### `finishStreamingMessage()` (`L116-L122`)
- Replaces temporary `id='streaming'` with stable random ID.

#### `apiFetch(url, options)` (`L124-L139`)
- Shared fetch helper that auto-attaches bearer token.
- Throws human-readable error from API payload when possible.

#### `submitAuth(event)` (`L141-L161`)
- Prevents form submit default.
- Calls `/auth/login` or `/auth/register`.
- Stores JWT in `localStorage` and state.

#### `logout()` (`L163-L169`)
- Clears token and resets user/document state.

#### `startNewSession()` (`L171-L182`)
- Creates new session UUID.
- Persists it in `localStorage`.
- Resets messages with a fresh assistant intro.

#### `updatePassword(event)` (`L184-L203`)
- Calls `/auth/change-password`.
- Shows success/error feedback.
- Clears password form on success.

#### `handleUpload(file)` (`L205-L260`)
- Rejects empty input and duplicate filename.
- Sends multipart upload with auth header.
- On success, merges uploaded file into document list and auto-selects it.
- Updates upload status indicators.

#### `sendQuery(nextQuery)` (`L262-L360`)
- Validates query and selected document constraints.
- Creates temporary streaming assistant message.
- POSTs to `/chat/stream` with `session_id`.
- Reads SSE stream and appends deltas.
- Handles abort and non-abort failures gracefully.

#### `toggleDocumentSelection(name)` (`L362-L368`)
- Adds/removes document name in selected set.

#### Render branches
- `L370-L418`: Auth screen when no token.
- `L420+`: Main app UI with profile, upload, indexed docs, prompts, and chat panel.

### [frontend/index.html](/home/lokesh3440/development/ai-knowledge-hub/frontend/index.html)
- `L4-L7`: Base metadata and title.
- `L10`: Root div for React mount.
- `L11`: Entry script loading `src/main.jsx`.

### [frontend/src/index.css](/home/lokesh3440/development/ai-knowledge-hub/frontend/src/index.css)
- `L1-L5`: Font import + Tailwind layers.
- `L7-L41`: Global reset and base visual system.
- `L43-L132`: Markdown typography styles used by assistant messages.

### [frontend/vite.config.js](/home/lokesh3440/development/ai-knowledge-hub/frontend/vite.config.js)
- `L5-L15`: Vite config with React plugin and backend proxy routes for dev mode.

### [frontend/tailwind.config.js](/home/lokesh3440/development/ai-knowledge-hub/frontend/tailwind.config.js)
- `L3`: Tailwind content paths.
- `L5-L25`: Theme extensions (colors, fonts, shadows, gradients).
- `L27`: Plugins array (empty currently).

### [frontend/postcss.config.js](/home/lokesh3440/development/ai-knowledge-hub/frontend/postcss.config.js)
- `L1-L6`: Enables `tailwindcss` + `autoprefixer`.

### [frontend/eslint.config.js](/home/lokesh3440/development/ai-knowledge-hub/frontend/eslint.config.js)
- `L7-L29`: Flat ESLint config for React/Vite project:
  - target files
  - recommended rule sets
  - parser options
  - local unused-vars override

---

## Notes
- This documentation excludes `node_modules`, compiled `dist`, and binary/cache artifacts.
- Legacy file [backend/services/search.py](/home/lokesh3440/development/ai-knowledge-hub/backend/services/search.py) is retained in repo but not part of active Chroma retrieval flow.
