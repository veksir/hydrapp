import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        injectionPoint: 'self.__WB_MANIFEST',
      },
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'HydrApp - Hidratación inteligente',
        short_name: 'HydrApp',
        description: 'Seguimiento de hidratación personalizado con recordatorios inteligentes',
        theme_color: '#0E7C86',
        background_color: '#F1FAFB',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    // host:true expone el servidor de desarrollo (`npm run dev`/`preview`) a
    // la red local — útil para probar en tu celular durante el desarrollo.
    // No afecta el build de producción (`dist/`), que se sirve con Nginx u
    // otro servidor estático; no uses `vite preview` para servir tráfico real.
    host: true,
    port: 5173,
  },
})
