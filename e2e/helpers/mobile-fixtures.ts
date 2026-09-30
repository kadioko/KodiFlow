import { expect, type Page, type Locator } from '@playwright/test'

export const fixtureId = '00000000-0000-4000-8000-000000000001'
export const fixtureError = 'Could not save. Please try again.'
const user = { id: fixtureId, email: 'layout@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }

export async function mockMobileData(page: Page) {
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const jwt = ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ sub: fixtureId, exp: expiresAt })).toString('base64url'), 'fixture'].join('.')
  const session = { access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: expiresAt, expires_in: 3600, user }
  await page.context().addCookies([{ name: 'sb-layout-tests-auth-token', value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`, url: 'http://127.0.0.1:3001' }])
  await page.addInitScript(() => {
    localStorage.setItem('kodiflow-theme', 'light')
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true })
  })
  await page.route('**/api/auth/session', (route) => route.fulfill({ json: { user, adminRole: 'none' } }))
  const writes: { path: string; body: Record<string, unknown> }[] = []
  await page.route('https://*.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/auth/v1/user') return route.fulfill({ json: user })
    const table = url.pathname.split('/').pop()
    const single = request.headers().accept?.includes('application/vnd.pgrst.object+json')
    if (['expire_stale_leases', 'refresh_overdue_invoices'].includes(table || '')) return route.fulfill({ json: null })
    if (request.method() !== 'GET' && request.method() !== 'HEAD') {
      writes.push({ path: url.pathname, body: request.postDataJSON() })
      return route.fulfill({ status: 400, json: { message: fixtureError, code: 'TEST' } })
    }
    const today = new Date()
    const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
    const lease = { id: fixtureId, user_id: fixtureId, tenant_id: fixtureId, unit_id: fixtureId, property_id: fixtureId, start_date: start, end_date: `${today.getFullYear() + 1}-12-31`, monthly_rent: 616000, deposit_amount: 0, rent_due_day: 5, lease_type: 'residential', billing_frequency: 'semi_annually', status: 'active', notes: '', created_at: start, tenants: { id: fixtureId, full_name: 'Mobile Test Tenant', tenant_type: 'individual' }, units: { unit_name: 'Unit 51' }, properties: { name: 'Test Property' } }
    const invoice = { id: fixtureId, invoice_number: 'INV-TEST-001', tenant_id: fixtureId, unit_id: fixtureId, lease_id: fixtureId, due_date: start, status: 'unpaid', notes: '', amount_paid: 0, subtotal: 3696000, balance: 3696000, billing_period_start: '2020-01-01', billing_period_end: '2020-06-30', tenants: lease.tenants, units: lease.units, properties: lease.properties }
    const rows: Record<string, unknown[]> = {
      rent_invoices: [invoice],
      invoice_items: [{ id: fixtureId, item_name: 'Six month rent', item_type: 'rent', amount: 3696000, notes: '' }],
      leases: [lease],
      profiles: [{ currency_preference: 'TZS', language_preference: 'en', late_fee_rate: 0, invoice_payment_instructions: 'Test bank account', invoice_footer_note: 'E.&.O.E.' }],
    }
    const data = rows[table || ''] || []
    return route.fulfill({ json: single ? data[0] || {} : data })
  })
  return writes
}

export async function expectTouchable(button: Locator, page: Page) {
  await expect(button).toBeVisible()
  const box = await button.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.height).toBeGreaterThanOrEqual(48)
  const viewport = await page.evaluate(() => ({ top: visualViewport?.offsetTop || 0, height: visualViewport?.height || innerHeight }))
  expect(box!.y).toBeGreaterThanOrEqual(viewport.top - 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.top + viewport.height + 1)
  // Check the whole tap target, not just its center.
  expect(await button.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return [0.1, 0.5, 0.9].every((x) => [0.1, 0.5, 0.9].every((y) => element.contains(document.elementFromPoint(rect.x + rect.width * x, rect.y + rect.height * y))))
  })).toBe(true)
}

export async function setKeyboardHeight(page: Page, height: number) {
  // WebKit automation has no physical iOS keyboard. Reproduce its visual viewport
  // resize and cover the keyboard area to test actual hit targets.
  await page.evaluate((keyboardHeight) => {
    const viewport = window.visualViewport!
    Object.defineProperties(viewport, {
      height: { configurable: true, value: window.innerHeight - keyboardHeight },
      offsetTop: { configurable: true, value: 0 },
    })
    document.getElementById('test-keyboard')?.remove()
    if (keyboardHeight) {
      const keyboard = document.createElement('div')
      keyboard.id = 'test-keyboard'
      keyboard.style.cssText = `position:fixed;inset:auto 0 0;height:${keyboardHeight}px;z-index:9999;background:#ccc`
      document.body.append(keyboard)
    }
    viewport.dispatchEvent(new Event('resize'))
  }, height)
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--visible-viewport-bottom').trim())).toBe(`${height}px`)
}
