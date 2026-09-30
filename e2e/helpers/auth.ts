import { expect, type Page } from '@playwright/test'

export const e2eCredentialsConfigured = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD)

export async function signIn(page: Page) {
  if (!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD are required for authenticated browser tests.')
  }

  await page.goto('/auth/login')
  await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL)
  await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD)
  await page.getByRole('button', { name: /sign in|login/i }).click()
  await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 })
}
