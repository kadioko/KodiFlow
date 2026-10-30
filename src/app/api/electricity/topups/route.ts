import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to record a top-up.' }, { status: 401 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const purchaseDate = typeof body.purchaseDate === 'string' ? body.purchaseDate : ''
    const units = Number(body.units)
    const unitsConfirmation = Number(body.unitsConfirmation)
    const tokenSuffix = typeof body.tokenSuffix === 'string' ? body.tokenSuffix.trim() : ''
    const tokenSuffixConfirmation = typeof body.tokenSuffixConfirmation === 'string' ? body.tokenSuffixConfirmation.trim() : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''

    if (!accountId || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate) || !Number.isFinite(units) || units <= 0) {
      return NextResponse.json({ error: 'Enter a valid meter, purchase date, and positive number of units.' }, { status: 400 })
    }
    if (!Number.isFinite(unitsConfirmation) || Math.round(units * 1000) !== Math.round(unitsConfirmation * 1000)) {
      return NextResponse.json({ error: 'The confirmed unit amount must match the amount purchased.' }, { status: 400 })
    }
    if (tokenSuffix && !/^[A-Za-z0-9-]{2,8}$/.test(tokenSuffix)) {
      return NextResponse.json({ error: 'Only the last 2–8 characters of the token may be recorded.' }, { status: 400 })
    }
    if (tokenSuffix.toUpperCase() !== tokenSuffixConfirmation.toUpperCase()) {
      return NextResponse.json({ error: 'The confirmed token reference must match.' }, { status: 400 })
    }
    if (notes.length > 500) return NextResponse.json({ error: 'Notes must be 500 characters or less.' }, { status: 400 })

    const { data, error } = await actor.client.rpc('record_electricity_topup', {
      p_account_id: accountId,
      p_purchase_date: purchaseDate,
      p_units: units,
      p_token_suffix: tokenSuffix || null,
      p_verified: false,
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
