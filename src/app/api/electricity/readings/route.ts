import { NextResponse, type NextRequest } from 'next/server'
import { getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to record a meter reading.' }, { status: 401 })

    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const hasCurrentReading = typeof body.currentReading === 'number'
      || (typeof body.currentReading === 'string' && body.currentReading.trim() !== '')
    const currentReading = hasCurrentReading ? Number(body.currentReading) : Number.NaN
    const readingDate = typeof body.readingDate === 'string' ? body.readingDate : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : null

    if (!accountId || !Number.isFinite(currentReading) || currentReading < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(readingDate)) {
      return NextResponse.json({ error: 'Enter a meter and valid reading date/value.' }, { status: 400 })
    }
    if (notes && notes.length > 500) return NextResponse.json({ error: 'Notes must be 500 characters or less.' }, { status: 400 })

    const { data, error } = await actor.client.rpc('record_electricity_meter_reading', {
      p_account_id: accountId,
      p_current_reading: currentReading,
      p_reading_date: readingDate,
      p_notes: notes,
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ reading: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not record the meter reading.' }, { status: 500 })
  }
}
