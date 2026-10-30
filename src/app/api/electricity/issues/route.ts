import { NextResponse, type NextRequest } from 'next/server'
import { canAccessElectricityProperty, getElectricityActor } from '@/lib/electricity/server'

const issueStatuses = new Set(['open', 'in_progress', 'waiting_on_staff', 'resolved', 'closed'])
const issuePriorities = new Set(['low', 'normal', 'high', 'urgent'])

export async function GET(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to view electricity issues.' }, { status: 401 })
    const requestedPropertyId = new URL(request.url).searchParams.get('propertyId')
    const propertyIds = requestedPropertyId
      ? canAccessElectricityProperty(actor, requestedPropertyId) ? [requestedPropertyId] : []
      : actor.propertyIds
    if (propertyIds.length === 0) return NextResponse.json({ error: 'You do not have access to this property.' }, { status: 403 })

    const [issueResult, staffResult] = await Promise.all([
      actor.service.from('electricity_issue_tickets').select('*').in('property_id', propertyIds).order('updated_at', { ascending: false }).limit(200),
      actor.service.from('electricity_staff').select('auth_user_id, full_name, staff_id').eq('owner_user_id', actor.ownerUserId),
    ])
    if (issueResult.error) return NextResponse.json({ error: issueResult.error.message }, { status: 500 })
    if (staffResult.error) return NextResponse.json({ error: staffResult.error.message }, { status: 500 })

    const issues = issueResult.data || []
    const issueIds = issues.map((issue) => issue.id)
    if (issueIds.length === 0) return NextResponse.json({ issues: [], comments: [], events: [] })

    const [commentsResult, eventsResult] = await Promise.all([
      actor.service.from('electricity_issue_comments').select('*').in('ticket_id', issueIds).order('created_at'),
      actor.service.from('electricity_issue_events').select('*').in('ticket_id', issueIds).order('performed_at'),
    ])
    if (commentsResult.error) return NextResponse.json({ error: commentsResult.error.message }, { status: 500 })
    if (eventsResult.error) return NextResponse.json({ error: eventsResult.error.message }, { status: 500 })

    const names = new Map((staffResult.data || []).map((staff) => [staff.auth_user_id, staff.full_name || staff.staff_id]))
    names.set(actor.user.id, actor.isOwner ? actor.user.email || 'Owner' : actor.staff?.full_name || actor.staff?.staff_id || 'Staff')
    return NextResponse.json({
      issues: issues.map((issue) => ({ ...issue, opened_by_name: names.get(issue.opened_by) || 'Account user' })),
      comments: (commentsResult.data || []).map((comment) => ({ ...comment, author_name: names.get(comment.created_by) || 'Account user' })),
      events: (eventsResult.data || []).map((event) => ({ ...event, actor_name: names.get(event.performed_by) || 'Account user' })),
    })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not load electricity issues.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to open an electricity issue.' }, { status: 401 })
    const body = await request.json()
    const accountId = typeof body.accountId === 'string' ? body.accountId : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const priority = typeof body.priority === 'string' ? body.priority : 'normal'
    if (!accountId || title.length < 3 || title.length > 160 || description.length < 3 || description.length > 3000 || !issuePriorities.has(priority)) {
      return NextResponse.json({ error: 'Select a meter and enter a title and details for the issue.' }, { status: 400 })
    }

    const { data: account, error: accountError } = await actor.service
      .from('electricity_accounts')
      .select('id, owner_user_id, property_id, active')
      .eq('id', accountId)
      .maybeSingle()
    if (accountError) return NextResponse.json({ error: accountError.message }, { status: 500 })
    if (!account || !account.active || account.owner_user_id !== actor.ownerUserId || !canAccessElectricityProperty(actor, account.property_id)) {
      return NextResponse.json({ error: 'This meter is unavailable to your account.' }, { status: 404 })
    }

    const { data, error } = await actor.service.from('electricity_issue_tickets').insert({
      owner_user_id: actor.ownerUserId,
      property_id: account.property_id,
      account_id: account.id,
      title,
      description,
      priority,
      status: 'open',
      opened_by: actor.user.id,
      updated_by: actor.user.id,
    }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ issue: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not open the electricity issue.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const actor = await getElectricityActor()
    if (!actor) return NextResponse.json({ error: 'Please sign in to update this issue.' }, { status: 401 })
    if (!actor.isOwner) return NextResponse.json({ error: 'Only the property owner can change issue status or resolve it.' }, { status: 403 })

    const body = await request.json()
    const ticketId = typeof body.ticketId === 'string' ? body.ticketId : ''
    const status = typeof body.status === 'string' ? body.status : ''
    const resolution = typeof body.resolution === 'string' ? body.resolution.trim() : ''
    if (!ticketId || !issueStatuses.has(status) || (['resolved', 'closed'].includes(status) && resolution.length < 3)) {
      return NextResponse.json({ error: 'Choose a valid status and describe the resolution before closing the issue.' }, { status: 400 })
    }

    const { data: existing, error: lookupError } = await actor.service
      .from('electricity_issue_tickets').select('id, property_id, status').eq('id', ticketId).maybeSingle()
    if (lookupError) return NextResponse.json({ error: lookupError.message }, { status: 500 })
    if (!existing || !canAccessElectricityProperty(actor, existing.property_id)) {
      return NextResponse.json({ error: 'Issue not found or access denied.' }, { status: 404 })
    }
    if (status === 'closed' && existing.status !== 'resolved' && existing.status !== 'closed') {
      return NextResponse.json({ error: 'Resolve the issue before closing it.' }, { status: 409 })
    }

    const update = {
      status,
      resolution: ['resolved', 'closed'].includes(status) ? resolution : null,
      resolved_by: ['resolved', 'closed'].includes(status) ? actor.user.id : null,
      resolved_at: ['resolved', 'closed'].includes(status) ? new Date().toISOString() : null,
      updated_by: actor.user.id,
    }
    const { data, error } = await actor.service
      .from('electricity_issue_tickets').update(update).eq('id', ticketId).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ issue: data })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update the electricity issue.' }, { status: 500 })
  }
}
