import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to record this action.' }, { status: 401 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const action = body.action === 'restored' ? 'restored' : body.action === 'disconnected' ? 'disconnected' : null
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const meterReading = body.meterReading === null || body.meterReading === '' || body.meterReading === undefined
      ? null
      : Number(body.meterReading)

    if (!accountId || !action || reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: 'Choose the manual action and provide a reason (3–500 characters).' }, { status: 400 })
    }
    if (meterReading !== null && (!Number.isFinite(meterReading) || meterReading < 0)) {
      return NextResponse.json({ error: 'Enter a valid meter reading.' }, { status: 400 })
    }

    const { data: account, error: accountError } = await actor.service
      .from('electricity_accounts')
      .select('id, owner_user_id, property_id, meter_kind, active')
      .eq('id', accountId)
      .maybeSingle()
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 })
    if (!account || !account.active || account.meter_kind !== 'submeter' || !canAccessElectricityProperty(actor, account.property_id)) {
      return NextResponse.json({ error: 'This submeter is unavailable to your account.' }, { status: 404 })
    }

    const { data, error } = await actor.service
      .from('electricity_cutoff_events')
      .insert({
        account_id: account.id,
        owner_user_id: account.owner_user_id,
        action,
        meter_reading: meterReading,
        reason,
        performed_by: actor.user.id,
      })
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ event: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record the manual cut-off action.' }, { status: 500 })
  }
}
