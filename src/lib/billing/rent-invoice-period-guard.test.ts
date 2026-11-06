import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const shortLeaseId = '10000000-0000-0000-0000-000000000001'
const fullLeaseId = '10000000-0000-0000-0000-000000000002'

describe('rent invoice period guard', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE TABLE public.leases (
        id UUID PRIMARY KEY,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        billing_frequency TEXT NOT NULL
      );
      CREATE TABLE public.rent_invoices (
        id UUID PRIMARY KEY,
        lease_id UUID NOT NULL REFERENCES public.leases(id),
        billing_period_start DATE NOT NULL,
        billing_period_end DATE NOT NULL
      );
    `)
    await db.exec(readFileSync(resolve('supabase/migrations/202611060001_reject_short_final_rent_cycles.sql'), 'utf8'))
  })

  beforeEach(async () => {
    await db.exec('BEGIN')
    await db.query(
      'INSERT INTO public.leases (id, start_date, end_date, billing_frequency) VALUES ($1, $2, $3, $4), ($5, $6, $7, $8)',
      [shortLeaseId, '2026-05-15', '2026-11-15', 'semi_annually', fullLeaseId, '2026-05-15', '2027-05-14', 'semi_annually'],
    )
  })

  afterEach(async () => { await db.exec('ROLLBACK') })
  afterAll(async () => { await db.close() })

  it('rejects the Arm City one-day final period instead of charging a full six months', async () => {
    await expect(db.query(
      'INSERT INTO public.rent_invoices (id, lease_id, billing_period_start, billing_period_end) VALUES ($1, $2, $3, $4)',
      ['20000000-0000-0000-0000-000000000001', shortLeaseId, '2026-11-15', '2026-11-15'],
    )).rejects.toThrow(/Lease ends before the full 6 month billing cycle ends/)
  })

  it('accepts a complete cycle that fits the lease, including advance billing', async () => {
    await db.query(
      'INSERT INTO public.rent_invoices (id, lease_id, billing_period_start, billing_period_end) VALUES ($1, $2, $3, $4)',
      ['20000000-0000-0000-0000-000000000002', fullLeaseId, '2026-11-15', '2027-05-14'],
    )

    const invoices = await db.query<{ count: number }>('SELECT count(*)::INTEGER AS count FROM public.rent_invoices')
    expect(invoices.rows[0].count).toBe(1)
  })

  it('rejects a shortened invoice period even when the lease has enough time', async () => {
    await expect(db.query(
      'INSERT INTO public.rent_invoices (id, lease_id, billing_period_start, billing_period_end) VALUES ($1, $2, $3, $4)',
      ['20000000-0000-0000-0000-000000000003', fullLeaseId, '2026-11-15', '2026-11-30'],
    )).rejects.toThrow(/Invoice period must cover the complete 6 month billing cycle/)
  })
})
