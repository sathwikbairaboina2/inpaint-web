import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:5421'

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    // host runs use installed Chrome (has WebGPU); CI and the container use bundled Chromium
    channel: process.env.CI ? undefined : 'chrome',
    launchOptions: { args: process.env.CI ? [] : ['--enable-unsafe-webgpu'] },
  },
  projects: [{ name: 'chromium' }],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'pnpm build && pnpm preview',
        url: 'http://localhost:5421',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
})
