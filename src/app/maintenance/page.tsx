'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, ClipboardList, ExternalLink, ImagePlus, Plus, Wrench } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/utils/currency'

type RequestStatus = 'new' | 'assigned' | 'in_progress' | 'waiting_for_tenant' | 'completed' | 'closed'
type Priority = 'low' | 'medium' | 'high' | 'urgent'
type PropertyOption = { id: string; name: string }
type UnitOption = { id: string; property_id: string; unit_name: string }
type TenantOption = { id: string; full_name: string | null; business_name: string | null }
type MaintenanceRequest = { id: string; property_id: string; unit_id: string | null; tenant_id: string | null; title: string; description: string | null; status: RequestStatus; priority: Priority; vendor_name: string | null; assigned_to: string | null; estimated_cost: number | null; actual_cost: number | null; expense_id: string | null; due_date: string | null; completed_at: string | null; created_at: string; properties: { name: string } | { name: string }[] | null; units: { unit_name: string } | { unit_name: string }[] | null; tenants: { full_name: string | null; business_name: string | null } | { full_name: string | null; business_name: string | null }[] | null; maintenance_attachments: { id: string; file_name: string; file_url: string }[] | null }

const statusLabels: Record<RequestStatus, string> = { new: 'New', assigned: 'Assigned', in_progress: 'In progress', waiting_for_tenant: 'Waiting for tenant', completed: 'Completed', closed: 'Closed' }
const statusTone: Record<RequestStatus, string> = { new: 'bg-primary-100 text-primary-800', assigned: 'bg-violet-100 text-violet-800', in_progress: 'bg-amber-100 text-amber-800', waiting_for_tenant: 'bg-orange-100 text-orange-800', completed: 'bg-success-100 text-success-800', closed: 'bg-slate-100 text-slate-700' }
const priorityTone: Record<Priority, string> = { low: 'bg-slate-100 text-slate-700', medium: 'bg-primary-100 text-primary-800', high: 'bg-amber-100 text-amber-800', urgent: 'bg-danger-100 text-danger-800' }
const emptyForm = { property_id: '', unit_id: '', tenant_id: '', title: '', description: '', priority: 'medium' as Priority, vendor_name: '', assigned_to: '', estimated_cost: '', due_date: '' }
const first = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value

export default function MaintenancePage() {
  const [requests, setRequests] = useState<MaintenanceRequest[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [units, setUnits] = useState<UnitOption[]>([])
  const [tenants, setTenants] = useState<TenantOption[]>([])
  const [form, setForm] = useState(emptyForm)
  const [showForm, setShowForm] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | RequestStatus>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [requestResult, propertyResult, unitResult, tenantResult] = await Promise.all([
      supabase.from('maintenance_requests').select('*, properties(name), units(unit_name), tenants(full_name, business_name), maintenance_attachments(id, file_name, file_url)').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('properties').select('id, name').eq('user_id', user.id).order('name'),
      supabase.from('units').select('id, property_id, unit_name').eq('user_id', user.id).order('unit_name'),
      supabase.from('tenants').select('id, full_name, business_name').eq('user_id', user.id).order('full_name'),
    ])
    setRequests((requestResult.data || []) as MaintenanceRequest[])
    setProperties((propertyResult.data || []) as PropertyOption[])
    setUnits((unitResult.data || []) as UnitOption[])
    setTenants((tenantResult.data || []) as TenantOption[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filteredUnits = units.filter((unit) => !form.property_id || unit.property_id === form.property_id)
  const visibleRequests = useMemo(() => requests.filter((request) => {
    const tenant = first(request.tenants)
    const searchable = `${request.title} ${request.description || ''} ${first(request.properties)?.name || ''} ${first(request.units)?.unit_name || ''} ${tenant?.full_name || tenant?.business_name || ''}`.toLowerCase()
    return (statusFilter === 'all' || request.status === statusFilter) && (priorityFilter === 'all' || request.priority === priorityFilter) && (!query.trim() || searchable.includes(query.trim().toLowerCase()))
  }), [requests, statusFilter, priorityFilter, query])
  const openCount = requests.filter((request) => !['completed', 'closed'].includes(request.status)).length
  const urgentCount = requests.filter((request) => request.priority === 'urgent' && !['completed', 'closed'].includes(request.status)).length
  const openEstimate = requests.filter((request) => !['completed', 'closed'].includes(request.status)).reduce((total, request) => total + Number(request.estimated_cost || 0), 0)

  const createRequest = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!form.property_id || !form.title.trim()) { setError('Property and issue title are required.'); return }
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error: insertError } = await supabase.from('maintenance_requests').insert({ user_id: user.id, property_id: form.property_id, unit_id: form.unit_id || null, tenant_id: form.tenant_id || null, title: form.title.trim(), description: form.description.trim() || null, priority: form.priority, vendor_name: form.vendor_name.trim() || null, assigned_to: form.assigned_to.trim() || null, estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null, due_date: form.due_date || null })
    if (insertError) setError(insertError.message)
    else { setForm(emptyForm); setShowForm(false); await load() }
    setSaving(false)
  }

  const updateStatus = async (id: string, status: RequestStatus) => {
    const supabase = createClient()
    const update = { status, completed_at: status === 'completed' ? new Date().toISOString() : null }
    const { error: updateError } = await supabase.from('maintenance_requests').update(update).eq('id', id)
    if (updateError) setError(updateError.message); else await load()
  }

  const uploadPhoto = async (requestId: string, file: File) => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const path = `${user.id}/maintenance/${requestId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file, { upsert: false })
    if (uploadError) { setError(uploadError.message); return }
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path)
    const { error: attachmentError } = await supabase.from('maintenance_attachments').insert({ user_id: user.id, maintenance_request_id: requestId, file_name: file.name, file_url: urlData.publicUrl, mime_type: file.type || null, file_size: file.size })
    if (attachmentError) setError(attachmentError.message); else await load()
  }

  const createExpense = async (request: MaintenanceRequest) => {
    if (!request.actual_cost || request.actual_cost <= 0) { setError('Add the actual cost before creating the linked expense.'); return }
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: expense, error: expenseError } = await supabase.from('expenses').insert({ user_id: user.id, property_id: request.property_id, unit_id: request.unit_id, category: 'maintenance', amount: request.actual_cost, expense_date: new Date().toISOString().slice(0, 10), vendor: request.vendor_name, description: request.title, notes: `Created from maintenance request ${request.id}` }).select('id').single()
    if (expenseError || !expense) { setError(expenseError?.message || 'Could not create expense'); return }
    const { error: linkError } = await supabase.from('maintenance_requests').update({ expense_id: expense.id }).eq('id', request.id)
    if (linkError) setError(linkError.message); else await load()
  }

  return <div className="space-y-6">
    <div className="page-header"><div><h1 className="page-title">Maintenance</h1><p className="text-gray-500">Track property issues from report to completion and cost.</p></div><button onClick={() => setShowForm(!showForm)} className="btn-primary"><Plus className="mr-2 h-5 w-5" />New request</button></div>
    {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}
    <div className="grid grid-cols-3 gap-4"><Metric label="Open work" value={openCount.toString()} tone="text-primary-700" /><Metric label="Urgent" value={urgentCount.toString()} tone="text-danger-700" /><Metric label="Open estimate" value={formatCurrency(openEstimate)} tone="text-amber-700" /></div>
    {showForm && <form onSubmit={createRequest} className="card p-5"><div className="mb-4 flex items-center gap-2"><Wrench className="h-5 w-5 text-primary-600" /><h2 className="font-semibold text-slate-950">New maintenance request</h2></div><div className="grid gap-4 md:grid-cols-2"><Field label="Property"><select className="input" value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value, unit_id: '' })}><option value="">Select property</option>{properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Field><Field label="Unit"><select className="input" value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })}><option value="">Property-wide issue</option>{filteredUnits.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}</option>)}</select></Field><Field label="Tenant"><select className="input" value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}><option value="">No tenant linked</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.business_name}</option>)}</select></Field><Field label="Priority"><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>{(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}</select></Field><Field label="Issue title"><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Water leak in bathroom" /></Field><Field label="Due date"><input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></Field><Field label="Vendor"><input className="input" value={form.vendor_name} onChange={(e) => setForm({ ...form, vendor_name: e.target.value })} placeholder="Optional vendor" /></Field><Field label="Assigned to"><input className="input" value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} placeholder="Team member or contractor" /></Field><Field label="Estimated cost"><input type="number" min="0" className="input" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })} placeholder="TZS" /></Field><Field label="Description"><textarea className="input min-h-24" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue, access details, and requested work." /></Field></div><div className="mt-5 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button><button disabled={saving} className="btn-primary">{saving ? 'Creating...' : 'Create request'}</button></div></form>}
    <div className="card p-4"><div className="grid gap-3 md:grid-cols-4"><input className="input md:col-span-2" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search issue, property, unit, or tenant" /><select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | RequestStatus)}><option value="all">All statuses</option>{(Object.keys(statusLabels) as RequestStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><select className="input" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as 'all' | Priority)}><option value="all">All priorities</option>{(['low', 'medium', 'high', 'urgent'] as Priority[]).map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></div></div>
    {loading ? <div className="card p-10 text-center text-slate-500">Loading maintenance requests...</div> : visibleRequests.length === 0 ? <div className="card p-12 text-center"><ClipboardList className="mx-auto mb-3 h-10 w-10 text-slate-400" /><p className="font-semibold text-slate-900">No matching maintenance requests</p><p className="mt-1 text-sm text-slate-500">Create a request when a property issue needs attention.</p></div> : <div className="grid gap-4 lg:grid-cols-2">{visibleRequests.map((request) => <RequestCard key={request.id} request={request} onStatus={updateStatus} onPhoto={uploadPhoto} onExpense={createExpense} />)}</div>}
  </div>
}

function RequestCard({ request, onStatus, onPhoto, onExpense }: { request: MaintenanceRequest; onStatus: (id: string, status: RequestStatus) => void; onPhoto: (id: string, file: File) => void; onExpense: (request: MaintenanceRequest) => void }) {
  const property = first(request.properties); const unit = first(request.units); const tenant = first(request.tenants)
  return <article className="card p-5"><div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className={`badge ${priorityTone[request.priority]}`}>{request.priority}</span><span className={`badge ${statusTone[request.status]}`}>{statusLabels[request.status]}</span></div><h2 className="mt-3 text-base font-semibold text-slate-950">{request.title}</h2><p className="mt-1 text-sm text-slate-500">{property?.name}{unit ? ` · ${unit.unit_name}` : ''}{tenant ? ` · ${tenant.full_name || tenant.business_name}` : ''}</p></div><div className="relative"><select aria-label={`Update status for ${request.title}`} className="appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-8 text-sm font-semibold text-slate-700" value={request.status} onChange={(e) => onStatus(request.id, e.target.value as RequestStatus)}>{(Object.keys(statusLabels) as RequestStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-slate-400" /></div></div><p className="mt-3 text-sm text-slate-600">{request.description || 'No additional description.'}</p><div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-100 py-3 text-sm"><div><p className="text-xs text-slate-500">Due</p><p className="mt-1 font-semibold text-slate-900">{request.due_date ? formatDate(request.due_date) : 'Not set'}</p></div><div><p className="text-xs text-slate-500">Estimate</p><p className="mt-1 font-semibold text-slate-900">{request.estimated_cost ? formatCurrency(request.estimated_cost) : 'Not set'}</p></div><div><p className="text-xs text-slate-500">Vendor</p><p className="mt-1 truncate font-semibold text-slate-900">{request.vendor_name || request.assigned_to || 'Unassigned'}</p></div></div><div className="mt-4 flex flex-wrap items-center gap-3 text-sm font-semibold"><label className="inline-flex cursor-pointer items-center gap-1 text-primary-700"><ImagePlus className="h-4 w-4" />Add photo<input type="file" accept="image/*,.pdf" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) onPhoto(request.id, file) }} /></label>{request.maintenance_attachments?.map((attachment) => <a key={attachment.id} href={attachment.file_url} target="_blank" className="inline-flex items-center gap-1 text-slate-700"><ExternalLink className="h-4 w-4" />{attachment.file_name}</a>)}{request.status === 'completed' && !request.expense_id && <button onClick={() => onExpense(request)} className="ml-auto text-amber-700">Create expense</button>}{request.expense_id && <Link href="/expenses" className="ml-auto inline-flex items-center gap-1 text-success-700"><CheckCircle2 className="h-4 w-4" />Expense linked</Link>}</div></article>
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) { return <div className="stat-card"><p className="stat-label">{label}</p><p className={`stat-value ${tone}`}>{value}</p></div> }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="form-group"><span className="label">{label}</span>{children}</label> }
