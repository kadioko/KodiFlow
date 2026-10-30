import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to record a main-meter balance.' }, { status: 401 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const readingDate = typeof body.readingDate === 'string' ? body.readingDate : ''
    const unitsRemaining = Number(body.unitsRemaining)
    const zeroConfirmed = body.zeroConfirmed === true
    const hasPurchasedUnits = typeof body.unitsPurchasedSincePrevious === 'number'
      || (typeof body.unitsPurchasedSincePrevious === 'string' && body.unitsPurchasedSincePrevious.trim() !== '')
    const unitsPurchasedSincePrevious = hasPurchasedUnits ? Number(body.unitsPurchasedSincePrevious) : Number.NaN
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!accountId || !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)
      || !Number.isFinite(unitsRemaining) || unitsRemaining < 0 || unitsRemaining > 1_000_000
      || !Number.isFinite(unitsPurchasedSincePrevious) || unitsPurchasedSincePrevious < 0 || unitsPurchasedSincePrevious > 1_000_000) {
      return NextResponse.json({ error: 'Enter a main meter, valid date, remaining balance, and units added since the previous check.' }, { status: 400 })
    }
    if (unitsRemaining === 0 && !zeroConfirmed) {
      return NextResponse.json({ error: 'Confirm that the main LUKU balance is truly zero before recording an outage.' }, { status: 400 })
    }
    if (notes.length > 500) return NextResponse.json({ error: 'Notes must be 500 characters or less.' }, { status: 400 })

    const { data, error } = await actor.client.rpc('record_electricity_main_meter_balance', {
      p_account_id: accountId,
      p_units_remaining: unitsRemaining,
      p_reading_date: readingDate,
      p_notes: notes || null,
      p_units_purchased_since_previous: unitsPurchasedSincePrevious,
      p_zero_confirmed: zeroConfirmed,
    })

    if (error) {
      const status = error.message.includes('duplicate key') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ balance: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not record the main-meter balance.' },
      { status: 500 },
    )
  }
}
