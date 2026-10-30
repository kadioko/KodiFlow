import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to adjust a meter balance.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can adjust unit balances.' }, { status: 403 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const adjustmentUnits = Number(body.adjustmentUnits)
    const adjustmentDate = typeof body.adjustmentDate === 'string' ? body.adjustmentDate : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''

    if (!accountId || !Number.isFinite(adjustmentUnits) || adjustmentUnits === 0 || Math.abs(adjustmentUnits) > 100000) {
      return NextResponse.json({ error: 'Enter a non-zero adjustment between -100,000 and 100,000 kWh.' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adjustmentDate) || reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: 'Enter a valid date and a reason between 3 and 500 characters.' }, { status: 400 })
    }

    const { data, error } = await actor.client.rpc('adjust_electricity_balance', {
      p_account_id: accountId,
      p_adjustment_units: adjustmentUnits,
      p_adjustment_date: adjustmentDate,
      p_reason: reason,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ adjustment: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not adjust the electricity balance.' },
      { status: 500 }
    )
  }
}
