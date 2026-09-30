import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3001'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile-.*\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['iPhone 17 Pro'] } },
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npm run dev -- --port 3001',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://layout-tests.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'layout-tests-placeholder',
    },
  },
})
