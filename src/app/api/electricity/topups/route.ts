import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'
import { parseLukuToken } from '@/lib/electricity/luku-token'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to record a top-up.' }, { status: 401 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const purchaseDate = typeof body.purchaseDate === 'string' ? body.purchaseDate : ''
    const units = Number(body.units)
    const unitsConfirmation = Number(body.unitsConfirmation)
    const tokenCode = typeof body.tokenCode === 'string' ? parseLukuToken(body.tokenCode) : null
    const tokenCodeConfirmation = typeof body.tokenCodeConfirmation === 'string' ? parseLukuToken(body.tokenCodeConfirmation) : null
    const purchaseAmountTzs = Number(body.purchaseAmountTzs)
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!accountId || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !Number.isFinite(units) || units <= 0) {
      return NextResponse.json({ error: 'Enter a valid meter, purchase date, and positive number of units.' }, { status: 400 })
    }
    if (!Number.isFinite(unitsConfirmation) || Math.round(units * 1000) !== Math.round(unitsConfirmation * 1000)) {
      return NextResponse.json({ error: 'The confirmed unit amount must match the amount purchased.' }, { status: 400 })
    }
    if (!tokenCode || !tokenCodeConfirmation) {
      return NextResponse.json({ error: 'Enter both complete 20-digit LUKU token fields.' }, { status: 400 })
    }
    if (tokenCode !== tokenCodeConfirmation) {
      return NextResponse.json({ error: 'The two 20-digit LUKU token entries do not match.' }, { status: 400 })
    }
    if (!Number.isFinite(purchaseAmountTzs) || purchaseAmountTzs <= 0 || purchaseAmountTzs > 1_000_000_000) {
      return NextResponse.json({ error: 'Enter a purchase value greater than zero and no more than TZS 1,000,000,000.' }, { status: 400 })
    }
    if (notes.length > 500) return NextResponse.json({ error: 'Notes must be 500 characters or less.' }, { status: 400 })

    const { data, error } = await actor.client.rpc('record_electricity_topup_with_value', {
      p_account_id: accountId,
      p_purchase_date: purchaseDate,
      p_units: units,
      p_token_suffix: tokenCode.slice(-4),
      p_token_code: tokenCode,
      p_purchase_amount_tzs: purchaseAmountTzs,
      p_notes: notes || null,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ topup: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record the tenant top-up.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to verify this top-up.' }, { status: 401 })

    const body = await request.json()
    const topupId = typeof body.id === 'string' ? body.id : ''
    if (!topupId) return NextResponse.json({ error: 'Top-up record is required.' }, { status: 400 })

    const { data, error } = await actor.client.rpc('verify_electricity_topup', { p_topup_id: topupId })
    if (error) {
      const status = error.message.includes('already confirmed') || error.message.includes('Only an unverified') ? 409 : 400
      return NextResponse.json({ error: error.message }, { status })
    }
    return NextResponse.json({ topup: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not verify the top-up.' }, { status: 500 })
  }
}
