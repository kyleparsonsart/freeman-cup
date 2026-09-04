/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // two pages, one build: the app (index.html) and the public scoreboard
  // (scoreboard.html, served at thefreemancup.com by a host rewrite in
  // vercel.json). The app URL never changes.
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        scoreboard: 'scoreboard.html',
      },
    },
  },
  define: {
    __BUILD_STAMP__: JSON.stringify(new Date().toISOString().slice(5, 16).replace('T', ' ')),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // public/manifest.json is the manifest; don't generate a second one
      manifest: false,
      includeAssets: ['manifest.json', 'icons/*.png', 'fonts/*.woff2', 'brand/*.svg'],
      workbox: {
        // the app shell (index.html + hashed js/css) is precached by default;
        // the scoreboard page is a different site and stays out of it
        globIgnores: ['**/scoreboard*'],
        navigateFallbackDenylist: [/^\/scoreboard/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
  },
})
