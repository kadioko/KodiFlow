import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor } from '@/lib/electricity/server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to comment on an electricity issue.' }, { status: 401 })
    const body = await request.json()
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId : ''
    const comment = typeof body.comment === 'string' ? body.comment.trim() : ''
    if (!ticketId || comment.length < 1 || comment.length > 2000) {
      return NextResponse.json({ error: 'Enter a comment of up to 2,000 characters.' }, { status: 400 })
    }

    const { data: issue, error: lookupError } = await actor.service
      .from('electricity_issue_tickets').select('id, owner_user_id, property_id').eq('id', ticketId).maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!issue || issue.owner_user_id !== actor.ownerUserId || !canAccessElectricityProperty(actor, issue.property_id)) {
      return NextResponse.json({ error: 'Issue not found or access denied.' }, { status: 404 })
    }

    const { data, error } = await actor.service.from('electricity_issue_comments').insert({
      ticket_id: issue.id,
      owner_user_id: actor.ownerUserId,
      body: comment,
      created_by: actor.user.id,
    }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ comment: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not add your comment.' }, { status: 500 })
  }
}
