# Brave Incognito Mode Fix

## Issue
Brave browser on Android in incognito mode may block cross-origin requests due to:
1. Enhanced tracking protection
2. Cookie blocking in private mode
3. Strict CORS enforcement

## Solutions to Try

### 1. Backend - Allow Credentials
The backend already has `allow_credentials=True`, but Brave might still block if cookies are involved. The frontend should not send credentials by default.

### 2. Frontend - Check Credential Mode
In `frontend/src/App.jsx`, the fetch call should NOT include credentials for cross-origin requests:
```javascript
const req = fetch(url, {
  ...r,
  headers: {...},
  signal: controller.signal,
  // NO credentials: 'include' for cross-origin
})
```

### 3. Backend CORS - Relaxed for Brave
Add Brave-specific origins to CORS:
```python
allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173", 
    "http://localhost:8000",
    "http://192.168.1.12:5173",
    "https://brave.com"  # For Brave's privacy proxy domains
]
```

### 4. Test Without Incognito
The simplest fix: Test the application in Brave's normal (non-incognito) mode first.

### 5. Alternative: Use HTTPS
Serve the frontend over HTTPS. Brave and other browsers have stricter CORS policies for HTTP sites in incognito mode.

### 6. Check Brave Settings
In Brave Android:
- Go to Settings → Shields
- Lower the tracking protection level
- Disable "Block scripts/ad cookies" temporarily for testing
