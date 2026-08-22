import { defineConfig } from '@playwright/test'

const testPort = Number(process.env.STUDYFLOW_E2E_PORT ?? 4173);

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: {
    baseURL: `http://127.0.0.1:${testPort}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    port: testPort,
    reuseExistingServer: false,
  },
})
