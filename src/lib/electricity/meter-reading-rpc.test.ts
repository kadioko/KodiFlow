import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const ownerId = '10000000-0000-0000-0000-000000000001'
const staffAuthId = '10000000-0000-0000-0000-000000000002'
const otherUserId = '10000000-0000-0000-0000-000000000003'
const propertyId = '20000000-0000-0000-0000-000000000001'
const secondPropertyId = '20000000-0000-0000-0000-000000000002'
const otherPropertyId = '20000000-0000-0000-0000-000000000003'
const unitId = '30000000-0000-0000-0000-000000000001'
const tenantId = '40000000-0000-0000-0000-000000000001'
const accountId = '50000000-0000-0000-0000-000000000001'
const mainAccountId = '50000000-0000-0000-0000-000000000002'
const doraPropertyId = '85246880-a4ba-4e4b-8118-208b68ed28d4'
const doraSectionId = '60000000-0000-0000-0000-000000000001'
const doraUnitId = '60000000-0000-0000-0000-000000000002'
const doraTenantId = '60000000-0000-0000-0000-000000000003'

function splitSqlStatements(sql: string) {
  const statements: string[] = []
  let start = 0
  let dollarTag = ''
  let inString = false
  for (let index = 0; index < sql.length; index += 1) {
    const character = sql[index]
    if (!inString && character === '$') {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)?.[0]
      if (tag) {
        if (!dollarTag) dollarTag = tag
        else if (dollarTag === tag) dollarTag = ''
        index += tag.length - 1
        continue
      }
    }
    if (!dollarTag && character === "'") {
      if (inString && sql[index + 1] === "'") {
        index += 1
        continue
      }
      inString = !inString
      continue
    }
    if (!dollarTag && !inString && character === ';') {
      const statement = sql.slice(start, index + 1).trim()
      if (statement) statements.push(statement)
      start = index + 1
    }
  }
  const finalStatement = sql.slice(start).trim()
  if (finalStatement) statements.push(finalStatement)
  return statements
}

describe('electricity meter reading transaction', () => {
  let db: PGlite

  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE ROLE anon;
      CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users (id UUID PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS UUID
      LANGUAGE SQL STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::UUID $$;

      CREATE TABLE public.properties (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id), name TEXT);
      CREATE TABLE public.property_sections (id UUID PRIMARY KEY, property_id UUID NOT NULL REFERENCES public.properties(id), name TEXT);
      CREATE TABLE public.units (id UUID PRIMARY KEY, property_id UUID NOT NULL REFERENCES public.properties(id), user_id UUID NOT NULL REFERENCES auth.users(id), unit_identifier TEXT, section_id UUID);
      CREATE TABLE public.tenants (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES auth.users(id), business_name TEXT, full_name TEXT);
    `)
    await db.query('INSERT INTO auth.users (id) VALUES ($1)', [ownerId])
    await db.query('INSERT INTO public.properties (id, user_id, name) VALUES ($1, $2, $3)', [doraPropertyId, ownerId, 'Dora Tower'])
    await db.query('INSERT INTO public.property_sections (id, property_id, name) VALUES ($1, $2, $3)', [doraSectionId, doraPropertyId, 'Basement'])
    await db.query('INSERT INTO public.units (id, property_id, user_id, unit_identifier, section_id) VALUES ($1, $2, $3, $4, $5)', [doraUnitId, doraPropertyId, ownerId, 'B1', doraSectionId])
    await db.query('INSERT INTO public.tenants (id, user_id, business_name) VALUES ($1, $2, $3)', [doraTenantId, ownerId, 'Seba'])
    for (const migrationFile of [
      '202610300001_electricity_meter_tracking.sql',
      '202610300002_electricity_staff_property_scope.sql',
      '202610300003_electricity_reading_periods.sql',
      '202610300004_dora_tower_electricity_ledger_seed.sql',
      '202610300005_dora_tower_main_meter_numbers.sql',
      '202610300006_electricity_staff_language_preference.sql',
      '202610300007_electricity_balance_adjustments_and_ledger.sql',
    ]) {
      const migration = readFileSync(resolve('supabase/migrations', migrationFile), 'utf8')
      for (const [index, statement] of splitSqlStatements(migration).entries()) {
        try {
          await db.exec(statement)
        } catch (error) {
          const preview = statement.replace(/\s+/g, ' ').slice(0, 180)
          throw new Error(`${migrationFile} statement ${index + 1} failed (${preview}): ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }
  }, 20_000)

  beforeEach(async () => {
    await db.exec('BEGIN;')
    await db.query('INSERT INTO auth.users (id) VALUES ($1), ($2), ($3) ON CONFLICT (id) DO NOTHING', [ownerId, staffAuthId, otherUserId])
    await db.query('INSERT INTO public.properties (id, user_id) VALUES ($1, $2), ($3, $2), ($4, $5) ON CONFLICT (id) DO NOTHING', [propertyId, ownerId, secondPropertyId, otherPropertyId, otherUserId])
    await db.query('INSERT INTO public.units (id, property_id, user_id) VALUES ($1, $2, $3)', [unitId, propertyId, ownerId])
    await db.query('INSERT INTO public.tenants (id, user_id) VALUES ($1, $2)', [tenantId, ownerId])
    await db.query(`
      INSERT INTO public.electricity_accounts (
        id, owner_user_id, property_id, meter_kind, unit_id, tenant_id,
        floor_label, initial_meter_reading, initial_reading_date, opening_balance_units, low_units_threshold, created_by
      ) VALUES ($1, $2, $3, 'submeter', $4, $5, 'FL1', 100, '2026-10-25', 20, 10, $2)
    `, [accountId, ownerId, propertyId, unitId, tenantId])
    await db.query(`
      INSERT INTO public.electricity_accounts (
        id, owner_user_id, property_id, meter_kind, floor_label, initial_meter_reading, initial_reading_date, created_by
      ) VALUES ($1, $2, $3, 'floor_main', 'FL1', 900, '2026-10-25', $2)
    `, [mainAccountId, ownerId, propertyId])
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownerId])
  })

  afterEach(async () => { await db.exec('ROLLBACK;') })
  afterAll(async () => { await db.close() })

  it('imports the legible Dora Tower baseline and avoids storing the photographed token', async () => {
    const mainMeters = await db.query<{ count: number }>(
      "SELECT count(*)::INTEGER AS count FROM public.electricity_accounts WHERE property_id = $1 AND meter_kind = 'floor_main'",
      [doraPropertyId],
    )
    const imported = await db.query<Record<string, unknown>>(`
      SELECT a.floor_label, a.initial_meter_reading, a.initial_reading_date,
        r.previous_meter_reading, r.current_meter_reading, r.previous_reading_date,
        r.usage_units, r.closing_balance_units, r.notes
      FROM public.electricity_accounts a
      JOIN public.electricity_readings r ON r.account_id = a.id
      WHERE a.property_id = $1 AND a.tenant_id = $2
    `, [doraPropertyId, doraTenantId])
    const tokenStorage = await db.query<{ count: number }>(
      "SELECT count(*)::INTEGER AS count FROM public.electricity_topups WHERE token_suffix IS NOT NULL",
    )

    expect(mainMeters.rows[0].count).toBe(8)
    expect(imported.rows[0]).toMatchObject({
      floor_label: 'Basement',
      initial_meter_reading: '15417.400',
      initial_reading_date: new Date('2026-10-29T00:00:00.000Z'),
      previous_meter_reading: '15372.900',
      current_meter_reading: '15417.400',
      previous_reading_date: null,
      usage_units: '44.500',
      closing_balance_units: '-23.400',
    })
    expect(String(imported.rows[0].notes)).toContain('prior reading date was not present')
    expect(tokenStorage.rows[0].count).toBe(0)
  })

  it('atomically adds verified top-ups, subtracts measured usage, and carries the balance forward', async () => {
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-25', 30, NULL, TRUE, NULL)", [accountId])
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-25', 40, NULL, FALSE, NULL)", [accountId])

    const first = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 125, '2026-10-26', 'first check'],
    )
    expect(first.rows[0]).toMatchObject({
      previous_meter_reading: '100.000',
      current_meter_reading: '125.000',
      usage_units: '25.000',
      previous_reading_date: new Date('2026-10-25T00:00:00.000Z'),
      opening_balance_units: '20.000',
      topup_units: '30.000',
      closing_balance_units: '25.000',
    })

    await db.query(`
      INSERT INTO public.electricity_topups (account_id, owner_user_id, purchase_date, units, status, verified_at, verified_by, recorded_by)
      VALUES ($1, $2, '2026-10-27', 10, 'verified', now(), $2, $2)
    `, [accountId, ownerId])
    const second = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 130, '2026-10-28', null],
    )
    expect(second.rows[0]).toMatchObject({
      previous_meter_reading: '125.000',
      usage_units: '5.000',
      previous_reading_date: new Date('2026-10-26T00:00:00.000Z'),
      opening_balance_units: '25.000',
      topup_units: '10.000',
      closing_balance_units: '30.000',
    })

    const topups = await db.query<{ status: string; applied_reading_id: string | null }>('SELECT status, applied_reading_id FROM public.electricity_topups WHERE account_id = $1 ORDER BY units', [accountId])
    expect(topups.rows.filter((row) => row.status === 'verified').every((row) => Boolean(row.applied_reading_id))).toBe(true)
    expect(topups.rows.find((row) => row.status === 'reported')?.applied_reading_id).toBeNull()
  })

  it('leaves unverified tenant-reported top-ups out of the estimate', async () => {
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-25', 100, NULL, FALSE, NULL)", [accountId])
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 115, '2026-10-26', null],
    )
    expect(result.rows[0]).toMatchObject({ topup_units: '0.000', closing_balance_units: '5.000' })
  })

  it('applies owner balance corrections exactly once to the next reading and carries them forward', async () => {
    await db.query(
      "SELECT public.adjust_electricity_balance($1, 5, '2026-10-25', 'Paper sheet correction')",
      [accountId],
    )
    const first = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 115, '2026-10-26', null],
    )
    expect(first.rows[0]).toMatchObject({ adjustment_units: '5.000', closing_balance_units: '10.000' })

    await db.query(
      "SELECT public.adjust_electricity_balance($1, -2, '2026-10-26', 'Correct a duplicated entry')",
      [accountId],
    )
    const next = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 118, '2026-10-27', null],
    )
    expect(next.rows[0]).toMatchObject({ opening_balance_units: '10.000', adjustment_units: '-2.000', closing_balance_units: '5.000' })

    const adjustments = await db.query<{ count: number }>(
      'SELECT count(*)::INTEGER AS count FROM public.electricity_balance_adjustments WHERE account_id = $1 AND applied_reading_id IS NULL',
      [accountId],
    )
    expect(adjustments.rows[0].count).toBe(0)
  })

  it('rejects balance corrections from non-owners and adjustments predating the last reading', async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUserId])
    await db.exec('SAVEPOINT before_non_owner_adjustment;')
    await expect(db.query(
      "SELECT public.adjust_electricity_balance($1, 3, '2026-10-25', 'Wrong account')",
      [accountId],
    )).rejects.toThrow(/Only the property owner/)
    await db.exec('ROLLBACK TO SAVEPOINT before_non_owner_adjustment;')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownerId])

    await db.query('SELECT public.record_electricity_meter_reading($1, 110, $2, NULL)', [accountId, '2026-10-26'])
    await db.exec('SAVEPOINT before_backdated_adjustment;')
    await expect(db.query(
      "SELECT public.adjust_electricity_balance($1, 3, '2026-10-25', 'Backdated correction')",
      [accountId],
    )).rejects.toThrow(/cannot be earlier than the last meter reading/)
    await db.exec('ROLLBACK TO SAVEPOINT before_backdated_adjustment;')
  })

  it('reconciles a top-up verified after its purchase-period reading and carries the corrected balance forward', async () => {
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-25', 12, NULL, FALSE, NULL)", [accountId])
    const first = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 115, '2026-10-26', null],
    )
    expect(first.rows[0]).toMatchObject({ topup_units: '0.000', closing_balance_units: '5.000' })

    const topup = await db.query<{ id: string }>('SELECT id FROM public.electricity_topups WHERE account_id = $1', [accountId])
    await db.query('SELECT public.verify_electricity_topup($1)', [topup.rows[0].id])
    const corrected = await db.query<Record<string, unknown>>('SELECT * FROM public.electricity_readings WHERE id = $1', [first.rows[0].id])
    expect(corrected.rows[0]).toMatchObject({ topup_units: '12.000', closing_balance_units: '17.000' })

    const next = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 130, '2026-10-27', null],
    )
    expect(next.rows[0]).toMatchObject({ opening_balance_units: '17.000', usage_units: '15.000', closing_balance_units: '2.000' })
  })

  it('records floor main usage without a tenant balance', async () => {
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [mainAccountId, 930, '2026-10-26', null],
    )
    expect(result.rows[0]).toMatchObject({ previous_meter_reading: '900.000', previous_reading_date: new Date('2026-10-25T00:00:00.000Z'), usage_units: '30.000' })
    expect(result.rows[0].closing_balance_units).toBeNull()
    expect(result.rows[0].opening_balance_units).toBeNull()
  })

  it('rejects a meter value below the last reading without consuming the pending top-up', async () => {
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-25', 12, NULL, TRUE, NULL)", [accountId])
    await db.exec('SAVEPOINT before_bad_reading;')
    await expect(db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 99, '2026-10-26', null],
    )).rejects.toThrow(/below the previous reading/)
    await db.exec('ROLLBACK TO SAVEPOINT before_bad_reading;')
    const topup = await db.query<{ applied_reading_id: string | null }>('SELECT applied_reading_id FROM public.electricity_topups WHERE account_id = $1', [accountId])
    expect(topup.rows[0].applied_reading_id).toBeNull()
  })

  it('rejects future readings and top-up purchase dates', async () => {
    await db.exec('SAVEPOINT before_future_reading;')
    await expect(db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 110, '2099-01-01', null],
    )).rejects.toThrow(/today or earlier/)
    await db.exec('ROLLBACK TO SAVEPOINT before_future_reading;')

    await db.exec('SAVEPOINT before_future_topup;')
    await expect(db.query(
      "SELECT public.record_electricity_topup($1, '2099-01-01', 10, NULL, FALSE, NULL)",
      [accountId],
    )).rejects.toThrow(/today or earlier/)
    await db.exec('ROLLBACK TO SAVEPOINT before_future_topup;')
  })

  it('rejects readings from users without property access', async () => {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUserId])
    await expect(db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 110, '2026-10-26', null],
    )).rejects.toThrow(/not found or access denied/)
  })

  it('allows an active staff account to record only an assigned property meter', async () => {
    await db.query(`
      INSERT INTO public.electricity_staff (owner_user_id, auth_user_id, staff_id, login_email, full_name, created_by)
      VALUES ($1, $2, 'DT-01', 'staff@test.invalid', 'Meter Staff', $1)
    `, [ownerId, staffAuthId])
    const staff = await db.query<{ id: string }>('SELECT id FROM public.electricity_staff WHERE auth_user_id = $1', [staffAuthId])
    await db.query('SELECT public.set_electricity_staff_properties($1, ARRAY[$2::UUID, $3::UUID])', [staff.rows[0].id, propertyId, secondPropertyId])
    await db.exec('SAVEPOINT before_cross_owner_assignment;')
    await expect(db.query('SELECT public.set_electricity_staff_properties($1, ARRAY[$2::UUID])', [staff.rows[0].id, otherPropertyId]))
      .rejects.toThrow(/Every assigned property must belong to you/)
    await db.exec('ROLLBACK TO SAVEPOINT before_cross_owner_assignment;')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffAuthId])
    const firstAccess = await db.query<{ allowed: boolean }>('SELECT public.can_access_electricity_property($1) AS allowed', [propertyId])
    const secondAccess = await db.query<{ allowed: boolean }>('SELECT public.can_access_electricity_property($1) AS allowed', [secondPropertyId])
    const otherOwnerAccess = await db.query<{ allowed: boolean }>('SELECT public.can_access_electricity_property($1) AS allowed', [otherPropertyId])
    expect(firstAccess.rows[0].allowed).toBe(true)
    expect(secondAccess.rows[0].allowed).toBe(true)
    expect(otherOwnerAccess.rows[0].allowed).toBe(false)
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 115, '2026-10-26', null],
    )
    expect(result.rows[0]).toMatchObject({ usage_units: '15.000', closing_balance_units: '5.000', recorded_by: staffAuthId })

    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownerId])
    await db.query('SELECT public.set_electricity_staff_properties($1, ARRAY[$2::UUID])', [staff.rows[0].id, secondPropertyId])
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffAuthId])
    const revokedAccess = await db.query<{ allowed: boolean }>('SELECT public.can_access_electricity_property($1) AS allowed', [propertyId])
    const newAccess = await db.query<{ allowed: boolean }>('SELECT public.can_access_electricity_property($1) AS allowed', [secondPropertyId])
    expect(revokedAccess.rows[0].allowed).toBe(false)
    expect(newAccess.rows[0].allowed).toBe(true)
    await expect(db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [accountId, 120, '2026-10-27', null],
    )).rejects.toThrow(/not found or access denied/)
  })

  it('does not grant authenticated clients direct writes that bypass the atomic workflow', async () => {
    const privileges = await db.query<{ authenticated_insert: boolean; authenticated_update: boolean; service_write: boolean }>(`
      SELECT
        has_table_privilege('authenticated', 'public.electricity_readings', 'INSERT') AS authenticated_insert,
        has_table_privilege('authenticated', 'public.electricity_readings', 'UPDATE') AS authenticated_update,
        has_table_privilege('service_role', 'public.electricity_readings', 'INSERT') AS service_write
    `)
    expect(privileges.rows[0]).toEqual({ authenticated_insert: false, authenticated_update: false, service_write: true })
  })

  it('rejects an electricity account paired with another owner’s property', async () => {
    await db.exec('SAVEPOINT before_cross_owner_meter;')
    await expect(db.query(`
      INSERT INTO public.electricity_accounts (
        owner_user_id, property_id, meter_kind, floor_label, initial_meter_reading, created_by
      ) VALUES ($1, $2, 'floor_main', 'FL-X', 0, $1)
    `, [ownerId, otherPropertyId])).rejects.toThrow(/electricity_accounts_property_owner_fkey/)
    await db.exec('ROLLBACK TO SAVEPOINT before_cross_owner_meter;')
  })
})
