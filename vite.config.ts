import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    includeAssets: ['icons/icon.svg', 'icons/maskable-icon.svg'],
    manifest: {
      name: 'StudyFlow · 学习计划与专注', short_name: 'StudyFlow', lang: 'zh-CN',
      description: '本地优先的个人学习计划、专注与复盘工具。', start_url: './', scope: './', display: 'standalone',
      background_color: '#f4f7ef', theme_color: '#355d3e',
      icons: [
        { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'icons/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    workbox: { navigateFallback: 'index.html', globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'] },
  })],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: true,
  },
})
