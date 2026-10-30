'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bolt, Building2, Check, CircleAlert, Clock3, Gauge, KeyRound, MessageCircle, Plus, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react'
import { calculateElectricityBalance, classifyElectricityBalance, type ElectricityBalanceStatus } from '@/lib/electricity/balance'
import { reconcileMainMeters } from '@/lib/electricity/reconciliation'
import type { ElectricityAccountRow, ElectricityReadingRow } from '@/lib/electricity/database.types'
import type { Database } from '@/lib/supabase/database.types'
import { formatDate } from '@/utils/currency'
import { normalizeWhatsAppPhone } from '@/utils/phone'

type PropertyOption = { id: string; name: string }
type SectionOption = { id: string; name: string; property_id: string; section_type: string }
type UnitOption = { id: string; unit_name: string; property_id: string; section_id: string | null; unit_identifier: string | null }
type TenantOption = { id: string; full_name: string | null; business_name: string | null; phone: string; user_id: string }
type TopupRow = Database['public']['Tables']['electricity_topups']['Row']
type CutoffEvent = Database['public']['Tables']['electricity_cutoff_events']['Row']
type StaffRow = Pick<Database['public']['Tables']['electricity_staff']['Row'], 'id' | 'staff_id' | 'full_name' | 'active' | 'created_at'> & { property_ids: string[] }
type AccountView = ElectricityAccountRow & {
  property_name: string
  unit_name: string | null
  tenant_name: string
  tenant_phone: string | null
  section_name: string | null
  latest_reading: ElectricityReadingRow | null
  pending_verified_topup_units: number
  pending_reported_topup_units: number
  pending_topup_count: number
  estimated_balance_units: number
  last_cutoff_event: CutoffEvent | null
}
type WorkspaceData = {
  ownerMode: boolean
  currentStaffId: string | null
  properties: PropertyOption[]
  sections: SectionOption[]
  units: UnitOption[]
  tenants: TenantOption[]
  accounts: AccountView[]
  readings: ElectricityReadingRow[]
  topups: TopupRow[]
  cutoffEvents: CutoffEvent[]
  staff: StaffRow[]
}
type AccountForm = {
  propertyId: string
  meterKind: 'submeter' | 'floor_main'
  unitId: string
  tenantId: string
  floorLabel: string
  meterNumber: string
  initialMeterReading: string
  initialReadingDate: string
  openingBalanceUnits: string
  lowUnitsThreshold: string
}
type ActionState = { type: 'success' | 'error'; message: string } | null

const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date())
const numeric = (value: number | string) => Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 3 })
const accountTitle = (account: AccountView) => account.meter_kind === 'floor_main'
  ? `${account.floor_label} main meter`
  : account.tenant_name

const statusPresentation: Record<ElectricityBalanceStatus, { label: string; className: string; icon: typeof Bolt }> = {
  exhausted: { label: 'Balance at/below zero', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: CircleAlert },
  low: { label: 'Low units', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: CircleAlert },
  soon: { label: 'Nearly low', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: Clock3 },
  okay: { label: 'Units available', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: Check },
  reading_due: { label: 'Reading needed', className: 'border-slate-200 bg-slate-100 text-slate-700', icon: Gauge },
}

export function ElectricityWorkspace() {
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionState, setActionState] = useState<ActionState>(null)
  const [recordAccountId, setRecordAccountId] = useState('')
  const [readingValue, setReadingValue] = useState('')
  const [readingDate, setReadingDate] = useState(todayISO())
  const [readingNotes, setReadingNotes] = useState('')
  const [topupAccountId, setTopupAccountId] = useState('')
  const [topupDate, setTopupDate] = useState(todayISO())
  const [topupUnits, setTopupUnits] = useState('')
  const [tokenSuffix, setTokenSuffix] = useState('')
  const [topupVerified, setTopupVerified] = useState(false)
  const [topupNotes, setTopupNotes] = useState('')
  const [cutoffTarget, setCutoffTarget] = useState<{ accountId: string; action: 'disconnected' | 'restored' } | null>(null)
  const [cutoffReason, setCutoffReason] = useState('')
  const [cutoffReading, setCutoffReading] = useState('')
  const [showAccountSetup, setShowAccountSetup] = useState(false)
  const [showStaffSetup, setShowStaffSetup] = useState(false)
  const [accountForm, setAccountForm] = useState<AccountForm>({
    propertyId: '', meterKind: 'submeter', unitId: '', tenantId: '', floorLabel: '', meterNumber: '', initialReadingDate: todayISO(),
    initialMeterReading: '', openingBalanceUnits: '0', lowUnitsThreshold: '10',
  })
  const [staffForm, setStaffForm] = useState({ propertyIds: [] as string[], staffId: '', fullName: '', pin: '' })
  const [resetStaffId, setResetStaffId] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [editingStaffId, setEditingStaffId] = useState('')
  const [assignmentPropertyIds, setAssignmentPropertyIds] = useState<string[]>([])

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const response = await fetch('/api/electricity', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load electricity records.')
      const workspace = result as WorkspaceData
      setData(workspace)
      setPropertyId((current) => current || workspace.properties[0]?.id || '')
      setAccountForm((current) => ({ ...current, propertyId: current.propertyId || workspace.properties[0]?.id || '' }))
      setActionState(null)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not load electricity records.' })
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  const selectedProperty = data?.properties.find((property) => property.id === propertyId) || null
  const sections = useMemo(() => (data?.sections || []).filter((section) => section.property_id === propertyId), [data?.sections, propertyId])
  const units = useMemo(() => (data?.units || []).filter((unit) => unit.property_id === propertyId), [data?.units, propertyId])
  const accounts = useMemo(() => (data?.accounts || []).filter((account) => account.property_id === propertyId), [data?.accounts, propertyId])
  const activeAccounts = accounts.filter((account) => account.active)
  const submeters = activeAccounts.filter((account) => account.meter_kind === 'submeter')
  const mainMeters = activeAccounts.filter((account) => account.meter_kind === 'floor_main')
  const reconciliations = reconcileMainMeters(activeAccounts, data?.readings || [])
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const attention = submeters.map((account) => ({
    account,
    status: classifyElectricityBalance({
      balanceUnits: account.estimated_balance_units,
      lowThresholdUnits: Number(account.low_units_threshold),
      readingDate: account.latest_reading?.reading_date || null,
    }),
  })).filter(({ status }) => status !== 'okay').sort((left, right) => {
    const rank: Record<ElectricityBalanceStatus, number> = { exhausted: 0, low: 1, soon: 2, reading_due: 3, okay: 4 }
    return rank[left.status] - rank[right.status]
  })
  const lowCount = attention.filter(({ status }) => status === 'exhausted' || status === 'low').length
  const verifiedReadingBalance = submeters.reduce((sum, account) => sum + account.estimated_balance_units, 0)

  const postJson = async (path: string, body: unknown, method = 'POST') => {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'The request could not be saved.')
    return result
  }

  const submitReading = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || !recordAccountId) return
    setSaving(true)
    setActionState(null)
    try {
      const result = await postJson('/api/electricity/readings', {
        accountId: recordAccountId,
        currentReading: Number(readingValue),
        readingDate,
        notes: readingNotes,
      })
      const reading = result.reading as ElectricityReadingRow
      setReadingValue('')
      setReadingNotes('')
      setActionState({ type: 'success', message: `Reading saved. ${numeric(reading.usage_units)} units used${reading.closing_balance_units === null ? '.' : `; estimated ${numeric(reading.closing_balance_units)} units remain.`}` })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not save reading.' })
    } finally {
      setSaving(false)
    }
  }

  const submitTopup = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || !topupAccountId) return
    setSaving(true)
    setActionState(null)
    try {
      await postJson('/api/electricity/topups', {
        accountId: topupAccountId,
        purchaseDate: topupDate,
        units: Number(topupUnits),
        tokenSuffix,
        verified: topupVerified,
        notes: topupNotes,
      })
      setTopupUnits('')
      setTokenSuffix('')
      setTopupNotes('')
      setTopupVerified(false)
      setActionState({ type: 'success', message: topupVerified ? 'Verified top-up recorded and included in the estimate.' : 'Reported top-up saved. It will not change the estimated balance until verified against the meter.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not record top-up.' })
    } finally {
      setSaving(false)
    }
  }

  const verifyTopup = async (topup: TopupRow) => {
    if (saving) return
    setSaving(true)
    try {
      const result = await postJson('/api/electricity/topups', { id: topup.id }, 'PATCH')
      setActionState({
        type: 'success',
        message: result.topup.applied_reading_id
          ? 'Top-up confirmed and reconciled with the meter history.'
          : 'Top-up confirmed. It will be included at the first reading on or after its purchase date.',
      })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not verify the top-up.' })
    } finally {
      setSaving(false)
    }
  }

  const submitCutoffEvent = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving || !cutoffTarget) return
    setSaving(true)
    try {
      await postJson('/api/electricity/cutoff', {
        accountId: cutoffTarget.accountId,
        action: cutoffTarget.action,
        reason: cutoffReason,
        meterReading: cutoffReading ? Number(cutoffReading) : null,
      })
      setCutoffTarget(null)
      setCutoffReason('')
      setCutoffReading('')
      setActionState({ type: 'success', message: 'Manual power action recorded. The app did not switch the meter.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not record the manual action.' })
    } finally {
      setSaving(false)
    }
  }

  const submitAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await postJson('/api/electricity/accounts', accountForm)
      setAccountForm((current) => ({ ...current, meterKind: 'submeter', unitId: '', tenantId: '', floorLabel: '', meterNumber: '', initialMeterReading: '', initialReadingDate: todayISO(), openingBalanceUnits: '0', lowUnitsThreshold: '10' }))
      setShowAccountSetup(false)
      setActionState({ type: 'success', message: 'Electricity meter set up.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not set up the meter.' })
    } finally {
      setSaving(false)
    }
  }

  const submitStaff = async (event: React.FormEvent) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await postJson('/api/electricity/staff', staffForm)
      setStaffForm({ propertyIds: [], staffId: '', fullName: '', pin: '' })
      setShowStaffSetup(false)
      setActionState({ type: 'success', message: 'Staff login created with access only to the selected properties. Share the staff ID and PIN privately.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not create staff login.' })
    } finally {
      setSaving(false)
    }
  }

  const openStaffAssignments = (staff: StaffRow) => {
    if (editingStaffId === staff.id) {
      setEditingStaffId('')
      setAssignmentPropertyIds([])
      return
    }
    setEditingStaffId(staff.id)
    setAssignmentPropertyIds(staff.property_ids)
  }

  const submitStaffAssignments = async (event: React.FormEvent, staffId: string) => {
    event.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      await postJson('/api/electricity/staff', { id: staffId, propertyIds: assignmentPropertyIds }, 'PATCH')
      setEditingStaffId('')
      setAssignmentPropertyIds([])
      setActionState({ type: 'success', message: 'Staff property access updated.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not update staff properties.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleStaff = async (staff: StaffRow) => {
    setSaving(true)
    try {
      await postJson('/api/electricity/staff', { id: staff.id, active: !staff.active }, 'PATCH')
      setActionState({ type: 'success', message: staff.active ? 'Staff access deactivated.' : 'Staff access reactivated.' })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not update staff access.' })
    } finally {
      setSaving(false)
    }
  }

  const submitResetPin = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!resetStaffId || saving) return
    setSaving(true)
    try {
      await postJson('/api/electricity/staff', { id: resetStaffId, pin: resetPin }, 'PATCH')
      setResetStaffId('')
      setResetPin('')
      setActionState({ type: 'success', message: 'Staff PIN changed.' })
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : 'Could not change staff PIN.' })
    } finally {
      setSaving(false)
    }
  }

  const selectedRecordAccount = accounts.find((account) => account.id === recordAccountId) || null
  const recordPreviousReading = selectedRecordAccount?.latest_reading?.current_meter_reading ?? selectedRecordAccount?.initial_meter_reading ?? 0
  const recordOpeningBalance = selectedRecordAccount?.latest_reading?.closing_balance_units ?? selectedRecordAccount?.opening_balance_units ?? 0
  const applicableVerifiedTopups = data?.topups.filter((topup) =>
    topup.account_id === recordAccountId && !topup.applied_reading_id && topup.status === 'verified' && topup.purchase_date <= readingDate
  ).reduce((sum, topup) => sum + Number(topup.units), 0) || 0
  const parsedReadingValue = readingValue.trim() === '' ? Number.NaN : Number(readingValue)
  const readingPreview = Number.isFinite(parsedReadingValue) && parsedReadingValue >= recordPreviousReading
    ? calculateElectricityBalance({
        previousMeterReading: Number(recordPreviousReading),
        currentMeterReading: parsedReadingValue,
        openingBalanceUnits: Number(recordOpeningBalance),
        verifiedTopupUnits: applicableVerifiedTopups,
      })
    : null

  const submitManualAction = (account: AccountView) => {
    const action = account.last_cutoff_event?.action === 'disconnected' ? 'restored' : 'disconnected'
    setCutoffTarget({ accountId: account.id, action })
    setCutoffReason('')
    setCutoffReading(account.latest_reading ? String(account.latest_reading.current_meter_reading) : '')
  }

  const draftNotice = (account: AccountView) => {
    const phone = normalizeWhatsAppPhone(account.tenant_phone)
    if (!phone) {
      setActionState({ type: 'error', message: `No phone number is recorded for ${account.tenant_name}.` })
      return
    }
    const unitsLeft = numeric(account.estimated_balance_units)
    const readOn = account.latest_reading ? formatDate(account.latest_reading.reading_date) : 'the latest check'
    const message = `Hello ${account.tenant_name}, our electricity check for ${account.unit_name || account.floor_label} on ${readOn} estimates about ${unitsLeft} kWh remaining. Please top up your LUKU as needed. This is an estimate from the last submeter reading.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div className="py-16 text-center text-slate-500">Loading electricity workspace...</div>

  if (!data) return (
    <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
      <Bolt className="mx-auto h-9 w-9 text-amber-500" />
      <h1 className="text-xl font-bold text-slate-950">Electricity workspace unavailable</h1>
      <p className="text-sm text-slate-600">{actionState?.message || 'Check the database migration and your property access.'}</p>
      <button className="btn-secondary" onClick={() => void fetchData()}><RefreshCw className="mr-2 h-4 w-4" />Try again</button>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><Bolt className="h-4 w-4" />Metered electricity</div>
          <h1 className="text-2xl font-bold text-slate-950">Electricity monitoring</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Track tenant-reported LUKU top-ups, submeter usage, estimated units left, and on-site power actions.</p>
        </div>
        <div className="flex items-center gap-2">
          {data.ownerMode && <button className="btn-secondary min-h-11" onClick={() => setShowAccountSetup((show) => !show)}><Plus className="mr-2 h-4 w-4" />Set up meter</button>}
          <button className="icon-button h-11 w-11" onClick={() => void fetchData()} aria-label="Refresh electricity data" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </header>

      {actionState && <div role="status" className={`flex items-start gap-2 border px-4 py-3 text-sm ${actionState.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span className="mt-0.5">{actionState.type === 'error' ? <CircleAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span><span className="min-w-0 flex-1">{actionState.message}</span><button onClick={() => setActionState(null)} aria-label="Dismiss message"><X className="h-4 w-4" /></button></div>}

      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <label className="label" htmlFor="electricity-property">Property</label>
          <select id="electricity-property" className="input min-h-11" value={propertyId} onChange={(event) => setPropertyId(event.target.value)}>
            {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">Balance estimates are only as current as the last physical submeter reading.</p>
      </div>

      <section aria-label="Electricity overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active client submeters" value={String(submeters.length)} detail={selectedProperty?.name || 'Selected property'} />
        <Metric label="Low or exhausted" value={String(lowCount)} detail="Review reading and contact tenant" tone={lowCount ? 'danger' : 'normal'} />
        <Metric label="Estimated units left" value={numeric(verifiedReadingBalance)} detail="Sum of latest recorded balances" />
        <Metric label="Floor main meters" value={String(mainMeters.length)} detail="Shared floor readings" />
      </section>

      {showAccountSetup && data.ownerMode && <section className="border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="meter-setup-heading">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id="meter-setup-heading" className="text-lg font-semibold text-slate-950">Set up an electricity meter</h2><p className="mt-1 text-sm text-slate-600">Create a client submeter or a shared floor main meter. Set the starting readings from your paper record.</p></div>
          <button onClick={() => setShowAccountSetup(false)} className="icon-button" aria-label="Close meter setup"><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submitAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Property"><select className="input" required value={accountForm.propertyId} onChange={(event) => { setAccountForm({ ...accountForm, propertyId: event.target.value, unitId: '', tenantId: '', floorLabel: '' }); setPropertyId(event.target.value) }}>{data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Field>
          <Field label="Meter type"><select className="input" value={accountForm.meterKind} onChange={(event) => setAccountForm({ ...accountForm, meterKind: event.target.value as AccountForm['meterKind'], unitId: '', tenantId: '' })}><option value="submeter">Client submeter</option><option value="floor_main">Floor main meter</option></select></Field>
          <Field label={accountForm.meterKind === 'submeter' ? 'Floor / shared group' : 'Floor or shared area'}><input className="input" required maxLength={80} placeholder="For example, FL1" value={accountForm.floorLabel} onChange={(event) => setAccountForm({ ...accountForm, floorLabel: event.target.value })} /></Field>
          {accountForm.meterKind === 'submeter' && <>
            <Field label="Unit"><select required className="input" value={accountForm.unitId} onChange={(event) => {
              const unit = units.find((item) => item.id === event.target.value)
              const section = sections.find((item) => item.id === unit?.section_id)
              setAccountForm({ ...accountForm, unitId: event.target.value, floorLabel: accountForm.floorLabel || section?.name || '' })
            }}><option value="">Select unit</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}{unit.unit_identifier ? ` (${unit.unit_identifier})` : ''}</option>)}</select></Field>
            <Field label="Client"><select required className="input" value={accountForm.tenantId} onChange={(event) => setAccountForm({ ...accountForm, tenantId: event.target.value })}><option value="">Select client</option>{data.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.business_name || 'Unnamed client'}</option>)}</select></Field>
          </>}
          <Field label="Meter number (optional)"><input className="input" maxLength={80} value={accountForm.meterNumber} onChange={(event) => setAccountForm({ ...accountForm, meterNumber: event.target.value })} /></Field>
          <Field label="Starting meter reading (kWh)"><input className="input" type="number" inputMode="decimal" min="0" step="0.001" required value={accountForm.initialMeterReading} onChange={(event) => setAccountForm({ ...accountForm, initialMeterReading: event.target.value })} /></Field>
          <Field label="Date of starting reading"><input className="input" type="date" required value={accountForm.initialReadingDate} max={todayISO()} onChange={(event) => setAccountForm({ ...accountForm, initialReadingDate: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">The next reading is compared against this date. Use the actual date from the meter log.</span></Field>
          {accountForm.meterKind === 'submeter' && <>
            <Field label="Opening units carried forward"><input className="input" type="number" inputMode="decimal" step="0.001" value={accountForm.openingBalanceUnits} onChange={(event) => setAccountForm({ ...accountForm, openingBalanceUnits: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">Enter the starting LUKU balance shown on your form.</span></Field>
            <Field label="Low-unit warning threshold"><input className="input" type="number" inputMode="decimal" min="0" step="0.001" value={accountForm.lowUnitsThreshold} onChange={(event) => setAccountForm({ ...accountForm, lowUnitsThreshold: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">“Nearly low” starts at twice this amount.</span></Field>
          </>}
          <div className="flex items-end"><button className="btn-primary min-h-11 w-full" disabled={saving}>{saving ? 'Saving...' : 'Save meter'}</button></div>
        </form>
      </section>}

      <section aria-labelledby="reconciliation-heading" className="scroll-mt-20 border-y border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 id="reconciliation-heading" className="text-lg font-semibold text-slate-950">Main meter reconciliation</h2>
          <p className="mt-1 text-sm text-slate-600">Main-meter use is compared with the sum of its floor submeters for the same start and end dates. A final shortfall is shown only when every active submeter has a matching reading.</p>
        </div>
        {reconciliations.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Add a main meter for each floor to track unaccounted units.</p> : <div className="divide-y divide-slate-200">
          {reconciliations.map((report) => {
            const statusText = report.status === 'baseline'
              ? 'Baseline only; record a later reading to calculate use'
              : report.status === 'unassigned'
                ? 'No submeters assigned to this floor'
                : report.status === 'incomplete'
                  ? `${report.matchedSubmeterCount} of ${report.submeterAccounts.length} submeters match this period`
                  : report.status === 'balanced'
                    ? 'Balanced within 0.001 kWh'
                    : report.status === 'shortage'
                      ? `${numeric(report.difference || 0)} kWh unaccounted`
                      : `${numeric(Math.abs(report.difference || 0))} kWh more on submeters than main meter`
            const statusClass = report.status === 'shortage'
              ? 'border-rose-200 bg-rose-50 text-rose-800'
              : report.status === 'balanced'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : report.status === 'excess'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-slate-200 bg-slate-50 text-slate-700'
            return <article key={report.mainAccount.id} className="px-4 py-4 sm:px-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{report.mainAccount.floor_label}</h3><span className={`border px-2 py-1 text-xs font-semibold ${statusClass}`}>{statusText}</span></div>
                  <p className="mt-1 text-sm text-slate-600">Main meter: {numeric(report.mainCurrentReading)} kWh · {report.mainReading ? `read ${formatDate(report.mainReading.reading_date)}` : `baseline ${formatDate(report.mainAccount.initial_reading_date)}`}</p>
                  {report.periodStart && report.periodEnd && <p className="mt-1 text-xs text-slate-500">Period {formatDate(report.periodStart)} to {formatDate(report.periodEnd)}</p>}
                  {report.status === 'incomplete' && <p className="mt-1 text-xs text-amber-800">Still need: {report.unmatchedSubmeters.map((account) => account.tenant_name || 'Client submeter').join(', ')}. No final shortfall is calculated yet.</p>}
                  {report.status === 'baseline' && <p className="mt-1 text-xs text-slate-500">The ledger supplies a current main reading but no earlier main reading for this period, so missing units cannot be calculated yet.</p>}
                </div>
                {report.mainUsage !== null && <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:min-w-64">
                  <dt className="text-slate-500">Main units used</dt><dd className="text-right font-semibold text-slate-900">{numeric(report.mainUsage)} kWh</dd>
                  <dt className="text-slate-500">Submeter units matched</dt><dd className="text-right font-semibold text-slate-900">{report.submeterUsage === null ? 'Pending' : `${numeric(report.submeterUsage)} kWh`}</dd>
                  {report.status === 'shortage' && <><dt className="font-semibold text-rose-800">Unaccounted units</dt><dd className="text-right font-bold text-rose-800">{numeric(report.difference || 0)} kWh</dd></>}
                  {report.status === 'excess' && <><dt className="font-semibold text-amber-800">Submeter excess</dt><dd className="text-right font-bold text-amber-800">{numeric(Math.abs(report.difference || 0))} kWh</dd></>}
                </dl>}
              </div>
              {report.submeterAccounts.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">{report.submeterAccounts.map((account) => {
                const matched = !report.unmatchedSubmeters.some((item) => item.id === account.id)
                const matchingReading = data.readings.find((reading) => reading.account_id === account.id && reading.previous_reading_date === report.periodStart && reading.reading_date === report.periodEnd)
                return <span key={account.id}>{account.tenant_name || 'Client'}: {matchingReading ? `${numeric(matchingReading.usage_units)} kWh` : matched ? 'matched' : 'reading needed'}</span>
              })}</div>}
            </article>
          })}
        </div>}
      </section>

      <section id="attention" aria-labelledby="attention-heading" className="scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="attention-heading" className="text-lg font-semibold text-slate-950">Needs attention</h2><p className="mt-1 text-sm text-slate-600">Low balances need a fresh physical check and a person to contact the client.</p></div><span className="text-sm font-semibold text-slate-500">{attention.length} items</span></div>
        {attention.length === 0 ? <div className="border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No low balances or overdue meter checks for this property.</div> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {attention.map(({ account, status }) => {
            const presentation = statusPresentation[status]
            const StatusIcon = presentation.icon
            return <article key={account.id} className="grid grid-cols-1 gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-slate-950">{account.tenant_name}</h3><span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className="h-3.5 w-3.5" />{presentation.label}</span></div>
                <p className="mt-1 text-sm text-slate-600">{account.unit_name || account.floor_label} · {account.section_name || account.floor_label}</p>
                <p className="mt-1 text-xs text-slate-500">Estimate: <strong className="text-slate-800">{numeric(account.estimated_balance_units)} kWh</strong> · Last checked {account.latest_reading ? formatDate(account.latest_reading.reading_date) : 'not yet read'}{account.pending_reported_topup_units > 0 ? ` · ${numeric(account.pending_reported_topup_units)} reported units unverified` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {account.tenant_phone && <button className="btn-secondary min-h-11 flex-1 sm:flex-none" onClick={() => draftNotice(account)}><MessageCircle className="mr-2 h-4 w-4" />Draft WhatsApp</button>}
                {status === 'exhausted' && account.last_cutoff_event?.action !== 'disconnected' && <button className="min-h-11 border border-rose-300 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-50" onClick={() => submitManualAction(account)}>Log manual cut-off</button>}
                {status === 'reading_due' && <a className="btn-secondary min-h-11" href="#record">Record check</a>}
              </div>
            </article>
          })}
        </div>}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <section id="record" className="scroll-mt-20 border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="record-heading">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-amber-50 text-amber-700"><Gauge className="h-5 w-5" /></span><div><h2 id="record-heading" className="text-lg font-semibold text-slate-950">Record a physical reading</h2><p className="mt-1 text-sm text-slate-600">Select a client submeter or shared floor main meter. Usage is calculated from the last recorded reading.</p></div></div>
          <form onSubmit={submitReading} className="space-y-4">
            <Field label="Meter"><select required className="input min-h-11" value={recordAccountId} onChange={(event) => setRecordAccountId(event.target.value)}><option value="">Select meter</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.meter_kind === 'floor_main' ? `${account.floor_label} · Main meter` : `${account.tenant_name} · ${account.unit_name || account.floor_label}`}</option>)}</select></Field>
            {selectedRecordAccount && <div className="grid grid-cols-2 gap-3 border border-slate-200 bg-slate-50 p-3 text-sm">
              <div><p className="text-xs text-slate-500">Previous submeter reading</p><p className="mt-1 font-semibold text-slate-950">{numeric(recordPreviousReading)} kWh</p></div>
              <div><p className="text-xs text-slate-500">Starting unit balance</p><p className="mt-1 font-semibold text-slate-950">{selectedRecordAccount.meter_kind === 'floor_main' ? 'Not applicable' : `${numeric(recordOpeningBalance + applicableVerifiedTopups)} kWh`}</p></div>
            </div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Current reading (kWh)"><input required className="input min-h-11" type="number" inputMode="decimal" min="0" step="0.001" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} /></Field>
              <Field label="Reading date"><input required className="input min-h-11" type="date" value={readingDate} onChange={(event) => setReadingDate(event.target.value)} /></Field>
            </div>
            <Field label="Note (optional)"><input className="input min-h-11" maxLength={500} placeholder="Reading checked by, meter condition..." value={readingNotes} onChange={(event) => setReadingNotes(event.target.value)} /></Field>
            {selectedRecordAccount && readingPreview && <div className="grid grid-cols-2 gap-3 border border-amber-200 bg-amber-50 p-3 text-sm">
              <div><p className="text-xs text-amber-800">Calculated usage</p><p className="mt-1 font-bold text-slate-950">{numeric(readingPreview.usageUnits)} kWh</p></div>
              <div><p className="text-xs text-amber-800">Estimated units remaining</p><p className={`mt-1 font-bold ${readingPreview.closingBalanceUnits <= selectedRecordAccount.low_units_threshold ? 'text-rose-700' : 'text-slate-950'}`}>{selectedRecordAccount.meter_kind === 'floor_main' ? 'Main meter only' : `${numeric(readingPreview.closingBalanceUnits)} kWh`}</p></div>
            </div>}
            {selectedRecordAccount && !readingValue.trim() && <p className="text-sm text-slate-600">Enter the reading shown on the physical meter to preview usage and remaining units.</p>}
            {selectedRecordAccount && readingValue.trim() && !readingPreview && <p className="text-sm text-rose-700">The new reading is below the last value ({numeric(recordPreviousReading)}). Check the digits or set up a new meter if it reset.</p>}
            <button className="btn-primary min-h-12 w-full sm:w-auto" disabled={saving || !selectedRecordAccount || !readingPreview}>{saving ? 'Saving...' : 'Save meter reading'}</button>
          </form>
        </section>

        <section id="topups" className="scroll-mt-20 border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="topup-heading">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700"><Bolt className="h-5 w-5" /></span><div><h2 id="topup-heading" className="text-lg font-semibold text-slate-950">Record tenant LUKU top-up</h2><p className="mt-1 text-sm text-slate-600">The tenant buys their own units. Record the amount they loaded; only a meter-verified top-up affects the estimate.</p></div></div>
          <form onSubmit={submitTopup} className="space-y-4">
            <Field label="Client submeter"><select required className="input min-h-11" value={topupAccountId} onChange={(event) => setTopupAccountId(event.target.value)}><option value="">Select client</option>{submeters.map((account) => <option key={account.id} value={account.id}>{account.tenant_name} · {account.unit_name || account.floor_label}</option>)}</select></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Purchase date"><input required className="input min-h-11" type="date" value={topupDate} onChange={(event) => setTopupDate(event.target.value)} /></Field>
              <Field label="Units loaded (kWh)"><input required className="input min-h-11" type="number" inputMode="decimal" min="0.001" step="0.001" value={topupUnits} onChange={(event) => setTopupUnits(event.target.value)} /></Field>
            </div>
            <Field label="Token reference (optional, last 2–8 characters only)"><input className="input min-h-11" maxLength={8} value={tokenSuffix} onChange={(event) => setTokenSuffix(event.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 8))} /><span className="mt-1 block text-xs text-slate-500">Do not enter or store the full prepaid token.</span></Field>
            <label className="flex min-h-12 items-center gap-3 border border-slate-200 px-3 py-2 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 accent-emerald-600" checked={topupVerified} onChange={(event) => setTopupVerified(event.target.checked)} /><span><strong>Verified against the submeter</strong><span className="block text-xs text-slate-500">Leave unchecked until the units are observed on the meter.</span></span></label>
            <Field label="Note (optional)"><input className="input min-h-11" maxLength={500} placeholder="Receipt/reference detail" value={topupNotes} onChange={(event) => setTopupNotes(event.target.value)} /></Field>
            <button className="btn-secondary min-h-12 w-full sm:w-auto" disabled={saving || !submeters.length}>{saving ? 'Saving...' : 'Record top-up'}</button>
          </form>
          {(data.topups.filter((topup) => topup.account_id && accountById.has(topup.account_id) && topup.status === 'reported').length > 0) && <div className="mt-5 border-t border-slate-200 pt-4">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Reported, not yet verified</h3>
            <div className="divide-y divide-slate-100">
              {data.topups.filter((topup) => accountById.has(topup.account_id) && topup.status === 'reported').slice(0, 6).map((topup) => <div key={topup.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{accountById.get(topup.account_id)?.tenant_name} · {numeric(topup.units)} kWh</p><p className="text-xs text-slate-500">Reported {formatDate(topup.purchase_date)}</p></div>
                <button className="min-h-10 shrink-0 border border-emerald-300 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50" disabled={saving} onClick={() => void verifyTopup(topup)}>Confirm</button>
              </div>)}
            </div>
          </div>}
        </section>
      </div>

      <section id="meters" className="scroll-mt-20" aria-labelledby="meters-heading">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="meters-heading" className="text-lg font-semibold text-slate-950">Meters and latest balances</h2><p className="mt-1 text-sm text-slate-600">Floor main readings are tracked separately from tenant submeters; shared usage is not charged to tenants by this screen.</p></div><span className="text-sm text-slate-500">{activeAccounts.length} active meters</span></div>
        {activeAccounts.length === 0 ? <div className="border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No meters have been set up for this property yet.</div> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {activeAccounts.map((account) => {
            const status = account.meter_kind === 'submeter' ? classifyElectricityBalance({ balanceUnits: account.estimated_balance_units, lowThresholdUnits: Number(account.low_units_threshold), readingDate: account.latest_reading?.reading_date || null }) : null
            const presentation = status ? statusPresentation[status] : null
            const cutOff = account.last_cutoff_event?.action === 'disconnected'
            return <article key={account.id} className="grid grid-cols-1 gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{accountTitle(account)}</h3><span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-600">{account.meter_kind === 'floor_main' ? 'Floor main meter' : 'Client submeter'}</span>{presentation && <span className={`border px-2 py-1 text-xs font-semibold ${presentation.className}`}>{presentation.label}</span>}{cutOff && <span className="border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">Manually disconnected</span>}</div>
                <p className="mt-1 text-sm text-slate-600">{account.property_name} · {account.unit_name || account.floor_label}{account.section_name ? ` · ${account.section_name}` : ''}{account.meter_number ? ` · Meter ${account.meter_number}` : ''}</p>
                <p className="mt-1 text-xs text-slate-500">Last reading {account.latest_reading ? `${numeric(account.latest_reading.current_meter_reading)} kWh on ${formatDate(account.latest_reading.reading_date)}` : `${numeric(account.initial_meter_reading)} kWh baseline on ${formatDate(account.initial_reading_date)}`}{account.meter_kind === 'submeter' ? ` · Estimated balance ${numeric(account.estimated_balance_units)} kWh` : ''}</p>
                {account.pending_reported_topup_units > 0 && <p className="mt-1 text-xs font-medium text-amber-700">{numeric(account.pending_reported_topup_units)} reported kWh still needs meter verification.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="#record" onClick={() => setRecordAccountId(account.id)} className="btn-secondary min-h-11 flex-1 sm:flex-none">Record reading</a>
                {account.meter_kind === 'submeter' && account.tenant_phone && <button className="btn-secondary min-h-11 flex-1 sm:flex-none" onClick={() => draftNotice(account)}><MessageCircle className="mr-2 h-4 w-4" />Notify</button>}
                {account.meter_kind === 'submeter' && <button className={`min-h-11 border px-3 text-sm font-semibold ${cutOff ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`} onClick={() => submitManualAction(account)}>{cutOff ? 'Log restore' : 'Log manual cut-off'}</button>}
              </div>
            </article>
          })}
        </div>}
      </section>

      {cutoffTarget && <section className="border border-rose-200 bg-rose-50 p-4 sm:p-5" aria-labelledby="manual-action-heading">
        <div className="mb-3 flex items-start justify-between gap-3"><div><h2 id="manual-action-heading" className="font-semibold text-rose-950">Record {cutoffTarget.action === 'disconnected' ? 'manual power cut-off' : 'power restoration'}</h2><p className="mt-1 text-sm text-rose-800">This only records the action after staff operate the electrical switch on site. No remote disconnection occurs.</p></div><button className="icon-button" onClick={() => setCutoffTarget(null)} aria-label="Cancel manual action"><X className="h-4 w-4" /></button></div>
        <form onSubmit={submitCutoffEvent} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Reason"><input required minLength={3} maxLength={500} className="input min-h-11" value={cutoffReason} onChange={(event) => setCutoffReason(event.target.value)} placeholder="Reason for on-site action" /></Field>
          <Field label="Meter reading (optional)"><input className="input min-h-11" type="number" inputMode="decimal" min="0" step="0.001" value={cutoffReading} onChange={(event) => setCutoffReading(event.target.value)} /></Field>
          <div className="flex items-end gap-2"><button className="min-h-11 flex-1 bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800" disabled={saving}>{saving ? 'Saving...' : 'Confirm action logged'}</button><button type="button" className="btn-secondary min-h-11" onClick={() => setCutoffTarget(null)}>Cancel</button></div>
        </form>
      </section>}

      {data.ownerMode && <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="access-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="access-heading" className="text-lg font-semibold text-slate-950">Staff access</h2><p className="mt-1 text-sm text-slate-600">Each staff login is restricted to this electricity workspace and its assigned properties.</p></div><button className="btn-secondary min-h-11" onClick={() => setShowStaffSetup((show) => !show)}><UserPlus className="mr-2 h-4 w-4" />Add staff login</button></div>
        {showStaffSetup && <form onSubmit={submitStaff} className="grid grid-cols-1 gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset className="sm:col-span-2 lg:col-span-4">
            <legend className="text-sm font-medium text-slate-700">Properties this staff member can access</legend>
            <p className="mb-2 mt-1 text-xs text-slate-500">Only selected properties will appear after sign-in. Each selection grants access to all electricity records in that property.</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.properties.map((property) => <label key={property.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={staffForm.propertyIds.includes(property.id)} onChange={(event) => setStaffForm((current) => ({ ...current, propertyIds: event.target.checked ? [...current.propertyIds, property.id] : current.propertyIds.filter((id) => id !== property.id) }))} />
                <span>{property.name}</span>
              </label>)}
            </div>
          </fieldset>
          <Field label="Staff ID"><input required minLength={3} maxLength={24} className="input min-h-11" value={staffForm.staffId} onChange={(event) => setStaffForm({ ...staffForm, staffId: event.target.value.toUpperCase() })} placeholder="For example, DT-014" /></Field>
          <Field label="Staff name"><input required minLength={2} maxLength={100} className="input min-h-11" value={staffForm.fullName} onChange={(event) => setStaffForm({ ...staffForm, fullName: event.target.value })} /></Field>
          <Field label="8–12 digit PIN"><input required pattern="[0-9]{8,12}" inputMode="numeric" autoComplete="new-password" className="input min-h-11" type="password" value={staffForm.pin} onChange={(event) => setStaffForm({ ...staffForm, pin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></Field>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary min-h-11" onClick={() => setShowStaffSetup(false)}>Cancel</button><button className="btn-primary min-h-11" disabled={saving || staffForm.propertyIds.length === 0}>{saving ? 'Creating...' : 'Create staff login'}</button></div>
        </form>}
        {data.staff.length === 0 ? <p className="border-y border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">No staff logins yet.</p> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {data.staff.map((staff) => <div key={staff.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div><p className="font-semibold text-slate-950">{staff.full_name} <span className="font-normal text-slate-500">· {staff.staff_id}</span></p><p className="mt-1 text-xs text-slate-500">{staff.property_ids.map((id) => data.properties.find((property) => property.id === id)?.name || 'Assigned property').join(', ') || 'No property assigned'} · {staff.active ? 'Active' : 'Deactivated'}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary min-h-10" onClick={() => openStaffAssignments(staff)} aria-expanded={editingStaffId === staff.id}><Building2 className="mr-2 h-4 w-4" />{editingStaffId === staff.id ? 'Close properties' : 'Edit properties'}</button>
              <button className="btn-secondary min-h-10" onClick={() => { setResetStaffId(resetStaffId === staff.id ? '' : staff.id); setResetPin('') }}><KeyRound className="mr-2 h-4 w-4" />Reset PIN</button>
              <button className={`min-h-10 border px-3 text-sm font-semibold ${staff.active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`} onClick={() => void toggleStaff(staff)} disabled={saving}>{staff.active ? 'Deactivate' : 'Reactivate'}</button>
            </div>
            {editingStaffId === staff.id && <form onSubmit={(event) => void submitStaffAssignments(event, staff.id)} className="w-full border-t border-slate-200 pt-3">
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">Allowed properties for {staff.full_name}</legend>
                <p className="mb-2 mt-1 text-xs text-slate-500">Each selection grants access to all electricity records in that property. New requests are restricted immediately; ask the staff member to reload to clear records already loaded on their device.</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.properties.map((property) => <label key={property.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={assignmentPropertyIds.includes(property.id)} onChange={(event) => setAssignmentPropertyIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} />
                    <span>{property.name}</span>
                  </label>)}
                </div>
              </fieldset>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary min-h-11" onClick={() => openStaffAssignments(staff)}>Cancel</button><button className="btn-primary min-h-11" disabled={saving}>{saving ? 'Saving...' : 'Save property access'}</button></div>
            </form>}
            {resetStaffId === staff.id && <form onSubmit={submitResetPin} className="flex w-full flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end sm:justify-end"><Field label="New 8–12 digit PIN"><input required pattern="[0-9]{8,12}" inputMode="numeric" autoComplete="new-password" className="input min-h-11" type="password" value={resetPin} onChange={(event) => setResetPin(event.target.value.replace(/\D/g, '').slice(0, 12))} /></Field><button className="btn-primary min-h-11" disabled={saving}>{saving ? 'Saving...' : 'Update PIN'}</button></form>}
          </div>)}
        </div>}
        <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Staff PINs are stored by Supabase Auth, not in this app’s electricity tables. Use a unique PIN per person; access changes are attributed to their account.</p>
      </section>}

      <section aria-labelledby="history-heading" className="border-t border-slate-200 pt-5">
        <h2 id="history-heading" className="text-base font-semibold text-slate-950">Recent meter activity</h2>
        {data.readings.filter((reading) => accountById.has(reading.account_id)).length === 0 ? <p className="mt-3 border-y border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">No readings have been recorded.</p> : <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {data.readings.filter((reading) => accountById.has(reading.account_id)).slice(0, 8).map((reading) => {
            const account = accountById.get(reading.account_id)
            return <div key={reading.id} className="grid grid-cols-2 gap-2 px-3 py-3 text-sm sm:grid-cols-4 sm:px-4">
              <div><p className="text-xs text-slate-500">Meter / client</p><p className="mt-1 truncate font-medium text-slate-900">{account ? accountTitle(account) : 'Meter'}</p></div>
              <div><p className="text-xs text-slate-500">Period</p><p className="mt-1 text-slate-800">{reading.previous_reading_date ? `${formatDate(reading.previous_reading_date)} to ${formatDate(reading.reading_date)}` : `Start date unknown · ${formatDate(reading.reading_date)}`}</p></div>
              <div><p className="text-xs text-slate-500">Used</p><p className="mt-1 text-slate-800">{numeric(reading.usage_units)} kWh</p></div>
              <div><p className="text-xs text-slate-500">Units carried forward</p><p className="mt-1 font-semibold text-slate-900">{reading.closing_balance_units === null ? 'Main meter' : `${numeric(reading.closing_balance_units)} kWh`}</p></div>
            </div>
          })}
        </div>}
      </section>

      {data.currentStaffId && <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">Signed in with staff ID {data.currentStaffId}. Readings and manual actions are recorded under your login.</p>}
    </div>
  )
}

function Metric({ label, value, detail, tone = 'normal' }: { label: string; value: string; detail: string; tone?: 'normal' | 'danger' }) {
  return <div className="border border-slate-200 bg-white p-4">
    <p className="text-xs font-semibold text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-bold ${tone === 'danger' ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
    <p className="mt-1 text-xs text-slate-500">{detail}</p>
  </div>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block min-w-0 text-sm font-medium text-slate-700">{label}<span className="mt-1 block">{children}</span></label>
}
