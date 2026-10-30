import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

const entryTypes = new Set(['reading', 'topup', 'main_balance', 'adjustment', 'cutoff'])

async function manageEntry(request: NextRequest, action: 'edit' | 'reverse') {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to manage electricity entries.' }, { status: 401 })
    if (action === 'reverse' && !actor.isOwner) {
      return NextResponse.json({ error: 'Only the property owner can reverse electricity entries.' }, { status: 403 })
    }

    const body = await request.json()
    const entryType = typeof body.entryType === 'string' ? body.entryType : ''
    const entryId = typeof body.entryId === 'string' ? body.entryId : ''
    const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
    const changes = body.changes && typeof body.changes === 'object' && !Array.isArray(body.changes) ? body.changes : {}
    if (!entryTypes.has(entryType) || !entryId || reason.length < 3 || reason.length > 500) {
      return NextResponse.json({ error: 'Choose a valid entry and provide a reason between 3 and 500 characters.' }, { status: 400 })
    }

    const { data, error } = await actor.client.rpc('manage_electricity_entry', {
      p_entry_type: entryType,
      p_entry_id: entryId,
      p_action: action,
      p_changes: changes,
      p_reason: reason,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ result: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update the electricity entry.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  return manageEntry(request, 'edit')
}

export async function POST(request: NextRequest) {
  return manageEntry(request, 'reverse')
}
