import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: process.env.TAURI_DEV_HOST || false,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: 'esnext',
    outDir: 'dist',
    // Multi-page : fenêtre principale + mini-widget bureau (fenêtre Tauri séparée)
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('index.html', import.meta.url)),
        widget: fileURLToPath(new URL('widget.html', import.meta.url)),
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
