---
category: debugging
title: Debugging CORS and Auth Issues in Full-Stack Apps
---

# Debugging CORS and Auth Issues in Full-Stack Apps

## Problem Pattern
When auth/register/login endpoints work via backend API docs (Swagger) but fail from the frontend, it's typically a CORS or configuration issue.

## Diagnostic Checklist

### 1. Check CORS Configuration
**Backend:** Verify CORS middleware allows the frontend origin.
- Look for `allow_origins` in FastAPI/CORS middleware config
- Ensure it includes the actual origin the frontend uses (not just localhost:5173)
- Consider all environments: dev server, production build, different machines

**Common Fix:** Add multiple origins:
```python
allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://192.168.1.12:5173"]
```

### 2. Verify Proxy Configuration
**Vite:** Check `vite.config.js` proxy routes match backend endpoints.
```js
proxy: {
  '/auth': 'http://127.0.0.1:8000',
  '/chat': 'http://127.0.0.1:8000',
}
```
Note: Proxy only works for dev server (port 5173), not when frontend is served from same port as backend.

### 3. Check Frontend Environment Variables
Ensure `.env` has correct backend URL:
```
VITE_BACKEND_URL=http://localhost:8000
```

### 4. Error Handling Debugging
When API calls fail silently, enhance error handling:
```javascript
async function apiCall(url, options = {}) {
  try {
    const res = await fetch(url, options);
    if (!res.ok) {
      const errorData = await res.json().catch(() => null);
      const message = errorData?.detail || errorData?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return res.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

## Docker Build Issues
**Frontend Build Failing:** If `npm run build` fails in Docker but works locally:
1. Check Node.js version compatibility (`node:20-alpine`)
2. Ensure all dependencies are in `package.json` (not just devDependencies)
3. Verify build script in `package.json` matches local commands

**Build Context:** Ensure Docker build context includes all necessary files:
- `COPY package*.json ./` before `COPY . .` for efficient layer caching
- `.dockerignore` to exclude node_modules, dist, etc.

## Common Pitfalls
1. **Origin Mismatch:** Frontend at `http://localhost:8000` but CORS only allows `http://localhost:5173`
2. **Missing Preflight Response:** OPTIONS requests for CORS need proper backend handling
3. **Stale Browser Cache:** Test in incognito mode after config changes
4. **Environment Variables Not Loaded:** In Docker, ensure `.env` file is mounted and read

## Resolution Workflow
1. Check browser dev tools Network tab for CORS errors
2. Verify backend logs for incoming requests
3. Test endpoints with curl to isolate frontend vs backend issues
4. Gradually add origins to CORS config until it works, then tighten
5. Ensure consistent HTTP/HTTPS across all URLs