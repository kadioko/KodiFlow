import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const userId = '00000000-0000-0000-0000-000000000001'
const unitId = '00000000-0000-0000-0000-000000000002'
const expiredLeaseId = '00000000-0000-0000-0000-000000000003'
const activeLeaseId = '00000000-0000-0000-0000-000000000004'

describe('lease changes and unit occupancy trigger', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE TABLE public.units (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        status text NOT NULL,
        updated_at timestamptz DEFAULT now()
      );
      CREATE TABLE public.leases (
        id uuid PRIMARY KEY,
        user_id uuid NOT NULL,
        unit_id uuid NOT NULL,
        status text NOT NULL
      );
    `)
    const migration = readFileSync(
      resolve('supabase/migrations/202610100001_expired_lease_keeps_unit_occupied.sql'),
      'utf8',
    )
    await db.exec(migration)
  }, 20_000)

  beforeEach(async () => {
    await db.exec('BEGIN;')
    await db.query('INSERT INTO public.units (id, user_id, status) VALUES ($1, $2, $3)', [unitId, userId, 'vacant'])
  })

  afterEach(async () => { await db.exec('ROLLBACK;') })
  afterAll(async () => { await db.close() })

  it('keeps the unit occupied when an active lease expires', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['expired', activeLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'occupied' }])
  })

  it('keeps the unit occupied across renewal and marks it occupied for the new active lease', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [expiredLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['renewed', expiredLeaseId])
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'occupied' }])
  })

  it('does not vacate a unit while another expired lease is waiting', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [expiredLeaseId, userId, unitId, 'expired'])
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['terminated', activeLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'occupied' }])
  })

  it('does not vacate a unit while another active lease remains', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [expiredLeaseId, userId, unitId, 'active'])
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['terminated', activeLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'occupied' }])
  })

  it('vacates an occupied unit after termination when no other active or expired lease remains', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['terminated', activeLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'vacant' }])
  })

  it('records an expired tenant move-out by terminating the lease and vacating the unit', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [expiredLeaseId, userId, unitId, 'expired'])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['terminated', expiredLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'vacant' }])
  })

  it('preserves maintenance status when a lease is terminated', async () => {
    await db.query('INSERT INTO public.leases (id, user_id, unit_id, status) VALUES ($1, $2, $3, $4)', [activeLeaseId, userId, unitId, 'active'])
    await db.query('UPDATE public.units SET status = $1 WHERE id = $2', ['under_maintenance', unitId])
    await db.query('UPDATE public.leases SET status = $1 WHERE id = $2', ['terminated', activeLeaseId])

    const result = await db.query('SELECT status FROM public.units WHERE id = $1', [unitId])
    expect(result.rows).toEqual([{ status: 'under_maintenance' }])
  })
})
