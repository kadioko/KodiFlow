import { expect, test } from '@playwright/test'
import { expectTouchable, mockMobileData, setKeyboardHeight } from './helpers/mobile-fixtures'

test.beforeEach(async ({ page }) => { await mockMobileData(page) })

for (const viewport of [
  { width: 320, height: 568 },
  { width: 402, height: 874 },
  { width: 874, height: 402 },
  { width: 820, height: 1180 },
]) {
  test(`form actions and navigation at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    await page.goto('/properties/new')
    const submit = page.getByRole('button', { name: 'Create Property', exact: true })
    await expectTouchable(submit, page)
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeHidden()
    await page.getByLabel('Description').fill('Check the final field above the save area')
    await page.getByLabel('Description').scrollIntoViewIfNeeded()
    await expectTouchable(submit, page)
    await setKeyboardHeight(page, Math.min(330, viewport.height / 2))
    await expectTouchable(submit, page)
    await setKeyboardHeight(page, 0)
    await expectTouchable(submit, page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width)
    await page.screenshot({ path: testInfo.outputPath('save-action.png') })

    await page.goto('/documents')
    await page.getByRole('button', { name: 'Open quick actions' }).tap()
    const dialog = page.getByRole('dialog', { name: 'Quick actions', exact: true })
    await dialog.getByRole('button', { name: 'All sections', exact: true }).click({ trial: true })
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
    await dialog.getByRole('button', { name: 'Search', exact: true }).tap()
    const search = page.getByRole('dialog', { name: 'Search KodiFlow', exact: true })
    await search.getByRole('searchbox').fill('Twilight')
    await search.getByRole('button', { name: 'Search KodiFlow', exact: true }).click({ trial: true })
    await search.getByRole('button', { name: 'Close search' }).tap()
    await expect(search).toBeHidden()
  })
}
