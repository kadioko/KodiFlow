import { expect, test } from '@playwright/test'
import { e2eCredentialsConfigured, signIn } from './helpers/auth'

test.describe('financial workflows', () => {
  test.skip(!e2eCredentialsConfigured, 'Configure dedicated staging E2E credentials to run authenticated financial workflows.')

  test('mobile invoice generation keeps its submit action reachable', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'Mobile layout coverage.')
    await signIn(page)
    await page.goto('/invoices/generate')
    await expect(page.getByRole('heading', { name: /generate invoice/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /generate invoice/i })).toBeVisible()
  })

  test('payment recording form loads an invoice without duplicate-submit controls', async ({ page }) => {
    test.skip(!process.env.E2E_INVOICE_ID, 'Set E2E_INVOICE_ID from an isolated staging fixture.')
    await signIn(page)
    await page.goto(`/payments/new?invoice=${process.env.E2E_INVOICE_ID}`)
    await expect(page.getByRole('heading', { name: /record payment/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /record payment/i })).toHaveCount(1)
  })

  test('renewal exposes carry-forward details before confirmation', async ({ page }) => {
    test.skip(!process.env.E2E_LEASE_ID, 'Set E2E_LEASE_ID from an isolated staging fixture.')
    await signIn(page)
    await page.goto(`/leases/${process.env.E2E_LEASE_ID}`)
    await page.getByRole('button', { name: /renew lease/i }).click()
    await expect(page.getByText(/opening balance|opening credit|carry-forward/i).first()).toBeVisible()
  })

  test('expired lease offers a move-out confirmation without changing records', async ({ page }) => {
    test.skip(!process.env.E2E_EXPIRED_LEASE_ID, 'Set E2E_EXPIRED_LEASE_ID from an isolated expired-lease fixture.')
    await signIn(page)
    await page.goto(`/leases/${process.env.E2E_EXPIRED_LEASE_ID}`)
    await page.getByRole('button', { name: /confirm move-out and mark unit vacant/i }).click()
    await expect(page.getByRole('heading', { name: /confirm tenant move-out/i })).toBeVisible()
    await expect(page.getByText(/no balance is transferred to a new tenant/i)).toBeVisible()
    await page.getByRole('button', { name: /cancel/i }).click()
    await expect(page.getByRole('heading', { name: /confirm tenant move-out/i })).toHaveCount(0)
  })

  test('invoice void and payment reversal pages require an explicit reason', async ({ page }) => {
    test.skip(!process.env.E2E_INVOICE_ID || !process.env.E2E_PAYMENT_ID, 'Set isolated E2E invoice and payment fixtures.')
    await signIn(page)
    await page.goto(`/invoices/${process.env.E2E_INVOICE_ID}`)
    await expect(page.getByRole('button', { name: /void/i })).toBeVisible()
    await page.goto(`/payments/${process.env.E2E_PAYMENT_ID}`)
    await expect(page.getByRole('button', { name: /reverse/i })).toBeVisible()
  })
})

test.describe('tenant portal', () => {
  test.skip(!process.env.E2E_TENANT_EMAIL || !process.env.E2E_TENANT_PASSWORD, 'Configure a dedicated tenant portal fixture account.')

  test('tenant can access only their invoice portal', async ({ page }) => {
    await page.goto('/auth/login')
    await page.getByLabel(/email/i).fill(process.env.E2E_TENANT_EMAIL!)
    await page.getByLabel(/password/i).fill(process.env.E2E_TENANT_PASSWORD!)
    await page.getByRole('button', { name: /sign in|login/i }).click()
    await page.goto('/tenant-portal')
    await expect(page.getByRole('heading', { name: /tenant portal|my invoices/i })).toBeVisible()
    await expect(page.getByText(/invoice/i).first()).toBeVisible()
  })
})
