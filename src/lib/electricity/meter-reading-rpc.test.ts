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
      '202610300008_allow_historical_electricity_sessions.sql',
      '202610300009_electricity_staff_login_audit.sql',
      '202610300010_electricity_main_meter_balances.sql',
      '202610300012_electricity_topup_purchase_value.sql',
      '202610300013_store_complete_luku_tokens.sql',
      '202610300014_main_luku_balance_alerts_and_reconciliation.sql',
      '202610300015_electricity_submeter_handoffs.sql',
      '202610300016_electricity_corrections_and_issues.sql',
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
      "SELECT count(*)::INTEGER AS count FROM public.electricity_topups WHERE token_code IS NOT NULL",
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

  it('preserves a paper-imported first reading and balance when a later reading triggers recalculation', async () => {
    const imported = await db.query<{ id: string }>(
      'SELECT id FROM public.electricity_accounts WHERE property_id = $1 AND tenant_id = $2',
      [doraPropertyId, doraTenantId],
    )
    await db.query('SELECT public.record_electricity_meter_reading($1, 15427.4, $2, NULL)', [imported.rows[0].id, '2026-10-30'])
    const readings = await db.query<Record<string, unknown>>(
      'SELECT previous_meter_reading, previous_reading_date, usage_units, opening_balance_units, closing_balance_units FROM public.electricity_readings WHERE account_id = $1 ORDER BY reading_date',
      [imported.rows[0].id],
    )
    expect(readings.rows[0]).toMatchObject({
      previous_meter_reading: '15372.900', previous_reading_date: null,
      usage_units: '44.500', opening_balance_units: '21.100', closing_balance_units: '-23.400',
    })
    expect(readings.rows[1]).toMatchObject({
      previous_meter_reading: '15417.400', usage_units: '10.000',
      opening_balance_units: '-23.400', closing_balance_units: '-33.400',
    })
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

  it('does not record TANESCO main meters as rising cumulative readings', async () => {
    await expect(db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, $2, $3, $4)',
      [mainAccountId, 930, '2026-10-26', null],
    )).rejects.toThrow(/Shared main meters use decreasing TANESCO LUKU balance snapshots/)
  })

  it('records main-meter credit snapshots and the recharge added since the prior check', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    const latestDate = new Date(`${today}T00:00:00.000Z`)
    const earlierDate = new Date(latestDate)
    earlierDate.setUTCDate(earlierDate.getUTCDate() - 1)
    const dateAfterPurchase = latestDate.toISOString().slice(0, 10)
    const dateBeforePurchase = earlierDate.toISOString().slice(0, 10)

    await db.query('SELECT public.record_electricity_main_meter_balance($1, 36.23, $2, $3, 0)', [mainAccountId, dateBeforePurchase, 'Before purchase'])
    await db.query('SELECT public.record_electricity_main_meter_balance($1, 410.37, $2, $3, 500)', [mainAccountId, dateAfterPurchase, 'After purchase'])

    const balances = await db.query<{ reading_date: Date; units_remaining: string; units_purchased_since_previous: string; notes: string }>(
      'SELECT reading_date, units_remaining, units_purchased_since_previous, notes FROM public.electricity_main_meter_balances WHERE account_id = $1 ORDER BY reading_date',
      [mainAccountId],
    )
    expect(balances.rows).toMatchObject([
      { units_remaining: '36.230', units_purchased_since_previous: '0.000', notes: 'Before purchase' },
      { units_remaining: '410.370', units_purchased_since_previous: '500.000', notes: 'After purchase' },
    ])

    await db.exec('SAVEPOINT before_duplicate_main_balance;')
    await expect(db.query(
      'SELECT public.record_electricity_main_meter_balance($1, 20, $2, NULL)',
      [mainAccountId, dateAfterPurchase],
    )).rejects.toThrow(/duplicate key/)
    await db.exec('ROLLBACK TO SAVEPOINT before_duplicate_main_balance;')
  })

  it('records a verified zero balance and rejects out-of-order snapshots', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    await db.exec('SAVEPOINT before_unconfirmed_zero;')
    await expect(db.query(
      'SELECT public.record_electricity_main_meter_balance($1, 0, $2, $3, 0, false)',
      [mainAccountId, today, 'Unconfirmed empty meter'],
    )).rejects.toThrow(/Confirm that the main LUKU balance is truly zero/)
    await db.exec('ROLLBACK TO SAVEPOINT before_unconfirmed_zero;')
    await db.query('SELECT public.record_electricity_main_meter_balance($1, 0, $2, $3, 0, true)', [mainAccountId, today, 'Verified empty meter'])
    const zero = await db.query<{ units_remaining: string }>(
      'SELECT units_remaining FROM public.electricity_main_meter_balances WHERE account_id = $1 AND reading_date = $2',
      [mainAccountId, today],
    )
    expect(zero.rows[0].units_remaining).toBe('0.000')

    const yesterday = new Date(`${today}T00:00:00.000Z`)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    await expect(db.query(
      'SELECT public.record_electricity_main_meter_balance($1, 5, $2, NULL, 0)',
      [mainAccountId, yesterday.toISOString().slice(0, 10)],
    )).rejects.toThrow(/entered oldest to newest/)
  })

  it('reassigns a client submeter by archiving its old ledger and starting a new baseline atomically', async () => {
    const newTenantId = '40000000-0000-0000-0000-000000000002'
    await db.query('INSERT INTO public.tenants (id, user_id, full_name) VALUES ($1, $2, $3)', [newTenantId, ownerId, 'New Client'])
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    const priorDate = new Date(`${today}T00:00:00.000Z`)
    priorDate.setUTCDate(priorDate.getUTCDate() - 1)
    const lastReadingDate = priorDate.toISOString().slice(0, 10)

    await db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, 130, $2, NULL)',
      [accountId, lastReadingDate],
    )
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.replace_electricity_submeter($1, $2, 145, $3, 12.5, $4)',
      [accountId, newTenantId, today, 'New Client · Unit 1'],
    )
    const oldAccount = await db.query<Record<string, unknown>>(
      'SELECT active, tenant_id FROM public.electricity_accounts WHERE id = $1',
      [accountId],
    )
    const oldReadingCount = await db.query<{ count: number }>(
      'SELECT count(*)::INTEGER AS count FROM public.electricity_readings WHERE account_id = $1',
      [accountId],
    )
    const finalOldReading = await db.query<Record<string, unknown>>(
      'SELECT current_meter_reading, closing_balance_units, reading_date, notes FROM public.electricity_readings WHERE account_id = $1 ORDER BY reading_date DESC LIMIT 1',
      [accountId],
    )

    expect(result.rows[0]).toMatchObject({
      tenant_id: newTenantId,
      unit_id: unitId,
      initial_meter_reading: '145.000',
      opening_balance_units: '12.500',
      display_name: 'New Client · Unit 1',
      active: true,
    })
    expect(result.rows[0].id).not.toBe(accountId)
    expect(oldAccount.rows[0]).toMatchObject({ active: false, tenant_id: tenantId })
    expect(oldReadingCount.rows[0].count).toBe(2)
    expect(finalOldReading.rows[0]).toMatchObject({
      current_meter_reading: '145.000',
      closing_balance_units: '-25.000',
      reading_date: new Date(`${today}T00:00:00.000Z`),
      notes: 'Final reading at tenant handoff',
    })
  })

  it('leaves the old meter and ledger unchanged when a handoff is invalid', async () => {
    const foreignTenantId = '40000000-0000-0000-0000-000000000003'
    await db.query('INSERT INTO public.tenants (id, user_id, full_name) VALUES ($1, $2, $3)', [foreignTenantId, otherUserId, 'Other Owner Client'])
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())

    await db.exec('SAVEPOINT before_invalid_handoff;')
    await expect(db.query(
      'SELECT * FROM public.replace_electricity_submeter($1, $2, 110, $3, 0, NULL)',
      [accountId, foreignTenantId, today],
    )).rejects.toThrow(/does not belong to this owner/)
    await db.exec('ROLLBACK TO SAVEPOINT before_invalid_handoff;')
    const account = await db.query<{ active: boolean; tenant_id: string }>(
      'SELECT active, tenant_id FROM public.electricity_accounts WHERE id = $1',
      [accountId],
    )
    const readingCount = await db.query<{ count: number }>(
      'SELECT count(*)::INTEGER AS count FROM public.electricity_readings WHERE account_id = $1',
      [accountId],
    )
    expect(account.rows[0]).toEqual({ active: true, tenant_id: tenantId })
    expect(readingCount.rows[0].count).toBe(0)
  })

  it('does not allow staff to reassign the owner submeter account', async () => {
    const newTenantId = '40000000-0000-0000-0000-000000000002'
    await db.query('INSERT INTO public.tenants (id, user_id, full_name) VALUES ($1, $2, $3)', [newTenantId, ownerId, 'New Client'])
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffAuthId])
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())

    await expect(db.query(
      'SELECT * FROM public.replace_electricity_submeter($1, $2, 110, $3, 0, NULL)',
      [accountId, newTenantId, today],
    )).rejects.toThrow(/not found or access denied/)
  })

  it('rejects main-meter balance snapshots from users without property access', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [otherUserId])
    await expect(db.query(
      'SELECT public.record_electricity_main_meter_balance($1, 5, $2, NULL)',
      [mainAccountId, today],
    )).rejects.toThrow(/not found or access denied/)
  })

  it('saves the complete LUKU token, purchase value, and rejects duplicate token reuse', async () => {
    const purchaseDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    const tokenCode = '12345678901234567890'
    const result = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_topup_with_value($1, $2, 50, $3, $4, 6500, $5)',
      [accountId, purchaseDate, '7890', tokenCode, 'Client-reported LUKU purchase'],
    )
    expect(result.rows[0].token_suffix).toBe('7890')
    expect(result.rows[0].token_code).toBe(tokenCode)
    expect(Number(result.rows[0].purchase_amount_tzs)).toBe(6500)
    expect(result.rows[0].status).toBe('reported')

    await db.exec('SAVEPOINT before_duplicate_token;')
    await expect(db.query(
      'SELECT * FROM public.record_electricity_topup_with_value($1, $2, 5, $3, $4, 800, NULL)',
      [accountId, purchaseDate, '7890', tokenCode],
    )).rejects.toThrow(/duplicate key/)
    await db.exec('ROLLBACK TO SAVEPOINT before_duplicate_token;')

    await db.exec('SAVEPOINT before_invalid_topup_value;')
    await expect(db.query(
      'SELECT * FROM public.record_electricity_topup_with_value($1, $2, 5, $3, $4, 0, NULL)',
      [accountId, purchaseDate, '7890', '09876543210987657890'],
    )).rejects.toThrow(/purchase value greater than zero/)
    await db.exec('ROLLBACK TO SAVEPOINT before_invalid_topup_value;')
    const topupCount = await db.query<{ count: number }>(
      'SELECT count(*)::INTEGER AS count FROM public.electricity_topups WHERE account_id = $1',
      [accountId],
    )
    expect(topupCount.rows[0].count).toBe(1)
  })

  it('accepts out-of-order dated sessions and rebuilds later usage and balances', async () => {
    await db.query('SELECT public.record_electricity_meter_reading($1, 130, $2, $3)', [accountId, '2026-10-30', 'latest session'])
    await db.query('SELECT public.record_electricity_meter_reading($1, 120, $2, $3)', [accountId, '2026-10-29', 'second session'])
    const inserted = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.record_electricity_meter_reading($1, 110, $2, $3)',
      [accountId, '2026-10-27', 'missed midweek session'],
    )
    expect(inserted.rows[0]).toMatchObject({
      previous_meter_reading: '100.000',
      previous_reading_date: new Date('2026-10-25T00:00:00.000Z'),
      usage_units: '10.000',
      opening_balance_units: '20.000',
      closing_balance_units: '10.000',
    })

    const sessions = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.electricity_readings WHERE account_id = $1 ORDER BY reading_date',
      [accountId],
    )
    expect(sessions.rows[1]).toMatchObject({
      reading_date: new Date('2026-10-29T00:00:00.000Z'),
      previous_meter_reading: '110.000',
      previous_reading_date: new Date('2026-10-27T00:00:00.000Z'),
      usage_units: '10.000',
      opening_balance_units: '10.000',
      closing_balance_units: '0.000',
    })
    expect(sessions.rows[2]).toMatchObject({
      reading_date: new Date('2026-10-30T00:00:00.000Z'),
      previous_meter_reading: '120.000',
      previous_reading_date: new Date('2026-10-29T00:00:00.000Z'),
      usage_units: '10.000',
      opening_balance_units: '0.000',
      closing_balance_units: '-10.000',
    })

    await db.exec('SAVEPOINT before_duplicate_session_date;')
    await expect(db.query(
      'SELECT public.record_electricity_meter_reading($1, 115, $2, NULL)',
      [accountId, '2026-10-29'],
    )).rejects.toThrow(/already exists for this meter/)
    await db.exec('ROLLBACK TO SAVEPOINT before_duplicate_session_date;')
  })

  it('reassigns verified top-ups and owner corrections to the correct dated session', async () => {
    await db.query("SELECT public.record_electricity_topup($1, '2026-10-28', 12, NULL, TRUE, NULL)", [accountId])
    await db.query("SELECT public.adjust_electricity_balance($1, 5, '2026-10-28', 'Paper sheet correction')", [accountId])
    await db.query('SELECT public.record_electricity_meter_reading($1, 130, $2, NULL)', [accountId, '2026-10-30'])
    await db.query('SELECT public.record_electricity_meter_reading($1, 120, $2, NULL)', [accountId, '2026-10-29'])

    const entries = await db.query<Record<string, unknown>>(
      'SELECT * FROM public.electricity_readings WHERE account_id = $1 ORDER BY reading_date',
      [accountId],
    )
    expect(entries.rows[0]).toMatchObject({
      reading_date: new Date('2026-10-29T00:00:00.000Z'),
      topup_units: '12.000',
      adjustment_units: '5.000',
      closing_balance_units: '17.000',
    })
    expect(entries.rows[1]).toMatchObject({
      reading_date: new Date('2026-10-30T00:00:00.000Z'),
      previous_meter_reading: '120.000',
      topup_units: '0.000',
      adjustment_units: '0.000',
      closing_balance_units: '7.000',
    })
  })

  it('rejects an entered value that exceeds the next dated reading', async () => {
    await db.query('SELECT public.record_electricity_meter_reading($1, 120, $2, NULL)', [accountId, '2026-10-30'])
    await db.exec('SAVEPOINT before_out_of_order_meter_value;')
    await expect(db.query(
      'SELECT public.record_electricity_meter_reading($1, 130, $2, NULL)',
      [accountId, '2026-10-27'],
    )).rejects.toThrow(/cannot exceed the next saved reading/)
    await db.exec('ROLLBACK TO SAVEPOINT before_out_of_order_meter_value;')
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

  it('records successful staff sign-ins and maintains the latest login timestamp', async () => {
    await db.query(`
      INSERT INTO public.electricity_staff (owner_user_id, auth_user_id, staff_id, login_email, full_name, created_by)
      VALUES ($1, $2, 'DT-02', 'staff-login@test.invalid', 'Login Staff', $1)
    `, [ownerId, staffAuthId])
    const staff = await db.query<{ id: string; last_login_at: Date | null }>(
      'SELECT id, last_login_at FROM public.electricity_staff WHERE staff_id = $1',
      ['DT-02'],
    )
    await db.query(
      'INSERT INTO public.electricity_staff_login_events (staff_id, owner_user_id, logged_in_at) VALUES ($1, $2, $3)',
      [staff.rows[0].id, ownerId, '2026-10-30T08:00:00.000Z'],
    )
    await db.query(
      'INSERT INTO public.electricity_staff_login_events (staff_id, owner_user_id, logged_in_at) VALUES ($1, $2, $3)',
      [staff.rows[0].id, ownerId, '2026-10-30T09:00:00.000Z'],
    )

    const latest = await db.query<{ last_login_at: Date; event_count: number }>(`
      SELECT s.last_login_at, count(e.id)::INTEGER AS event_count
      FROM public.electricity_staff s
      JOIN public.electricity_staff_login_events e ON e.staff_id = s.id
      WHERE s.id = $1
      GROUP BY s.last_login_at
    `, [staff.rows[0].id])
    expect(latest.rows[0].last_login_at).toEqual(new Date('2026-10-30T09:00:00.000Z'))
    expect(latest.rows[0].event_count).toBe(2)
  })

  it('allows staff to correct entries, keeps corrections audited, and reserves reversal for owners', async () => {
    const reading = await db.query<{ id: string }>(
      'SELECT id FROM public.record_electricity_meter_reading($1, 115, $2, $3)',
      [accountId, '2026-10-26', 'Initial entry'],
    )
    await db.query(`
      INSERT INTO public.electricity_staff (owner_user_id, auth_user_id, staff_id, login_email, full_name, created_by)
      VALUES ($1, $2, 'DT-03', 'correction-staff@test.invalid', 'Correction Staff', $1)
    `, [ownerId, staffAuthId])
    const staff = await db.query<{ id: string }>('SELECT id FROM public.electricity_staff WHERE auth_user_id = $1', [staffAuthId])
    await db.query('SELECT public.set_electricity_staff_properties($1, ARRAY[$2::UUID])', [staff.rows[0].id, propertyId])
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffAuthId])

    await db.query(
      "SELECT public.manage_electricity_entry('reading', $1, 'edit', $2::JSONB, 'Correct a mistyped meter value')",
      [reading.rows[0].id, JSON.stringify({ current_meter_reading: 120, notes: 'Corrected after recheck' })],
    )
    const corrected = await db.query<{ current_meter_reading: string; usage_units: string; closing_balance_units: string }>(
      'SELECT current_meter_reading, usage_units, closing_balance_units FROM public.electricity_readings WHERE id = $1',
      [reading.rows[0].id],
    )
    expect(corrected.rows[0]).toEqual({ current_meter_reading: '120.000', usage_units: '20.000', closing_balance_units: '0.000' })

    await db.exec('SAVEPOINT before_staff_reversal;')
    await expect(db.query(
      "SELECT public.manage_electricity_entry('reading', $1, 'reverse', '{}'::JSONB, 'Incorrect record')",
      [reading.rows[0].id],
    )).rejects.toThrow(/Only the property owner/)
    await db.exec('ROLLBACK TO SAVEPOINT before_staff_reversal;')

    const audit = await db.query<{ action: string; reason: string; acted_by: string; previous_values: Record<string, unknown>; new_values: Record<string, unknown> }>(
      'SELECT action, reason, acted_by, previous_values, new_values FROM public.electricity_entry_audit WHERE entry_id = $1',
      [reading.rows[0].id],
    )
    expect(audit.rows[0]).toMatchObject({ action: 'edited', reason: 'Correct a mistyped meter value', acted_by: staffAuthId })
    expect(Number(audit.rows[0].previous_values.current_meter_reading)).toBe(115)
    expect(Number(audit.rows[0].new_values.current_meter_reading)).toBe(120)

    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [ownerId])
    await db.query(
      "SELECT public.manage_electricity_entry('reading', $1, 'reverse', '{}'::JSONB, 'Duplicate entry was entered')",
      [reading.rows[0].id],
    )
    const reversed = await db.query<{ reversed_at: Date; reversed_by: string; reversal_reason: string }>(
      'SELECT reversed_at, reversed_by, reversal_reason FROM public.electricity_readings WHERE id = $1',
      [reading.rows[0].id],
    )
    expect(reversed.rows[0]).toMatchObject({ reversed_by: ownerId, reversal_reason: 'Duplicate entry was entered' })
    expect(reversed.rows[0].reversed_at).toBeInstanceOf(Date)

    const replacement = await db.query(
      'SELECT * FROM public.record_electricity_meter_reading($1, 110, $2, $3)',
      [accountId, '2026-10-26', 'Replacement after reversal'],
    )
    expect(replacement.rows).toHaveLength(1)
  })

  it('records confirmation identity and time without copying the full token into the audit trail', async () => {
    const purchaseDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
    const tokenCode = '12345678901234567890'
    const topup = await db.query<{ id: string }>(
      'SELECT id FROM public.record_electricity_topup_with_value($1, $2, 20, $3, $4, 2400, $5)',
      [accountId, purchaseDate, '7890', tokenCode, 'Confirmation audit test'],
    )
    await db.query('SELECT public.verify_electricity_topup($1)', [topup.rows[0].id])

    const confirmation = await db.query<{ verified_by: string; verified_at: Date; action: string; previous_values: Record<string, unknown>; new_values: Record<string, unknown>; acted_by: string }>(`
      SELECT t.verified_by, t.verified_at, a.action, a.previous_values, a.new_values, a.acted_by
      FROM public.electricity_topups t
      JOIN public.electricity_entry_audit a ON a.entry_id = t.id AND a.action = 'confirmed'
      WHERE t.id = $1
    `, [topup.rows[0].id])
    expect(confirmation.rows[0]).toMatchObject({ verified_by: ownerId, action: 'confirmed', acted_by: ownerId })
    expect(confirmation.rows[0].verified_at).toBeInstanceOf(Date)
    expect(confirmation.rows[0].previous_values).not.toHaveProperty('token_code')
    expect(confirmation.rows[0].new_values).not.toHaveProperty('token_code')

    await db.query(
      "SELECT public.manage_electricity_entry('topup', $1, 'edit', $2::JSONB, 'Correct units from receipt')",
      [topup.rows[0].id, JSON.stringify({ units: 21 })],
    )
    const correctedTopup = await db.query<{ status: string; verified_at: Date | null; verified_by: string | null }>(
      'SELECT status, verified_at, verified_by FROM public.electricity_topups WHERE id = $1',
      [topup.rows[0].id],
    )
    expect(correctedTopup.rows[0]).toEqual({ status: 'reported', verified_at: null, verified_by: null })
  })

  it('keeps issue comments and status changes in a resolution and reopen history', async () => {
    const ticket = await db.query<{ id: string }>(`
      INSERT INTO public.electricity_issue_tickets (
        owner_user_id, property_id, account_id, title, description, opened_by, updated_by
      ) VALUES ($1, $2, $3, 'Unexpected balance drop', 'Main balance changed unexpectedly', $1, $1)
      RETURNING id
    `, [ownerId, propertyId, mainAccountId])
    await db.query(`
      INSERT INTO public.electricity_issue_comments (ticket_id, owner_user_id, body, created_by)
      VALUES ($1, $2, 'I rechecked the display and it is still low.', $2)
    `, [ticket.rows[0].id, ownerId])
    await db.query("UPDATE public.electricity_issue_tickets SET status = 'in_progress', updated_by = $2 WHERE id = $1", [ticket.rows[0].id, ownerId])
    await db.query(`
      UPDATE public.electricity_issue_tickets
      SET status = 'resolved', resolution = 'Found and corrected a missed recharge entry.', updated_by = $2
      WHERE id = $1
    `, [ticket.rows[0].id, ownerId])
    await db.query("UPDATE public.electricity_issue_tickets SET status = 'closed', updated_by = $2 WHERE id = $1", [ticket.rows[0].id, ownerId])
    await db.query("UPDATE public.electricity_issue_tickets SET status = 'in_progress', updated_by = $2 WHERE id = $1", [ticket.rows[0].id, ownerId])

    const history = await db.query<{ action: string; previous_status: string | null; new_status: string | null; performed_by: string }>(
      'SELECT action, previous_status, new_status, performed_by FROM public.electricity_issue_events WHERE ticket_id = $1 ORDER BY performed_at, id',
      [ticket.rows[0].id],
    )
    const comments = await db.query<{ body: string }>('SELECT body FROM public.electricity_issue_comments WHERE ticket_id = $1', [ticket.rows[0].id])
    expect(history.rows.map((event) => event.action).sort()).toEqual(['opened', 'reopened', 'resolved', 'status_changed', 'status_changed'])
    expect(history.rows.every((event) => event.performed_by === ownerId)).toBe(true)
    expect(comments.rows[0].body).toBe('I rechecked the display and it is still low.')
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
