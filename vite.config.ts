import { defineConfig } from 'vitest/config'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const omitDesktopReleaseAssets = {
  name: 'omit-desktop-release-assets-from-desktop-bundle',
  closeBundle() {
    if (process.env.STUDYFLOW_DESKTOP_BUILD === '1') {
      rmSync(resolve('dist', 'desktop'), { recursive: true, force: true })
    }
  },
}

export default defineConfig({
  plugins: [react(), VitePWA({
    registerType: 'prompt',
    strategies: 'injectManifest',
    srcDir: 'src',
    filename: 'sw.ts',
    includeAssets: ['icons/icon.svg', 'icons/maskable-icon.svg'],
    manifest: {
      name: 'StudyFlow · 学习计划与专注', short_name: 'StudyFlow', lang: 'zh-CN',
      id: './', description: '本地优先的个人学习计划、专注与复盘工具。', start_url: './', scope: './', display: 'standalone',
      background_color: '#f4f7ef', theme_color: '#355d3e',
      icons: [
        { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        { src: 'icons/maskable-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
      ],
    },
    injectManifest: { globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,ogg,wav}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 },
  }), omitDesktopReleaseAssets],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      // Rust keeps DLLs in this directory locked while Tauri compiles. They are
      // not frontend source files, so watching them only makes Vite crash on Windows.
      ignored: ['**/src-tauri/target/**'],
    },
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
