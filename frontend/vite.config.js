import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    proxy: {
      // Auth routes
      '/auth': 'http://127.0.0.1:8000',
      // Chat and streaming
      '/chat': 'http://127.0.0.1:8000',
      // Upload
      '/upload': 'http://127.0.0.1:8000',
      // OpenAPI docs (optional)
      '/swagger': 'http://127.0.0.1:8000',
      '/openapi.json': 'http://127.0.0.1:8000',
      // Documents listing
      '/documents': 'http://127.0.0.1:8000',
      // Session messages
      '/auth/sessions': 'http://127.0.0.1:8000',
      // Health/liveness (if needed)
      '/health': 'http://127.0.0.1:8000',
    },
  },
})