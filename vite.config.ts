import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const buildId = new Date().toISOString()

export default defineConfig({
  define: {
    __PESSY_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Pessy',
        short_name: 'Pessy',
        description: 'Tu mascota, sus cosas, todo en orden.',
        theme_color: '#074738',
        background_color: '#F0FAF9',
        start_url: '/inicio',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'es',
        categories: ['lifestyle', 'health'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],
        screenshots: [],
        shortcuts: [
          {
            name: 'Inicio',
            url: '/inicio',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          },
          {
            name: 'Agregar',
            url: '/inicio',
            icons: [{ src: 'pwa-192x192.png', sizes: '192x192' }]
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,  // CRÍTICO: el nuevo SW toma control inmediato (antes: false → usuarios stuck con bundle viejo hasta cerrar pestaña)
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // heic2any (1.35 MB) solo lo necesitan usuarios que suben fotos iPhone en formato HEIC.
        // Lo excluimos del precache y lo dejamos como runtime cache (descarga bajo demanda).
        globIgnores: ['**/vendor-heic*.js', '**/reset.html'],
        // SPA fallback — serve app.html for all navigation requests
        // so React Router handles client-side routing.
        // index.html is the React SPA entry point (Vite default output).
        navigateFallback: '/app.html',
        // Rutas excluidas del SW navigate-fallback:
        // - /api/*          → backend, nunca interceptar
        // - /offline.html   → página especial, sin SW
        // - / (raíz exacta) → landing page marketing, siempre fresca desde la red
        // - /empezar        → TikTok landing, idem — Google y usuarios ven siempre la última versión
        // - /privacidad, /terminos, /legal → páginas legales, siempre desde la red
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/offline\.html$/,
          // /^\/$/ — removido: start_url del PWA es / y el SW debe manejarlo
          /^\/empezar/,
          /^\/privacidad/,
          /^\/terminos/,
          /^\/legal/,
          /^\/reset/,
          /^\/reset\.html$/,
          /^\/vs/,
        ],
        runtimeCaching: [
          {
            urlPattern: /vendor-heic.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heic-lib-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          // ── Google Fonts stylesheets ──
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // ── Google Fonts woff2 files ──
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // ── Material Symbols font ──
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'material-symbols-cache',
              expiration: {
                maxEntries: 5,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // ── Open-Meteo weather API ──
          {
            urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 30 // 30 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              },
              networkTimeoutSeconds: 5
            }
          },
          // ── Unsplash images ──
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'unsplash-images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './apps/pwa/src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
      input: path.resolve(__dirname, 'app.html'),
      output: {
        manualChunks: {
          // Firebase — split por módulo para tree-shaking
          'firebase-app': ['firebase/app'],
          'firebase-auth': ['firebase/auth'],
          'firebase-firestore': ['firebase/firestore'],
          'firebase-storage': ['firebase/storage'],
          'firebase-messaging': ['firebase/messaging'],
          // Paquetes pesados — cada uno en su propio chunk
          'vendor-heic': ['heic2any'],
          'vendor-jspdf': ['jspdf'],
          // 'vendor-motion': ['motion'], // motion not installed — removed to fix build
          'vendor-lucide': ['lucide-react'],
          // App code
          'app-utils': [
            './apps/pwa/src/app/utils/clinicalBrain',
            './apps/pwa/src/app/utils/deduplication',
          ],
        },
      },
    },
  },
})
