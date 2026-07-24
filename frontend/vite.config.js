import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production the built assets are served by Django/WhiteNoise under /static/.
// In dev, base is '/' and /api, /media, /ws are proxied to Django on :8000.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/static/' : '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/media': 'http://127.0.0.1:8000',
      '/ws': { target: 'ws://127.0.0.1:8000', ws: true },
    },
  },
}))
