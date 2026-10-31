import { expect, test, type Page } from '@playwright/test'
import { expectTouchable, fixtureId, mockMobileData, setKeyboardHeight } from './helpers/mobile-fixtures'

const propertyId = '20000000-0000-4000-8000-000000000001'
const unitId = '30000000-0000-4000-8000-000000000001'
const tenantId = '40000000-0000-4000-8000-000000000001'
const secondTenantId = '40000000-0000-4000-8000-000000000002'
const submeterId = '50000000-0000-4000-8000-000000000001'
const mainMeterId = '50000000-0000-4000-8000-000000000002'
const readingId = '60000000-0000-4000-8000-000000000001'

function workspace(ownerMode: boolean) {
  const reading = {
    id: readingId,
    account_id: submeterId,
    owner_user_id: fixtureId,
    previous_meter_reading: 110,
    current_meter_reading: 125,
    usage_units: 15,
    opening_balance_units: 20,
    topup_units: 30,
    adjustment_units: 0,
    closing_balance_units: 35,
    previous_reading_date: '2026-10-28',
    reading_date: '2026-10-29',
    notes: null,
    recorded_by: fixtureId,
    created_at: '2026-10-29T08:00:00.000Z',
  }
  const submeter = {
    id: submeterId,
    owner_user_id: fixtureId,
    property_id: propertyId,
    meter_kind: 'submeter',
    unit_id: unitId,
    tenant_id: tenantId,
    floor_label: 'Floor 2',
    ledger_tenant_label: null,
    display_name: null,
    meter_number: 'SUB-51',
    initial_meter_reading: 100,
    initial_reading_date: '2026-10-27',
    opening_balance_units: 20,
    low_units_threshold: 10,
    active: true,
    created_by: fixtureId,
    created_at: '2026-10-27T08:00:00.000Z',
    updated_at: '2026-10-29T08:00:00.000Z',
    property_name: 'Dora Tower',
    unit_name: 'Unit 51',
    tenant_name: 'Twilight Office Services Limited',
    tenant_phone: '+255700000001',
    section_name: 'Floor 2',
    latest_reading: reading,
    pending_verified_topup_units: 0,
    pending_reported_topup_units: 0,
    pending_topup_count: 0,
    pending_adjustment_units: 0,
    pending_adjustment_count: 0,
    estimated_balance_units: 35,
    last_cutoff_event: null,
  }
  const mainMeter = {
    ...submeter,
    id: mainMeterId,
    meter_kind: 'floor_main',
    unit_id: null,
    tenant_id: null,
    floor_label: 'Ground / Reception main TANESCO meter',
    display_name: null,
    meter_number: '001234567890',
    initial_meter_reading: 0,
    initial_reading_date: '2026-10-27',
    opening_balance_units: 0,
    low_units_threshold: 50,
    tenant_name: 'Unassigned client',
    tenant_phone: null,
    latest_reading: null,
    estimated_balance_units: 0,
  }

  return {
    ownerMode,
    currentUserId: fixtureId,
    currentStaffId: ownerMode ? null : 'DT-014',
    properties: [{ id: propertyId, name: 'Dora Tower' }],
    sections: [{ id: '70000000-0000-4000-8000-000000000001', name: 'Floor 2', property_id: propertyId, section_type: 'floor' }],
    units: [{ id: unitId, unit_name: 'Unit 51', property_id: propertyId, section_id: '70000000-0000-4000-8000-000000000001', unit_identifier: '51' }],
    tenants: [
      { id: tenantId, full_name: 'Twilight Office Services Limited', business_name: null, phone: '+255700000001', user_id: fixtureId },
      { id: secondTenantId, full_name: 'New Client Company Limited', business_name: null, phone: '+255700000002', user_id: fixtureId },
    ],
    accounts: [submeter, mainMeter],
    readings: [reading],
    mainMeterBalances: [
      { id: '80000000-0000-4000-8000-000000000001', account_id: mainMeterId, owner_user_id: fixtureId, reading_date: '2026-10-28', units_remaining: 500, units_purchased_since_previous: null, notes: null, recorded_by: fixtureId, created_at: '2026-10-28T08:00:00.000Z' },
      { id: '80000000-0000-4000-8000-000000000002', account_id: mainMeterId, owner_user_id: fixtureId, reading_date: '2026-10-29', units_remaining: 400, units_purchased_since_previous: 0, notes: null, recorded_by: fixtureId, created_at: '2026-10-29T08:00:00.000Z' },
    ],
    topups: [],
    cutoffEvents: [],
    adjustments: [],
    staff: ownerMode ? [{
      id: '90000000-0000-4000-8000-000000000001',
      auth_user_id: '90000000-0000-4000-8000-000000000002',
      staff_id: 'DT-014',
      full_name: 'Meter Staff',
      active: true,
      created_at: '2026-10-01T08:00:00.000Z',
      last_login_at: '2026-10-29T08:00:00.000Z',
      property_ids: [propertyId],
      last_activity: null,
    }] : [],
    staffLoginEvents: [],
  }
}

async function openWorkspace(page: Page, ownerMode: boolean) {
  await mockMobileData(page)
  await page.route('**/api/electricity', (route) => route.fulfill({ json: workspace(ownerMode) }))
  await page.route('**/api/electricity/history*', (route) => route.fulfill({ json: { rows: [], total: 0, page: 1, pageSize: 40 } }))
  await page.goto('/electricity')
  await expect(page.getByRole('heading', { name: 'Electricity monitoring' })).toBeVisible()
}

async function expectNoPageOverflow(page: Page) {
  const width = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }))
  expect(width.content).toBeLessThanOrEqual(width.viewport + 1)
}

for (const viewport of [
  { width: 320, height: 568 },
  { width: 375, height: 812 },
  { width: 402, height: 874 },
  { width: 874, height: 402 },
]) {
  test(`staff Electricity views fit ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await openWorkspace(page, false)
    await expectNoPageOverflow(page)

    for (const name of ['Overview', 'Record readings', 'Record LUKU', 'History & search', 'Meters and balances', 'Ledger and reports', 'Entries & corrections', 'Issues & history', 'Staff help']) {
      const tab = page.getByRole('tab', { name, exact: true })
      await tab.scrollIntoViewIfNeeded()
      await expectTouchable(tab, page)
      await tab.tap()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expectNoPageOverflow(page)
    }

    await expect(page.getByRole('heading', { name: 'Electricity staff help' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('electricity-staff-help.png') })
  })
}

test('LUKU history searches token digits and keeps the complete token masked until requested', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, false)
  let requestedSearch = ''
  const token = '12345678901234567890'
  await page.route('**/api/electricity/history*', async (route) => {
    const url = new URL(route.request().url())
    requestedSearch = url.searchParams.get('search') || ''
    await route.fulfill({ json: {
      rows: [{
        id: 'topup-history-1',
        type: 'topups',
        accountId: submeterId,
        occurredAt: '2026-10-30T08:00:00.000Z',
        actorId: fixtureId,
        actorName: 'Meter Staff',
        confirmedAt: '2026-10-30T09:00:00.000Z',
        confirmedByName: 'Property Owner',
        reversedAt: null,
        reversedByName: null,
        reversalReason: null,
        payload: {
          id: 'topup-history-1',
          account_id: submeterId,
          purchase_date: '2026-10-30',
          units: 24.5,
          purchase_amount_tzs: 12000,
          token_code: token,
          token_suffix: '7890',
          status: 'verified',
          verified_at: '2026-10-30T09:00:00.000Z',
          verified_by: fixtureId,
          recorded_by: fixtureId,
          reversed_at: null,
          reversed_by: null,
          reversal_reason: null,
          notes: 'Checked against submeter',
        },
      }],
      total: 1,
      page: 1,
      pageSize: 40,
    } })
  })

  await page.getByRole('tab', { name: 'History & search' }).tap()
  await expect(page.getByRole('heading', { name: 'Electricity history & search' })).toBeVisible()
  const search = page.getByLabel('Search records')
  await search.fill('1234567890')
  await expect.poll(() => requestedSearch).toBe('1234567890')
  await expect(page.getByText('24.5 kWh')).toBeVisible()
  await expect(page.getByText(token)).toHaveCount(0)
  await expect(page.getByText(/•••• •••• •••• 7890/)).toBeVisible()
  await page.getByRole('button', { name: 'Show full token' }).tap()
  await expect(page.getByText(token)).toBeVisible()
  await expect(page.getByText(/Confirmed by Property Owner/)).toBeVisible()
})

test('floor coverage clearly shows a main-meter shortfall and reserve top-up on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, false)
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
  const data = workspace(false)
  data.accounts[0].latest_reading!.reading_date = today
  data.accounts[1].floor_label = 'Floor 2'
  data.mainMeterBalances = [{ ...data.mainMeterBalances[1], reading_date: today, units_remaining: 20 }]
  await page.route('**/api/electricity', (route) => route.fulfill({ json: data }))
  await page.reload()

  const coverage = page.getByRole('region', { name: 'Floor LUKU coverage' })
  await expect(coverage).toBeVisible()
  await expect(coverage.getByText('Estimated credit shortfall')).toBeVisible()
  await expect(coverage.getByText('15 kWh', { exact: true })).toBeVisible()
  await expect(coverage.getByText('65 kWh', { exact: true })).toBeVisible()
  await coverage.getByText('View matched client balances').tap()
  await expect(coverage.getByText(/Twilight Office Services Limited/)).toBeVisible()
  await expectNoPageOverflow(page)
  await page.getByRole('tab', { name: 'Meters and balances' }).tap()
  await expect(page.getByRole('region', { name: 'Floor LUKU coverage' }).getByText('Estimated credit shortfall')).toBeVisible()
})

test('staff can see owner adjustments but cannot edit or reverse them', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, false)
  const data = {
    ...workspace(false),
    adjustments: [{ id: 'adjustment-1', account_id: submeterId, owner_user_id: fixtureId, adjustment_date: '2026-10-29', adjustment_units: 5, reason: 'Owner checked the balance', recorded_by: fixtureId, created_at: '2026-10-29T08:00:00.000Z', applied_reading_id: null }],
  }
  await page.route('**/api/electricity', (route) => route.fulfill({ json: data }))
  await page.reload()
  await page.getByRole('tab', { name: 'Entries & corrections' }).tap()
  await page.getByLabel('Entry type').selectOption('adjustment')
  await expect(page.getByText('Owner checked the balance')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Edit entry' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Reverse entry' })).toHaveCount(0)
})

test('a slow old history search cannot overwrite the latest search', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, false)
  let oldSearchStarted = false
  await page.route('**/api/electricity/history*', async (route) => {
    const search = new URL(route.request().url()).searchParams.get('search') || ''
    if (search === 'first') {
      oldSearchStarted = true
      await new Promise((resolve) => setTimeout(resolve, 1200))
    }
    try {
      await route.fulfill({ json: { rows: [], total: search === 'first' ? 9 : search === 'second' ? 2 : 0, page: 1, pageSize: 40 } })
    } catch {
      // The browser may cancel the superseded request before the mock responds.
    }
  })
  await page.getByRole('tab', { name: 'History & search' }).tap()
  const search = page.getByLabel('Search records')
  await search.fill('first')
  await expect.poll(() => oldSearchStarted).toBe(true)
  await search.fill('second')
  await expect(page.getByText('2 records', { exact: true })).toBeVisible()
  await page.waitForTimeout(1400)
  await expect(page.getByText('2 records', { exact: true })).toBeVisible()
})

test('owner meter handoff and staff setup remain usable on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, true)

  await page.getByRole('tab', { name: 'Meters and balances' }).tap()
  await page.getByRole('button', { name: /Edit submeter/ }).tap()
  const handoffForm = page.locator('form').filter({ has: page.getByLabel('Submeter / client name') })
  await handoffForm.getByRole('combobox').selectOption(secondTenantId)
  await expect(handoffForm.getByLabel('Current reading (kWh)')).toBeVisible()
  await expectNoPageOverflow(page)

  await page.getByRole('tab', { name: 'Staff access' }).tap()
  await page.getByRole('button', { name: 'Add staff' }).tap()
  await expect(page.getByLabel('Staff ID')).toBeVisible()
  await expectNoPageOverflow(page)
})

test('reading and LUKU save actions remain reachable above the iPhone keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await openWorkspace(page, false)
  await page.route('**/api/electricity/readings', (route) => route.fulfill({ json: {
    reading: {
      id: '60000000-0000-4000-8000-000000000002',
      account_id: submeterId,
      owner_user_id: fixtureId,
      previous_meter_reading: 125,
      current_meter_reading: 130,
      usage_units: 5,
      opening_balance_units: 35,
      topup_units: 0,
      adjustment_units: 0,
      closing_balance_units: 30,
      previous_reading_date: '2026-10-29',
      reading_date: new Date().toISOString().slice(0, 10),
      notes: null,
      recorded_by: fixtureId,
      created_at: new Date().toISOString(),
    },
  } }))
  await page.route('**/api/electricity/topups', (route) => route.fulfill({ json: { topup: { id: 'topup-test' } } }))

  await page.getByRole('tab', { name: 'Record readings' }).tap()
  await page.getByLabel('Meter type').selectOption(submeterId)
  await page.getByLabel('Current reading (kWh)').fill('130')
  await setKeyboardHeight(page, 336)
  const readingSave = page.getByRole('button', { name: 'Save meter reading' })
  await readingSave.scrollIntoViewIfNeeded()
  await expectTouchable(readingSave, page)
  await readingSave.tap()
  await expect(page.getByRole('status').filter({ hasText: 'Reading saved.' })).toBeVisible()

  await page.getByRole('tab', { name: 'Record LUKU' }).tap()
  await page.getByLabel('Client submeter').selectOption(submeterId)
  await page.getByLabel('Units loaded (kWh)').fill('12')
  await page.getByLabel('Confirm units').fill('12')
  await page.getByLabel('Purchase value (TZS)').fill('12000')
  await page.getByLabel('20-digit LUKU token').fill('12345678901234567890')
  await page.getByLabel('Re-enter the 20-digit token').fill('12345678901234567890')
  await page.getByLabel('Note (optional)').last().fill('Mobile keyboard test')
  const topupSave = page.getByRole('button', { name: 'Record top-up' })
  await topupSave.scrollIntoViewIfNeeded()
  await expectTouchable(topupSave, page)
  await topupSave.tap()
  await expect(page.getByRole('status').filter({ hasText: 'Reported top-up saved.' })).toBeVisible()
})
