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
        name: 'PESSY - Salud Animal',
        short_name: 'PESSY',
        description: 'Tu asistente inteligente para el cuidado de tus mascotas',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
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
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // heic2any (1.35 MB) solo lo necesitan usuarios que suben fotos iPhone en formato HEIC.
        // Lo excluimos del precache y lo dejamos como runtime cache (descarga bajo demanda).
        globIgnores: ['**/vendor-heic*.js'],
        runtimeCaching: [
          {
            urlPattern: /vendor-heic.*\.js$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'heic-lib-cache',
              expiration: { maxEntries: 1, maxAgeSeconds: 60 * 60 * 24 * 90 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // <1 year
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
      '@': path.resolve(__dirname, './src'),
    },
  },
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
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
          'vendor-motion': ['motion'],
          'vendor-lucide': ['lucide-react'],
          // App code
          'app-utils': [
            './src/app/utils/clinicalBrain',
            './src/app/utils/clinicalRouting',
            './src/app/utils/medicalRulesEngine',
            './src/app/utils/deduplication',
          ],
        },
      },
    },
  },
})
