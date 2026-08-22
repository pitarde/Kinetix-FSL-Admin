import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split big third-party libraries into their own long-lived vendor
        // chunks. They rarely change, so browsers keep them cached across
        // deploys, and it keeps the app's own `index` chunk small. (Vite 8 /
        // Rolldown requires manualChunks to be a function, not an object.)
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          // Firestore is the heavy half of Firebase; keep it apart from auth so
          // neither chunk trips the 500 kB warning and each caches on its own.
          if (/[\\/](firebase|@firebase)[\\/]firestore/.test(id)) return 'firebase-firestore'
          if (/[\\/](firebase|@firebase)[\\/]auth/.test(id)) return 'firebase-auth'
          if (/[\\/](firebase|@firebase)[\\/]/.test(id)) return 'firebase'
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
})
