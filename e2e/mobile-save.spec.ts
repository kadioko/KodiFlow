import { expect, test } from '@playwright/test'
import { expectTouchable, fixtureError, fixtureId, mockMobileData, setKeyboardHeight } from './helpers/mobile-fixtures'

for (const keyboardOpen of [false, true]) {
  for (const form of [
    { path: `/invoices/${fixtureId}/edit`, label: /^Save invoice/, endpoint: '/rest/v1/rent_invoices' },
    { path: `/payments/new?invoice=${fixtureId}`, label: /^Record payment/, endpoint: '/rest/v1/rpc/record_invoice_payment' },
    { path: '/settings', label: /^Save settings/, endpoint: '/rest/v1/profiles' },
    { path: '/invoices/generate', label: /^Generate 1 invoice/, endpoint: '/rest/v1/rpc/create_rent_invoice_for_lease' },
  ]) {
    test(`${form.path} submits by touch with keyboard ${keyboardOpen ? 'open' : 'closed'}`, async ({ page }, testInfo) => {
      const writes = await mockMobileData(page)
      await page.setViewportSize({ width: 402, height: 874 })
      await page.goto(form.path)
      const bar = page.getByRole('region', { name: 'Form actions' })
      const save = bar.getByRole('button', { name: form.label })
      await expect(save).toBeEnabled()
      if (keyboardOpen) {
        await page.locator('textarea, input:not([type=checkbox]):not([type=hidden])').last().focus()
        await setKeyboardHeight(page, 336)
      }
      await expectTouchable(save, page)
      await page.screenshot({ path: testInfo.outputPath('before-save.png') })
      await save.tap()
      await expect.poll(() => writes.filter((write) => write.path === form.endpoint).length).toBe(1)
      await expect(bar.getByRole('alert')).toContainText(fixtureError)
      await expect(save).toBeEnabled()
      await expectTouchable(save, page)
      await save.tap()
      await expect.poll(() => writes.filter((write) => write.path === form.endpoint).length).toBe(2)
    })
  }
  test(`lease renewal is scrollable with keyboard ${keyboardOpen ? 'open' : 'closed'}`, async ({ page }, testInfo) => {
    const writes = await mockMobileData(page)
    await page.setViewportSize({ width: 402, height: 874 })
    await page.goto(`/leases/${fixtureId}`)
    await page.getByRole('button', { name: 'Renew', exact: true }).tap()
    const dialog = page.getByRole('dialog', { name: 'Renew Lease', exact: true })
    await dialog.getByLabel('New Monthly Rent (TZS)').fill('616000')
    if (keyboardOpen) await setKeyboardHeight(page, 336)
    const renew = dialog.getByRole('button', { name: 'Renew Lease', exact: true })
    await expectTouchable(renew, page)
    await page.screenshot({ path: testInfo.outputPath('renewal.png') })
    await renew.tap()
    await expect.poll(() => writes.filter((write) => write.path === '/rest/v1/rpc/renew_lease').length).toBe(1)
    await expect(dialog.getByRole('alert')).toHaveText(fixtureError)
    await expectTouchable(renew, page)
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).tap()
    await expect(dialog).toBeHidden()
  })
}

test('settings confirms a successful save beside the green action', async ({ page }) => {
  await mockMobileData(page)
  let savedInstructions = ''
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    savedInstructions = route.request().postDataJSON().invoice_payment_instructions
    await route.fulfill({ status: 204 })
  })
  await page.goto('/settings')
  await page.getByLabel('Invoice Payment Instructions').fill('Pay into the agreed bank account')
  const bar = page.getByRole('region', { name: 'Form actions' })
  await bar.getByRole('button', { name: 'Save settings' }).tap()
  await expect(bar.getByRole('status')).toHaveText('Settings saved')
  expect(savedInstructions).toBe('Pay into the agreed bank account')
})

test('payment ignores another tap while its first request is pending', async ({ page }) => {
  await mockMobileData(page)
  let count = 0
  let finishRequest: () => void = () => {}
  const pendingRequest = new Promise<void>((resolve) => { finishRequest = resolve })
  await page.route('**/rest/v1/rpc/record_invoice_payment', async (route) => {
    count++
    await pendingRequest
    await route.fulfill({ status: 400, json: { message: fixtureError } })
  })
  try {
    await page.goto(`/payments/new?invoice=${fixtureId}`)
    const bar = page.getByRole('region', { name: 'Form actions' })
    const save = bar.getByRole('button')
    await expect(save).toBeEnabled()
    await save.tap()
    await expect.poll(() => count).toBe(1)
    await expect(save).toBeDisabled()
    await expect(save).toContainText('Recording payment...')
    const box = (await save.boundingBox())!
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
    finishRequest()
    await expect(bar.getByRole('alert')).toContainText(fixtureError)
    expect(count).toBe(1)
  } finally {
    finishRequest()
  }
})

test('password reset can retry after correcting a mismatch', async ({ page }) => {
  await mockMobileData(page)
  await page.goto('/auth/reset-password')
  await page.getByLabel('New password', { exact: true }).fill('Test-only-password-42')
  await page.getByLabel('Confirm new password', { exact: true }).fill('Different-password-42')
  const save = page.getByRole('button', { name: 'Update password', exact: true })
  await save.tap()
  await expect(page.locator('form').getByRole('alert')).toHaveText('The passwords do not match.')
  await page.getByLabel('Confirm new password', { exact: true }).fill('Test-only-password-42')
  await expect(save).toBeEnabled()
  await save.tap()
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible()
})
