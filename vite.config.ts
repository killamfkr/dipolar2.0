import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Required for Capacitor (Android/iOS): relative paths so assets load in the native WebView
  base: './',
})
