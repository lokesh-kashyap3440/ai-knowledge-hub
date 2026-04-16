---
category: troubleshooting
name: debug-cors-frontend-backend
security_flags:
  - troubleshooting
---
## Debugging CORS Issues Between Frontend and Backend

### Problem Pattern
When frontend API requests work through Swagger/backend but fail from the frontend application, it's typically a CORS configuration issue.

### Root Cause Analysis
1. **CORS Allowed Origins Mismatch**: The backend's CORS middleware restricts which origins can access the API. If the frontend's actual origin (e.g., `http://localhost:8000`) isn't in the allowed list, browser CORS policy blocks the requests.

2. **Environment Variable Configuration**: The frontend's `.env` file (`VITE_BACKEND_URL`) specifies the backend URL, which must match an origin in the backend's CORS config.

### Solution Pattern

#### Backend (FastAPI)
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",      # Vite dev server
        "http://127.0.0.1:5173",      # Alternative localhost
        "http://localhost:8000",      # Backend port (when frontend served directly)
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Frontend (Vite)
Ensure `.env` matches the backend URL:
```
VITE_BACKEND_URL=http://localhost:8000
```

#### Proxy Configuration (Vite)
`vite.config.js` helps during development:
```javascript
server: {
  proxy: {
    '/auth': 'http://127.0.0.1:8000',
    '/chat': 'http://127.0.0.1:8000',
    // ... other routes
  }
}
```

### Error Handling Pattern
Improve frontend error handling to surface backend validation errors:

```javascript
function le(t, { token: n, ...r } = {}) {
  const base = import.meta.env.VITE_BACKEND_URL || ''
  const url = t.startsWith('http') ? t : `${base}${t}`
  const controller = new AbortController()
  
  return fetch(url, {
    ...r,
    headers: {
      ...r.headers,
      ...(n ? { Authorization: `Bearer ${n}` } : {}),
    },
    signal: controller.signal,
  })
    .then((res) => {
      if (!res.ok) {
        // Try to get detailed error message from response
        return res.json().then((e) => {
          throw Error(e?.detail || e?.message || `Request failed with status ${res.status}`)
        }).catch(() => {
          // If response is not JSON, use status text
          throw Error(`Request failed with status ${res.status}: ${res.statusText}`)
        })
      }
      return res.json()
    })
    .catch((err) => {
      controller.abort()
      throw err
    })
}
```

### Key Learnings
- CORS configuration must match the actual frontend origin(s)
- Development proxy doesn't apply when frontend is served from the backend port
- Always surface backend error details in frontend error handling for better debugging
- Test both proxy and direct backend access scenarios during development

### Common Scenarios
1. **Vite Dev Server**: Runs on port 5173, uses proxy to backend
2. **Production Build**: Served from backend port (8000) or separate domain
3. **Direct Backend Access**: Frontend makes requests directly to backend port