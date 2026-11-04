import { describe, expect, it } from 'vitest'
import { createElectricityFollowUpPdf, type FollowUpPdfLabels } from './follow-up-pdf'
import type { FollowUpItem } from './follow-up-report'

const labels: FollowUpPdfLabels = {
  title: 'Electricity follow-up', generated: 'Generated', clients: 'clients',
  unitsLeft: 'Units left', unitsOwed: 'Units owed', totalNegativeUnits: 'Current total to clear negative client balances',
  totalNegativeUnitsHelp: 'Estimates only; this is not a main meter top-up.', totalNegativeUnitsPartial: 'Partial total',
  actionLabel: 'Next step', lastReading: 'Last reading', unknown: 'Unknown', stale: 'Check reading',
  unconfirmed: 'Purchase unconfirmed', disclaimer: 'Check before contacting clients.',
  priority: { urgent: 'Urgent', low: 'Low', soon: 'Soon', review: 'Review' },
  action: { check: 'Check first', top_up: 'Ask to top up', remind_soon: 'Remind soon' },
}

describe('follow-up PDF', () => {
  it('keeps negative signs and shows a single total after a multi-page list', async () => {
    const items: FollowUpItem[] = Array.from({ length: 60 }, (_, index) => ({
      id: String(index), client: `Client ${index}`, location: 'Floor 3',
      balance: index < 2 ? -2.5 : 8, readingDate: '2026-11-02',
      priority: index < 2 ? 'urgent' : 'low', readingNeedsCheck: false, unconfirmedTopup: false,
    }))
    const { pdf } = await createElectricityFollowUpPdf('Dora Tower', items, '2026-11-04', labels)
    const output = pdf.output()
    expect(pdf.getNumberOfPages()).toBeGreaterThan(1)
    expect(output).toContain('(-2.5 kWh)')
    expect(output).toContain('(5 kWh)')
    expect(output.split('Current total to clear negative client balances')).toHaveLength(2)
    expect(output).toContain('/F2 16 Tf')
    expect(output).toContain('/F2 18 Tf')
    expect(output).toContain('0.725 0.11 0.11 rg')
  })
})
