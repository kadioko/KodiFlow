'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Bolt, Building2, Check, CircleAlert, Clock3, Copy, Download, Gauge, KeyRound, MessageCircle, Minus, Plus, Printer, RefreshCw, ShieldCheck, UserPlus, X } from 'lucide-react'
import { calculateElectricityBalance, classifyElectricityBalance, type ElectricityBalanceStatus } from '@/lib/electricity/balance'
import { getElectricityReadingContext } from '@/lib/electricity/reading-context'
import { digitsOnlyLukuToken, formatLukuToken } from '@/lib/electricity/luku-token'
import { reconcileMainMeters } from '@/lib/electricity/reconciliation'
import type { ElectricityAccountRow, ElectricityReadingRow } from '@/lib/electricity/database.types'
import type { Database } from '@/lib/supabase/database.types'
import { formatCurrency, formatDate } from '@/utils/currency'
import { normalizeWhatsAppPhone } from '@/utils/phone'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import type { TranslationKey } from '@/utils/i18n'

type PropertyOption = { id: string; name: string }
type SectionOption = { id: string; name: string; property_id: string; section_type: string }
type UnitOption = { id: string; unit_name: string; property_id: string; section_id: string | null; unit_identifier: string | null }
type TenantOption = { id: string; full_name: string | null; business_name: string | null; phone: string; user_id: string }
type TopupRow = Database['public']['Tables']['electricity_topups']['Row']
type MainMeterBalanceRow = Database['public']['Tables']['electricity_main_meter_balances']['Row']
type CutoffEvent = Database['public']['Tables']['electricity_cutoff_events']['Row']
type StaffActivity = {
  occurred_at: string
  action: 'reading' | 'topup' | 'topup_verified' | 'adjustment' | 'disconnected' | 'restored'
  account_label: string
}
type StaffRow = Pick<Database['public']['Tables']['electricity_staff']['Row'], 'id' | 'auth_user_id' | 'staff_id' | 'full_name' | 'active' | 'created_at' | 'last_login_at'> & {
  property_ids: string[]
  last_activity: StaffActivity | null
}
type StaffLoginEvent = Pick<Database['public']['Tables']['electricity_staff_login_events']['Row'], 'id' | 'staff_id' | 'owner_user_id' | 'logged_in_at'> & {
  staff_name: string
  staff_code: string
}
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
  pending_adjustment_units: number
  pending_adjustment_count: number
  estimated_balance_units: number
  last_cutoff_event: CutoffEvent | null
}
type WorkspaceData = {
  ownerMode: boolean
  currentUserId: string
  currentStaffId: string | null
  properties: PropertyOption[]
  sections: SectionOption[]
  units: UnitOption[]
  tenants: TenantOption[]
  accounts: AccountView[]
  readings: ElectricityReadingRow[]
  mainMeterBalances?: MainMeterBalanceRow[]
  topups: TopupRow[]
  cutoffEvents: CutoffEvent[]
  adjustments: Database['public']['Tables']['electricity_balance_adjustments']['Row'][]
  staff: StaffRow[]
  staffLoginEvents: StaffLoginEvent[]
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
const daysAgoISO = (days: number) => {
  const date = new Date(`${todayISO()}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}
const numeric = (value: number | string) => Number(value || 0).toLocaleString('en-TZ', { maximumFractionDigits: 3 })
const formatTimestamp = (value: string) => new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Africa/Nairobi',
}).format(new Date(value))
const accountTitle = (account: AccountView) => account.meter_kind === 'floor_main'
  ? `${account.floor_label} main meter`
  : account.tenant_name

const staffActivityLabelKeys: Record<StaffActivity['action'], TranslationKey> = {
  reading: 'electricity.staffActivityReading',
  topup: 'electricity.staffActivityTopup',
  topup_verified: 'electricity.staffActivityTopupVerified',
  adjustment: 'electricity.staffActivityAdjustment',
  disconnected: 'electricity.staffActivityCutoff',
  restored: 'electricity.staffActivityRestore',
}

const statusPresentation: Record<ElectricityBalanceStatus, { labelKey: TranslationKey; className: string; icon: typeof Bolt }> = {
  exhausted: { labelKey: 'electricity.balanceExhausted', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: CircleAlert },
  low: { labelKey: 'electricity.lowUnits', className: 'border-rose-200 bg-rose-50 text-rose-800', icon: CircleAlert },
  soon: { labelKey: 'electricity.nearlyLow', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: Clock3 },
  okay: { labelKey: 'electricity.unitsAvailable', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: Check },
  reading_due: { labelKey: 'electricity.readingDue', className: 'border-slate-200 bg-slate-100 text-slate-700', icon: Gauge },
}

export function ElectricityWorkspace() {
  const { t } = useLanguage()
  const [data, setData] = useState<WorkspaceData | null>(null)
  const [propertyId, setPropertyId] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionState, setActionState] = useState<ActionState>(null)
  const [recordAccountId, setRecordAccountId] = useState('')
  const [readingValue, setReadingValue] = useState('')
  const [readingDate, setReadingDate] = useState(todayISO())
  const [readingNotes, setReadingNotes] = useState('')
  const [mainBalanceAccountId, setMainBalanceAccountId] = useState('')
  const [mainBalanceDate, setMainBalanceDate] = useState(todayISO())
  const [mainBalanceUnits, setMainBalanceUnits] = useState('')
  const [mainBalanceNotes, setMainBalanceNotes] = useState('')
  const [quickReadingDate, setQuickReadingDate] = useState(todayISO())
  const [quickReadingNotes, setQuickReadingNotes] = useState('')
  const [quickReadingValues, setQuickReadingValues] = useState<Record<string, string>>({})
  const [topupAccountId, setTopupAccountId] = useState('')
  const [topupDate, setTopupDate] = useState(todayISO())
  const [topupUnits, setTopupUnits] = useState('')
  const [topupUnitsConfirmation, setTopupUnitsConfirmation] = useState('')
  const [tokenCode, setTokenCode] = useState('')
  const [tokenCodeConfirmation, setTokenCodeConfirmation] = useState('')
  const [topupPurchaseAmountTzs, setTopupPurchaseAmountTzs] = useState('')
  const [topupNotes, setTopupNotes] = useState('')
  const [visibleTopupTokenIds, setVisibleTopupTokenIds] = useState<Set<string>>(() => new Set())
  const [cutoffTarget, setCutoffTarget] = useState<{ accountId: string; action: 'disconnected' | 'restored' } | null>(null)
  const [cutoffReason, setCutoffReason] = useState('')
  const [cutoffReading, setCutoffReading] = useState('')
  const [showAccountSetup, setShowAccountSetup] = useState(false)
  const [showStaffSetup, setShowStaffSetup] = useState(false)
  const [copiedMeterAccountId, setCopiedMeterAccountId] = useState('')
  const [accountForm, setAccountForm] = useState<AccountForm>({
    propertyId: '', meterKind: 'submeter', unitId: '', tenantId: '', floorLabel: '', meterNumber: '', initialReadingDate: todayISO(),
    initialMeterReading: '', openingBalanceUnits: '0', lowUnitsThreshold: '10',
  })
  const [staffForm, setStaffForm] = useState({ propertyIds: [] as string[], staffId: '', fullName: '', pin: '' })
  const [resetStaffId, setResetStaffId] = useState('')
  const [resetPin, setResetPin] = useState('')
  const [editingStaffId, setEditingStaffId] = useState('')
  const [assignmentPropertyIds, setAssignmentPropertyIds] = useState<string[]>([])
  const [activeView, setActiveView] = useState<'overview' | 'readings' | 'topups' | 'meters' | 'reports' | 'staff'>('overview')
  const [reportStartDate, setReportStartDate] = useState(daysAgoISO(6))
  const [reportEndDate, setReportEndDate] = useState(todayISO())
  const [weeklyTarget, setWeeklyTarget] = useState<2 | 3>(2)
  const [adjustmentTarget, setAdjustmentTarget] = useState<AccountView | null>(null)
  const [adjustmentUnits, setAdjustmentUnits] = useState('')
  const [adjustmentDirection, setAdjustmentDirection] = useState<'add' | 'remove'>('add')
  const [adjustmentDate, setAdjustmentDate] = useState(todayISO())
  const [adjustmentReason, setAdjustmentReason] = useState('')

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
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.checkMigrationAccess') })
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
  const mainMeterBalances = (data?.mainMeterBalances || [])
    .filter((balance) => mainMeters.some((account) => account.id === balance.account_id))
    .sort((left, right) => right.reading_date.localeCompare(left.reading_date) || right.created_at.localeCompare(left.created_at))
  const latestMainBalanceByAccount = new Map<string, MainMeterBalanceRow>()
  for (const balance of mainMeterBalances) {
    if (!latestMainBalanceByAccount.has(balance.account_id)) latestMainBalanceByAccount.set(balance.account_id, balance)
  }
  const reconciliations = reconcileMainMeters(activeAccounts, data?.readings || [])
  const accountById = new Map(accounts.map((account) => [account.id, account]))
  const propertyTopups = (data?.topups || [])
    .filter((topup) => accountById.has(topup.account_id))
    .sort((left, right) => right.purchase_date.localeCompare(left.purchase_date) || right.created_at.localeCompare(left.created_at))
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
  const topupAmountMatches = topupUnits.trim() !== ''
    && Number.isFinite(Number(topupUnits))
    && Math.round(Number(topupUnits) * 1000) === Math.round(Number(topupUnitsConfirmation) * 1000)
  const topupTokenMatches = tokenCode.length === 20 && tokenCode === tokenCodeConfirmation
  const topupValueValid = topupPurchaseAmountTzs.trim() !== ''
    && Number.isFinite(Number(topupPurchaseAmountTzs))
    && Number(topupPurchaseAmountTzs) > 0
    && Number(topupPurchaseAmountTzs) <= 1_000_000_000
  const topupReady = topupAmountMatches && topupTokenMatches && topupValueValid

  const reportRows = useMemo(() => {
    if (!data) return []
    const accountMap = new Map(data.accounts.filter((account) => account.property_id === propertyId).map((account) => [account.id, account]))
    return data.readings
      .filter((reading) => reading.reading_date >= reportStartDate && reading.reading_date <= reportEndDate && accountMap.has(reading.account_id))
      .map((reading) => {
        const account = accountMap.get(reading.account_id)!
        const periodStart = reading.previous_reading_date || account.initial_reading_date
        const topups = data.topups.filter((topup) => topup.account_id === reading.account_id && (
          topup.applied_reading_id === reading.id
          || (!topup.applied_reading_id && topup.status === 'reported' && topup.purchase_date > periodStart && topup.purchase_date <= reading.reading_date)
        ))
        const reportedTopupUnits = topups.filter((topup) => topup.status === 'reported').reduce((sum, topup) => sum + Number(topup.units), 0)
        const verifiedTopupUnits = topups.filter((topup) => topup.status === 'verified').reduce((sum, topup) => sum + Number(topup.units), 0)
        const cutoff = data.cutoffEvents
          .filter((event) => event.account_id === reading.account_id
            && event.action === 'disconnected'
            && event.meter_reading !== null
            && event.performed_at.slice(0, 10) >= periodStart
            && event.performed_at.slice(0, 10) <= reading.reading_date)
          .sort((left, right) => right.performed_at.localeCompare(left.performed_at))[0]
        return {
          id: reading.id,
          account,
          reading,
          periodStart,
          unitsPurchased: topups.reduce((sum, topup) => sum + Number(topup.units), 0),
          purchaseValueTzs: topups.reduce((sum, topup) => sum + Number(topup.purchase_amount_tzs || 0), 0),
          verifiedTopupUnits,
          reportedTopupUnits,
          cutoffReading: cutoff?.meter_reading ?? null,
          adjustmentUnits: Number(reading.adjustment_units || 0),
        }
      })
      .sort((left, right) => left.reading.reading_date.localeCompare(right.reading.reading_date) || left.account.tenant_name.localeCompare(right.account.tenant_name))
  }, [data, propertyId, reportStartDate, reportEndDate])

  const reportTotals = useMemo(() => reportRows.reduce((totals, row) => ({
    usage: totals.usage + Number(row.reading.usage_units),
    purchased: totals.purchased + row.unitsPurchased,
    purchaseValueTzs: totals.purchaseValueTzs + row.purchaseValueTzs,
    verified: totals.verified + row.verifiedTopupUnits,
    reported: totals.reported + row.reportedTopupUnits,
    adjustments: totals.adjustments + row.adjustmentUnits,
    carried: totals.carried + Number(row.reading.closing_balance_units || 0),
  }), { usage: 0, purchased: 0, purchaseValueTzs: 0, verified: 0, reported: 0, adjustments: 0, carried: 0 }), [reportRows])

  const weeklyReadingsByAccount = useMemo(() => {
    const counts = new Map<string, number>()
    const weekStart = daysAgoISO(6)
    for (const reading of data?.readings || []) {
      const account = data?.accounts.find((item) => item.id === reading.account_id)
      if (account?.property_id === propertyId && account.meter_kind === 'submeter' && reading.reading_date >= weekStart && reading.reading_date <= todayISO()) {
        counts.set(account.id, (counts.get(account.id) || 0) + 1)
      }
    }
    return counts
  }, [data, propertyId])
  const readingSessions = useMemo(() => {
    if (!data) return []
    const accountIds = new Set(data.accounts.filter((account) => account.property_id === propertyId).map((account) => account.id))
    const sessions = new Map<string, ElectricityReadingRow[]>()
    for (const reading of data.readings) {
      if (!accountIds.has(reading.account_id)) continue
      const session = sessions.get(reading.reading_date) || []
      session.push(reading)
      sessions.set(reading.reading_date, session)
    }
    return Array.from(sessions, ([date, rows]) => ({
      date,
      rows: rows.sort((left, right) => {
        const leftAccount = data.accounts.find((account) => account.id === left.account_id)
        const rightAccount = data.accounts.find((account) => account.id === right.account_id)
        return Number(leftAccount?.meter_kind !== 'floor_main') - Number(rightAccount?.meter_kind !== 'floor_main')
          || (leftAccount?.tenant_name || leftAccount?.floor_label || '').localeCompare(rightAccount?.tenant_name || rightAccount?.floor_label || '')
      }),
    })).sort((left, right) => right.date.localeCompare(left.date))
  }, [data, propertyId])
  const clientsOnTrack = submeters.filter((account) => (weeklyReadingsByAccount.get(account.id) || 0) >= weeklyTarget).length
  const clientsNeedingReadings = Math.max(0, submeters.length - clientsOnTrack)

  const submitAdjustment = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!adjustmentTarget || saving) return
    setSaving(true)
    setActionState(null)
    try {
      await postJson('/api/electricity/adjustments', {
        accountId: adjustmentTarget.id,
        adjustmentUnits: Number(adjustmentUnits) * (adjustmentDirection === 'add' ? 1 : -1),
        adjustmentDate,
        reason: adjustmentReason,
      })
      setAdjustmentTarget(null)
      setAdjustmentUnits('')
      setAdjustmentReason('')
      setActionState({ type: 'success', message: t('electricity.adjustmentSaved') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.adjustmentSaveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const downloadReport = () => {
    const csvValue = (value: string | number | null) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = [
      [t('electricity.property'), t('electricity.client'), t('electricity.unit'), t('electricity.period'), t('electricity.previousReading'), t('electricity.currentMeterReading'), t('electricity.broughtForward'), t('electricity.unitsConsumed'), t('electricity.unitsPurchased'), t('electricity.purchaseValueTzs'), t('electricity.unitsVerified'), t('electricity.unitsReported'), t('electricity.cutoffReading'), t('electricity.adjustmentAmount'), t('electricity.carriedForward')],
      ...reportRows.map(({ account, reading, periodStart, unitsPurchased, purchaseValueTzs, verifiedTopupUnits, reportedTopupUnits, cutoffReading, adjustmentUnits }) => [
        account.property_name,
        account.tenant_name,
        account.unit_name || account.floor_label,
        `${periodStart} to ${reading.reading_date}`,
        reading.previous_meter_reading,
        reading.current_meter_reading,
        reading.opening_balance_units,
        reading.usage_units,
        unitsPurchased,
        purchaseValueTzs,
        verifiedTopupUnits,
        reportedTopupUnits,
        cutoffReading,
        adjustmentUnits,
        reading.closing_balance_units,
      ]),
      [t('electricity.periodTotals'), '', '', '', '', '', '', reportTotals.usage, reportTotals.purchased, reportTotals.purchaseValueTzs, reportTotals.verified, reportTotals.reported, '', reportTotals.adjustments, reportTotals.carried],
    ]
    const csv = `\uFEFF${rows.map((row) => row.map(csvValue).join(',')).join('\r\n')}`
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `electricity-ledger-${reportStartDate}-to-${reportEndDate}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const workspaceViews = [
    { key: 'overview' as const, label: t('electricity.areaOverview') },
    { key: 'readings' as const, label: t('electricity.areaReadings') },
    { key: 'topups' as const, label: t('electricity.areaTopups') },
    { key: 'meters' as const, label: t('electricity.areaMeters') },
    { key: 'reports' as const, label: t('electricity.areaReports') },
    ...(data?.ownerMode ? [{ key: 'staff' as const, label: t('electricity.areaStaff') }] : []),
  ]

  const postJson = async (path: string, body: unknown, method = 'POST') => {
    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const result = await response.json()
    if (!response.ok) throw new Error(result.error || t('electricity.requestFailed'))
    return result
  }

  const copyMeterNumber = async (account: AccountView) => {
    if (!account.meter_number) return
    try {
      await navigator.clipboard.writeText(account.meter_number)
      setCopiedMeterAccountId(account.id)
      window.setTimeout(() => {
        setCopiedMeterAccountId((current) => current === account.id ? '' : current)
      }, 1800)
    } catch {
      setActionState({ type: 'error', message: t('electricity.copyFailed') })
    }
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
      setActionState({
        type: 'success',
        message: reading.closing_balance_units === null
          ? t('electricity.readingSavedNoBalance', { used: numeric(reading.usage_units) })
          : t('electricity.readingSaved', { used: numeric(reading.usage_units), remaining: numeric(reading.closing_balance_units) }),
      })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.readingSaveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const submitMainBalance = async (event: React.FormEvent) => {
    event.preventDefault()
    const unitsRemaining = Number(mainBalanceUnits)
    if (saving || !mainMeters.some((account) => account.id === mainBalanceAccountId) || !Number.isFinite(unitsRemaining) || unitsRemaining < 0) return
    setSaving(true)
    setActionState(null)
    try {
      await postJson('/api/electricity/main-balances', {
        accountId: mainBalanceAccountId,
        readingDate: mainBalanceDate,
        unitsRemaining,
        notes: mainBalanceNotes.trim() || null,
      })
      setMainBalanceUnits('')
      setMainBalanceNotes('')
      setActionState({ type: 'success', message: t('electricity.mainBalanceSaved') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.mainBalanceSaveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const submitQuickReading = async (account: AccountView) => {
    const currentReading = Number(quickReadingValues[account.id])
    const context = getElectricityReadingContext(account, data?.readings.filter((reading) => reading.account_id === account.id) || [], quickReadingDate)
    const canSave = context.dateAfterBaseline && !context.duplicateDate && quickReadingDate <= todayISO()
      && Number.isFinite(currentReading) && currentReading >= context.previousMeterReading
      && (context.nextMeterReading === null || currentReading <= context.nextMeterReading)
    if (saving || !canSave) return
    setSaving(true)
    setActionState(null)
    try {
      const result = await postJson('/api/electricity/readings', {
        accountId: account.id,
        currentReading,
        readingDate: quickReadingDate,
        notes: quickReadingNotes.trim() || null,
      })
      const reading = result.reading as ElectricityReadingRow
      setQuickReadingValues((current) => ({ ...current, [account.id]: '' }))
      setActionState({
        type: 'success',
        message: reading.closing_balance_units === null
          ? t('electricity.readingSavedNoBalance', { used: numeric(reading.usage_units) })
          : t('electricity.readingSaved', { used: numeric(reading.usage_units), remaining: numeric(reading.closing_balance_units) }),
      })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.readingSaveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const getQuickReadingPreview = (account: AccountView, value: string) => {
    const context = getElectricityReadingContext(account, data?.readings.filter((reading) => reading.account_id === account.id) || [], quickReadingDate)
    const current = value.trim() ? Number(value) : Number.NaN
    const canSave = context.dateAfterBaseline && !context.duplicateDate && quickReadingDate <= todayISO()
      && Number.isFinite(current) && current >= context.previousMeterReading
      && (context.nextMeterReading === null || current <= context.nextMeterReading)
    const usage = canSave ? current - context.previousMeterReading : null
    const topups = data?.topups.filter((item) => item.account_id === account.id
      && item.status === 'verified'
      && item.purchase_date > context.previousReadingDate
      && item.purchase_date <= quickReadingDate).reduce((sum, item) => sum + Number(item.units), 0) || 0
    const adjustments = data?.adjustments.filter((item) => item.account_id === account.id
      && item.adjustment_date >= context.previousReadingDate
      && item.adjustment_date < quickReadingDate).reduce((sum, item) => sum + Number(item.adjustment_units), 0) || 0
    const remaining = account.meter_kind === 'submeter' && canSave && !context.isHistorical && usage !== null
      ? context.previousBalance + topups + adjustments - usage
      : null
    return { context, current, canSave, usage, remaining }
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
        unitsConfirmation: Number(topupUnitsConfirmation),
        tokenCode: formatLukuToken(tokenCode),
        tokenCodeConfirmation: formatLukuToken(tokenCodeConfirmation),
        purchaseAmountTzs: Number(topupPurchaseAmountTzs),
        notes: topupNotes,
      })
      setTopupUnits('')
      setTopupUnitsConfirmation('')
      setTokenCode('')
      setTokenCodeConfirmation('')
      setTopupPurchaseAmountTzs('')
      setTopupNotes('')
      setActionState({ type: 'success', message: t('electricity.topupReportedSaved') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.topupSaveFailed') })
    } finally {
      setSaving(false)
    }
  }

  const copyTopupToken = async (topup: TopupRow) => {
    if (!topup.token_code) return
    try {
      await navigator.clipboard.writeText(topup.token_code)
      setActionState({ type: 'success', message: t('electricity.tokenCopied') })
    } catch {
      setActionState({ type: 'error', message: t('electricity.copyFailed') })
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
          ? t('electricity.topupReconciled')
          : t('electricity.topupConfirmed'),
      })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.topupVerifyFailed') })
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
      setActionState({ type: 'success', message: t('electricity.actionRecorded') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.actionSaveFailed') })
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
      setActionState({ type: 'success', message: t('electricity.meterSetupSaved') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.meterSetupFailed') })
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
      setActionState({ type: 'success', message: t('electricity.staffLoginCreated') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.staffCreateFailed') })
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
      setActionState({ type: 'success', message: t('electricity.staffPropertiesUpdated') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.staffPropertiesFailed') })
    } finally {
      setSaving(false)
    }
  }

  const toggleStaff = async (staff: StaffRow) => {
    setSaving(true)
    try {
      await postJson('/api/electricity/staff', { id: staff.id, active: !staff.active }, 'PATCH')
      setActionState({ type: 'success', message: t(staff.active ? 'electricity.staffDeactivated' : 'electricity.staffReactivated') })
      await fetchData(false)
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.staffAccessFailed') })
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
      setActionState({ type: 'success', message: t('electricity.staffPinChanged') })
    } catch (error) {
      setActionState({ type: 'error', message: error instanceof Error ? error.message : t('electricity.staffPinFailed') })
    } finally {
      setSaving(false)
    }
  }

  const selectedRecordAccount = accounts.find((account) => account.id === recordAccountId) || null
  const selectedRecordContext = selectedRecordAccount
    ? getElectricityReadingContext(selectedRecordAccount, data?.readings.filter((reading) => reading.account_id === recordAccountId) || [], readingDate)
    : null
  const recordPreviousReading = selectedRecordContext?.previousMeterReading ?? 0
  const recordOpeningBalance = selectedRecordContext?.previousBalance ?? 0
  const applicablePendingAdjustments = data?.adjustments.filter((adjustment) =>
    adjustment.account_id === recordAccountId
    && adjustment.adjustment_date >= (selectedRecordContext?.previousReadingDate || '')
    && adjustment.adjustment_date < readingDate
  ).reduce((sum, adjustment) => sum + Number(adjustment.adjustment_units), 0) || 0
  const applicableVerifiedTopups = data?.topups.filter((topup) =>
    topup.account_id === recordAccountId
    && topup.status === 'verified'
    && topup.purchase_date > (selectedRecordContext?.previousReadingDate || '')
    && topup.purchase_date <= readingDate
  ).reduce((sum, topup) => sum + Number(topup.units), 0) || 0
  const effectiveOpeningBalance = Number(recordOpeningBalance)
  const parsedReadingValue = readingValue.trim() === '' ? Number.NaN : Number(readingValue)
  const readingWithinNeighbors = Boolean(selectedRecordContext
    && selectedRecordContext.dateAfterBaseline
    && !selectedRecordContext.duplicateDate
    && readingDate <= todayISO()
    && parsedReadingValue >= recordPreviousReading
    && (selectedRecordContext.nextMeterReading === null || parsedReadingValue <= selectedRecordContext.nextMeterReading))
  const readingPreview = readingWithinNeighbors
    ? calculateElectricityBalance({
        previousMeterReading: Number(recordPreviousReading),
        currentMeterReading: parsedReadingValue,
        openingBalanceUnits: effectiveOpeningBalance,
        verifiedTopupUnits: applicableVerifiedTopups,
        adjustmentUnits: applicablePendingAdjustments,
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
      setActionState({ type: 'error', message: t('electricity.noPhone', { tenant: account.tenant_name }) })
      return
    }
    const unitsLeft = numeric(account.estimated_balance_units)
    const readOn = account.latest_reading ? formatDate(account.latest_reading.reading_date) : t('electricity.latestCheck')
    const message = t('electricity.whatsAppTemplate', {
      tenant: account.tenant_name,
      unit: account.unit_name || account.floor_label,
      date: readOn,
      units: unitsLeft,
    })
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  if (loading) return <div className="py-16 text-center text-slate-500">{t('electricity.loadingWorkspace')}</div>

  if (!data) return (
    <div className="mx-auto max-w-2xl space-y-4 py-12 text-center">
      <Bolt className="mx-auto h-9 w-9 text-amber-500" />
      <h1 className="text-xl font-bold text-slate-950">{t('electricity.unavailable')}</h1>
      <p className="text-sm text-slate-600">{actionState?.message || t('electricity.checkMigrationAccess')}</p>
      <button className="btn-secondary" onClick={() => void fetchData()}><RefreshCw className="mr-2 h-4 w-4" />{t('electricity.tryAgain')}</button>
    </div>
  )

  const renderMeterCard = (account: AccountView) => {
    const isMain = account.meter_kind === 'floor_main'
    const status = isMain ? null : classifyElectricityBalance({
      balanceUnits: account.estimated_balance_units,
      lowThresholdUnits: Number(account.low_units_threshold),
      readingDate: account.latest_reading?.reading_date || null,
    })
    const presentation = status ? statusPresentation[status] : null
    const cutOff = account.last_cutoff_event?.action === 'disconnected'
    const balanceClass = status === 'exhausted' || status === 'low'
      ? 'border-rose-300 bg-rose-50 text-rose-950'
      : status === 'soon'
        ? 'border-amber-300 bg-amber-50 text-amber-950'
        : status === 'okay'
          ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
          : status === 'reading_due'
            ? 'border-slate-300 bg-slate-100 text-slate-900'
            : 'border-sky-300 bg-sky-50 text-sky-950'
    const displayedUnits = isMain
      ? account.latest_reading?.current_meter_reading ?? account.initial_meter_reading
      : account.estimated_balance_units
    const latestMainBalance = isMain ? latestMainBalanceByAccount.get(account.id) : null

    return <article key={account.id} className={`grid grid-cols-1 gap-3 border-l-4 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4 ${isMain ? 'border-l-sky-600 bg-sky-50/30' : 'border-l-emerald-600'}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-950">{accountTitle(account)}</h3><span className={`border px-2 py-1 text-xs font-semibold ${isMain ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{t(isMain ? 'electricity.floorMain' : 'electricity.clientSubmeter')}</span>{presentation && <span className={`border px-2 py-1 text-xs font-semibold ${presentation.className}`}>{t(presentation.labelKey)}</span>}{cutOff && <span className="border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">{t('electricity.disconnected')}</span>}</div>
        <p className="mt-1 text-sm text-slate-600">{account.property_name} · {account.unit_name || account.floor_label}{account.section_name ? ` · ${account.section_name}` : ''}{account.meter_number ? ` · Meter ${account.meter_number}` : ''}</p>
        <div className={`mt-3 flex min-h-[76px] items-center justify-between gap-3 border px-3 py-3 sm:min-h-[84px] sm:px-4 ${balanceClass}`}>
          <div className="min-w-0"><p className="text-xs font-semibold">{isMain ? t('electricity.currentMeterReading') : t('electricity.estimatedBalance')}</p>{status && <p className="mt-1 text-xs font-medium">{t(statusPresentation[status].labelKey)}</p>}<p className="mt-1 text-xs opacity-80">{account.latest_reading ? `${t('electricity.lastReading')} ${formatDate(account.latest_reading.reading_date)}` : `${t('electricity.baselineOn')} ${formatDate(account.initial_reading_date)}`}</p></div>
          <p className="flex shrink-0 items-baseline gap-1 tabular-nums"><span className="text-3xl font-bold leading-none sm:text-4xl">{numeric(displayedUnits)}</span><span className="text-sm font-semibold">kWh</span></p>
        </div>
        {isMain && <div className="mt-2 flex min-h-16 items-center justify-between gap-3 border-y border-sky-200 bg-sky-50 px-3 py-2.5 text-sky-950 sm:px-4">
          <div className="min-w-0"><p className="text-xs font-bold uppercase">{t('electricity.latestMainBalance')}</p><p className="mt-1 text-xs text-sky-800">{latestMainBalance ? formatDate(latestMainBalance.reading_date) : t('electricity.noMainBalances')}</p></div>
          <p className="shrink-0 text-2xl font-extrabold tabular-nums sm:text-3xl">{latestMainBalance ? numeric(latestMainBalance.units_remaining) : '—'}<span className="ml-1 text-sm font-semibold">kWh</span></p>
        </div>}
        {account.pending_reported_topup_units > 0 && <p className="mt-1 text-xs font-medium text-amber-700">{numeric(account.pending_reported_topup_units)} {t('electricity.pendingVerification')}</p>}
        {account.pending_adjustment_count > 0 && <p className="mt-1 text-xs font-medium text-blue-700">{numeric(account.pending_adjustment_units)} kWh {t('electricity.adjustmentPending')}</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setRecordAccountId(account.id); setActiveView('readings') }} className="btn-secondary min-h-11 flex-1 sm:flex-none">{t('electricity.recordReading')}</button>
        {data.ownerMode && !isMain && <button type="button" className="min-h-11 flex-1 border border-blue-300 bg-blue-50 px-3 text-sm font-semibold text-blue-900 hover:bg-blue-100 sm:flex-none" onClick={() => { setAdjustmentTarget(account); setAdjustmentUnits(''); setAdjustmentDirection('add'); setAdjustmentDate(todayISO()); setAdjustmentReason('') }}><Plus className="mr-2 inline h-4 w-4" />{t('electricity.ownerAddRemove')}</button>}
        {!isMain && account.tenant_phone && <button className="btn-secondary min-h-11 flex-1 sm:flex-none" onClick={() => draftNotice(account)}><MessageCircle className="mr-2 h-4 w-4" />{t('electricity.notify')}</button>}
        {!isMain && <button className={`min-h-11 border px-3 text-sm font-semibold ${cutOff ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`} onClick={() => submitManualAction(account)}>{cutOff ? t('electricity.logRestore') : t('electricity.logCutoff')}</button>}
      </div>
    </article>
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700"><Bolt className="h-4 w-4" />{t('electricity.metered')}</div>
          <h1 className="text-2xl font-bold text-slate-950">{t('electricity.title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">{t('electricity.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.ownerMode && <button className="btn-secondary min-h-11" onClick={() => setShowAccountSetup((show) => !show)}><Plus className="mr-2 h-4 w-4" />{t('electricity.setupMeter')}</button>}
          <button className="icon-button h-11 w-11" onClick={() => void fetchData()} aria-label={t('electricity.refresh')} title={t('electricity.refresh')}><RefreshCw className="h-4 w-4" /></button>
        </div>
      </header>

      {actionState && <div role="status" className={`flex items-start gap-2 border px-4 py-3 text-sm ${actionState.type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><span className="mt-0.5">{actionState.type === 'error' ? <CircleAlert className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span><span className="min-w-0 flex-1">{actionState.message}</span><button onClick={() => setActionState(null)} aria-label={t('electricity.dismissMessage')}><X className="h-4 w-4" /></button></div>}

      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-sm">
          <label className="label" htmlFor="electricity-property">{t('electricity.property')}</label>
          <select id="electricity-property" className="input min-h-11" value={propertyId} onChange={(event) => { setPropertyId(event.target.value); setMainBalanceAccountId('') }}>
            {data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
          </select>
        </div>
        <p className="text-xs text-slate-500">{t('electricity.balanceFreshness')}</p>
      </div>

      <section aria-label={t('electricity.chooseArea')} className="space-y-2">
        <div><h2 className="text-sm font-semibold text-slate-900">{t('electricity.chooseArea')}</h2><p className="mt-1 text-xs text-slate-500">{t('electricity.areaHelp')}</p></div>
        <nav role="tablist" aria-label={t('electricity.chooseArea')} className="grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:border-b sm:border-slate-200 sm:pb-2">
          {workspaceViews.map((view) => <button
            key={view.key}
            type="button"
            role="tab"
            aria-selected={activeView === view.key}
            onClick={() => setActiveView(view.key)}
            className={`min-h-11 border px-3 text-left text-sm font-semibold transition sm:shrink-0 sm:border-b-2 sm:border-x-0 sm:border-t-0 sm:text-center ${activeView === view.key ? 'border-primary-300 bg-primary-50 text-primary-700 sm:border-primary-600' : 'border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 sm:border-transparent'}`}
          >{view.label}</button>)}
        </nav>
      </section>

      {activeView === 'overview' && <section aria-label={t('electricity.overview')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label={t('electricity.activeSubmeters')} value={String(submeters.length)} detail={selectedProperty?.name || t('electricity.property')} />
        <Metric label={t('electricity.lowOrEmpty')} value={String(lowCount)} detail={t('electricity.reviewContact')} tone={lowCount ? 'danger' : 'normal'} />
        <Metric label={t('electricity.estimatedUnitsLeft')} value={numeric(verifiedReadingBalance)} detail={t('electricity.latestBalances')} />
        <Metric label={t('electricity.mainMeters')} value={String(mainMeters.length)} detail={t('electricity.sharedReadings')} />
      </section>}

      {activeView === 'overview' && mainMeters.length > 0 && <section aria-labelledby="main-meter-directory-heading" className="border-y border-slate-200 bg-white">
        <div className="flex items-end justify-between gap-3 px-4 py-3 sm:px-5">
          <div><h2 id="main-meter-directory-heading" className="text-base font-semibold text-slate-950">{t('electricity.quickReference')}</h2><p className="mt-1 text-sm text-slate-600">{selectedProperty?.name || t('electricity.property')} · {t('electricity.tapToCopy')}</p></div>
          <span className="shrink-0 text-sm text-slate-500">{mainMeters.length} {t('electricity.meters')}</span>
        </div>
        <div className="divide-y divide-slate-200">
          {mainMeters.map((account) => {
            const copied = copiedMeterAccountId === account.id
            return <div key={account.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0"><p className="font-medium text-slate-900">{account.floor_label}</p><p className="mt-0.5 break-all font-mono text-sm text-slate-600">{account.meter_number || t('electricity.numberMissing')}</p></div>
              <button type="button" className="icon-button h-11 w-11" onClick={() => void copyMeterNumber(account)} disabled={!account.meter_number} aria-label={copied ? `${account.floor_label}: ${t('electricity.copied')}` : `${t('electricity.copyMeter')}: ${account.floor_label}`} title={copied ? t('electricity.copied') : t('electricity.copyMeter')}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          })}
        </div>
        {selectedProperty?.name.trim().toLowerCase() === 'dora tower' && <p role="note" className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-5">{t('electricity.verifyMeterName')}</p>}
      </section>}

      {showAccountSetup && data.ownerMode && <section className="border border-slate-200 bg-white p-4 sm:p-6" aria-labelledby="meter-setup-heading">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div><h2 id="meter-setup-heading" className="text-lg font-semibold text-slate-950">{t('electricity.setupTitle')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.setupHelp')}</p></div>
          <button onClick={() => setShowAccountSetup(false)} className="icon-button" aria-label={t('electricity.closeSetup')}><X className="h-4 w-4" /></button>
        </div>
        <form onSubmit={submitAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t('electricity.property')}><select className="input" required value={accountForm.propertyId} onChange={(event) => { setAccountForm({ ...accountForm, propertyId: event.target.value, unitId: '', tenantId: '', floorLabel: '' }); setPropertyId(event.target.value) }}>{data.properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select></Field>
          <Field label={t('electricity.meterType')}><select className="input" value={accountForm.meterKind} onChange={(event) => setAccountForm({ ...accountForm, meterKind: event.target.value as AccountForm['meterKind'], unitId: '', tenantId: '' })}><option value="submeter">{t('electricity.clientSubmeter')}</option><option value="floor_main">{t('electricity.floorMain')}</option></select></Field>
          <Field label={accountForm.meterKind === 'submeter' ? t('electricity.floorGroup') : t('electricity.floorArea')}><input className="input" required maxLength={80} placeholder={t('electricity.floorLabelExample')} value={accountForm.floorLabel} onChange={(event) => setAccountForm({ ...accountForm, floorLabel: event.target.value })} /></Field>
          {accountForm.meterKind === 'submeter' && <>
            <Field label={t('electricity.unit')}><select required className="input" value={accountForm.unitId} onChange={(event) => {
              const unit = units.find((item) => item.id === event.target.value)
              const section = sections.find((item) => item.id === unit?.section_id)
              setAccountForm({ ...accountForm, unitId: event.target.value, floorLabel: accountForm.floorLabel || section?.name || '' })
            }}><option value="">{t('electricity.selectUnit')}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unit_name}{unit.unit_identifier ? ` (${unit.unit_identifier})` : ''}</option>)}</select></Field>
            <Field label={t('electricity.client')}><select required className="input" value={accountForm.tenantId} onChange={(event) => setAccountForm({ ...accountForm, tenantId: event.target.value })}><option value="">{t('electricity.selectClient')}</option>{data.tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.full_name || tenant.business_name || 'Unnamed client'}</option>)}</select></Field>
          </>}
          <Field label={t('electricity.meterNumberOptional')}><input className="input" maxLength={80} value={accountForm.meterNumber} onChange={(event) => setAccountForm({ ...accountForm, meterNumber: event.target.value })} /></Field>
          <Field label={t('electricity.startReading')}><input className="input" type="number" inputMode="decimal" min="0" step="0.001" required value={accountForm.initialMeterReading} onChange={(event) => setAccountForm({ ...accountForm, initialMeterReading: event.target.value })} /></Field>
          <Field label={t('electricity.startDate')}><input className="input" type="date" required value={accountForm.initialReadingDate} max={todayISO()} onChange={(event) => setAccountForm({ ...accountForm, initialReadingDate: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">{t('electricity.actualDateHelp')}</span></Field>
          {accountForm.meterKind === 'submeter' && <>
            <Field label={t('electricity.openingUnits')}><input className="input" type="number" inputMode="decimal" step="0.001" value={accountForm.openingBalanceUnits} onChange={(event) => setAccountForm({ ...accountForm, openingBalanceUnits: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">{t('electricity.openingUnitsHelp')}</span></Field>
            <Field label={t('electricity.lowThreshold')}><input className="input" type="number" inputMode="decimal" min="0" step="0.001" value={accountForm.lowUnitsThreshold} onChange={(event) => setAccountForm({ ...accountForm, lowUnitsThreshold: event.target.value })} /><span className="mt-1 block text-xs text-slate-500">{t('electricity.lowThresholdHelp')}</span></Field>
          </>}
          <div className="flex items-end"><button className="btn-primary min-h-11 w-full" disabled={saving}>{saving ? t('electricity.saving') : t('electricity.saveMeter')}</button></div>
        </form>
      </section>}

      {activeView === 'meters' && <section aria-labelledby="reconciliation-heading" className="scroll-mt-20 border-y border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 id="reconciliation-heading" className="text-lg font-semibold text-slate-950">{t('electricity.reconciliation')}</h2>
          <p className="mt-1 text-sm text-slate-600">{t('electricity.reconciliationHelp')}</p>
        </div>
        {reconciliations.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{t('electricity.addMainMeter')}</p> : <div className="divide-y divide-slate-200">
          {reconciliations.map((report) => {
            const statusText = report.status === 'baseline'
              ? t('electricity.baselineOnly')
              : report.status === 'unassigned'
                ? t('electricity.noSubmeters')
                : report.status === 'incomplete'
                  ? `${report.matchedSubmeterCount} / ${report.submeterAccounts.length} ${t('electricity.submetersMatchPeriod')}`
                  : report.status === 'balanced'
                    ? t('electricity.balanced')
                    : report.status === 'shortage'
                      ? `${numeric(report.difference || 0)} kWh ${t('electricity.unaccountedUnits')}`
                      : `${numeric(Math.abs(report.difference || 0))} kWh ${t('electricity.moreSubmeterThanMain')}`
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
                  <p className="mt-1 text-sm text-slate-600">{t('electricity.mainMeterReading')}: {numeric(report.mainCurrentReading)} kWh · {report.mainReading ? `${t('electricity.read')} ${formatDate(report.mainReading.reading_date)}` : `${t('electricity.baseline')} ${formatDate(report.mainAccount.initial_reading_date)}`}</p>
                  {report.periodStart && report.periodEnd && <p className="mt-1 text-xs text-slate-500">{t('electricity.period')} {formatDate(report.periodStart)} - {formatDate(report.periodEnd)}</p>}
                  {report.status === 'incomplete' && <p className="mt-1 text-xs text-amber-800">{t('electricity.stillNeed')}: {report.unmatchedSubmeters.map((account) => account.tenant_name || t('electricity.clientSubmeter')).join(', ')}. {t('electricity.noFinalShortfall')}</p>}
                  {report.status === 'baseline' && <p className="mt-1 text-xs text-slate-500">{t('electricity.baselineExplanation')}</p>}
                </div>
                {report.mainUsage !== null && <dl className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm sm:min-w-64">
                  <dt className="text-slate-500">{t('electricity.mainUnitsUsed')}</dt><dd className="text-right font-semibold text-slate-900">{numeric(report.mainUsage)} kWh</dd>
                  <dt className="text-slate-500">{t('electricity.submeterUnitsMatched')}</dt><dd className="text-right font-semibold text-slate-900">{report.submeterUsage === null ? t('electricity.pending') : `${numeric(report.submeterUsage)} kWh`}</dd>
                  {report.status === 'shortage' && <><dt className="font-semibold text-rose-800">{t('electricity.unaccountedUnits')}</dt><dd className="text-right font-bold text-rose-800">{numeric(report.difference || 0)} kWh</dd></>}
                  {report.status === 'excess' && <><dt className="font-semibold text-amber-800">{t('electricity.submeterExcess')}</dt><dd className="text-right font-bold text-amber-800">{numeric(Math.abs(report.difference || 0))} kWh</dd></>}
                </dl>}
              </div>
              {report.submeterAccounts.length > 0 && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-500">{report.submeterAccounts.map((account) => {
                const matched = !report.unmatchedSubmeters.some((item) => item.id === account.id)
                const matchingReading = data.readings.find((reading) => reading.account_id === account.id && reading.previous_reading_date === report.periodStart && reading.reading_date === report.periodEnd)
                return <span key={account.id}>{account.tenant_name || t('electricity.client')}: {matchingReading ? `${numeric(matchingReading.usage_units)} kWh` : matched ? t('electricity.matched') : t('electricity.readingNeeded')}</span>
              })}</div>}
            </article>
          })}
        </div>}
      </section>}

      {activeView === 'overview' && <section id="attention" aria-labelledby="attention-heading" className="scroll-mt-20">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="attention-heading" className="text-lg font-semibold text-slate-950">{t('electricity.needsAttention')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.attentionHelp')}</p></div><span className="text-sm font-semibold text-slate-500">{attention.length} {t('electricity.items')}</span></div>
        {attention.length === 0 ? <div className="border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">{t('electricity.noAttention')}</div> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {attention.map(({ account, status }) => {
            const presentation = statusPresentation[status]
            const StatusIcon = presentation.icon
            return <article key={account.id} className="grid grid-cols-1 gap-3 px-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-slate-950">{account.tenant_name}</h3><span className={`inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold ${presentation.className}`}><StatusIcon className="h-3.5 w-3.5" />{t(presentation.labelKey)}</span></div>
                <p className="mt-1 text-sm text-slate-600">{account.unit_name || account.floor_label} · {account.section_name || account.floor_label}</p>
                <p className="mt-1 text-xs text-slate-500">{t('electricity.estimate')}: <strong className="text-slate-800">{numeric(account.estimated_balance_units)} kWh</strong> · {t('electricity.lastChecked')} {account.latest_reading ? formatDate(account.latest_reading.reading_date) : t('electricity.notYetRead')}{account.pending_reported_topup_units > 0 ? ` · ${numeric(account.pending_reported_topup_units)} ${t('electricity.reportedUnverified')}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {account.tenant_phone && <button className="btn-secondary min-h-11 flex-1 sm:flex-none" onClick={() => draftNotice(account)}><MessageCircle className="mr-2 h-4 w-4" />{t('electricity.draftWhatsApp')}</button>}
                {status === 'exhausted' && account.last_cutoff_event?.action !== 'disconnected' && <button className="min-h-11 border border-rose-300 px-3 text-sm font-semibold text-rose-800 hover:bg-rose-50" onClick={() => submitManualAction(account)}>{t('electricity.logCutoff')}</button>}
                {status === 'reading_due' && <a className="btn-secondary min-h-11" href="#record">{t('electricity.recordCheck')}</a>}
              </div>
            </article>
          })}
        </div>}
      </section>}

      {activeView === 'readings' && <section id="record" className="scroll-mt-20 border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="record-heading">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-amber-50 text-amber-700"><Gauge className="h-5 w-5" /></span><div><h2 id="record-heading" className="text-lg font-semibold text-slate-950">{t('electricity.recordReadingTitle')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.recordReadingHelp')}</p></div></div>
          <form onSubmit={submitReading} className="space-y-4">
            <Field label={t('electricity.meterType')}><select required className="input min-h-11" value={recordAccountId} onChange={(event) => setRecordAccountId(event.target.value)}><option value="">{t('electricity.selectMeter')}</option>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.meter_kind === 'floor_main' ? `${account.floor_label} · ${t('electricity.mainMeter')}` : `${account.tenant_name} · ${account.unit_name || account.floor_label}`}</option>)}</select></Field>
            {selectedRecordAccount && <div className="grid grid-cols-2 gap-3 border border-slate-200 bg-slate-50 p-3 text-sm">
              <div><p className="text-xs text-slate-500">{t('electricity.previousReading')}</p><p className="mt-1 font-semibold text-slate-950">{numeric(recordPreviousReading)} kWh</p></div>
              <div><p className="text-xs text-slate-500">{t('electricity.startingBalance')}</p><p className="mt-1 font-semibold text-slate-950">{selectedRecordAccount.meter_kind === 'floor_main' ? t('electricity.notApplicable') : `${numeric(effectiveOpeningBalance + applicableVerifiedTopups + applicablePendingAdjustments)} kWh`}</p></div>
            </div>}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('electricity.currentReading')}><input required className="input min-h-11" type="number" inputMode="decimal" min="0" step="0.001" value={readingValue} onChange={(event) => setReadingValue(event.target.value)} /></Field>
              <Field label={t('electricity.readingDate')}><input required className="input min-h-11" type="date" max={todayISO()} value={readingDate} onChange={(event) => setReadingDate(event.target.value)} /></Field>
            </div>
            <Field label={t('electricity.noteOptional')}><input className="input min-h-11" maxLength={500} placeholder={t('electricity.readingNotePlaceholder')} value={readingNotes} onChange={(event) => setReadingNotes(event.target.value)} /></Field>
            {selectedRecordAccount && readingPreview && <div className="grid grid-cols-2 gap-3 border border-amber-200 bg-amber-50 p-3 text-sm">
              <div><p className="text-xs text-amber-800">{t('electricity.calculatedUsage')}</p><p className="mt-1 font-bold text-slate-950">{numeric(readingPreview.usageUnits)} kWh</p></div>
              <div><p className="text-xs text-amber-800">{t('electricity.unitsRemaining')}</p><p className={`mt-1 font-bold ${readingPreview.closingBalanceUnits <= selectedRecordAccount.low_units_threshold ? 'text-rose-700' : 'text-slate-950'}`}>{selectedRecordAccount.meter_kind === 'floor_main' ? t('electricity.mainMeterOnly') : `${numeric(readingPreview.closingBalanceUnits)} kWh`}</p></div>
            </div>}
            {selectedRecordAccount && !readingValue.trim() && <p className="text-sm text-slate-600">{t('electricity.enterReadingPreview')}</p>}
            {selectedRecordAccount && readingPreview && selectedRecordContext?.isHistorical && <p className="border-l-2 border-blue-500 bg-blue-50 px-3 py-2 text-sm text-blue-900">{t('electricity.recalculatedAfterSave')}</p>}
            {selectedRecordAccount && readingValue.trim() && selectedRecordContext?.duplicateDate && <p className="text-sm text-rose-700">{t('electricity.existingSessionDate')}</p>}
            {selectedRecordAccount && readingValue.trim() && selectedRecordContext && selectedRecordContext.nextMeterReading !== null && parsedReadingValue > selectedRecordContext.nextMeterReading && <p className="text-sm text-rose-700">{t('electricity.readingAboveNext')} {numeric(selectedRecordContext.nextMeterReading)} kWh ({formatDate(selectedRecordContext.nextReadingDate!)}).</p>}
            {selectedRecordAccount && readingValue.trim() && !readingPreview && !selectedRecordContext?.duplicateDate && !selectedRecordContext?.dateAfterBaseline && <p className="text-sm text-rose-700">{t('electricity.chooseLaterReadingDate')}</p>}
            {selectedRecordAccount && readingValue.trim() && !readingPreview && !selectedRecordContext?.duplicateDate && selectedRecordContext?.dateAfterBaseline && parsedReadingValue < recordPreviousReading && <p className="text-sm text-rose-700">{t('electricity.readingBelowPrevious')} ({numeric(recordPreviousReading)}).</p>}
            <button className="btn-primary min-h-12 w-full sm:w-auto" disabled={saving || !selectedRecordAccount || !readingPreview}>{saving ? t('electricity.saving') : t('electricity.saveReading')}</button>
          </form>
      </section>}

      {activeView === 'readings' && <section className="border-y border-slate-200 bg-white" aria-labelledby="quick-sheet-heading">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
          <div className="min-w-0"><h2 id="quick-sheet-heading" className="text-lg font-semibold text-slate-950">{t('electricity.quickEntrySheet')}</h2><p className="mt-1 max-w-2xl text-sm text-slate-600">{t('electricity.quickEntryHelp')}</p><p className="mt-1 text-xs font-medium text-blue-800">{t('electricity.historicalSessionHelp')}</p></div>
          <div className="grid w-full gap-3 sm:max-w-xl sm:grid-cols-2"><Field label={t('electricity.visitDate')}><input className="input min-h-11" type="date" value={quickReadingDate} max={todayISO()} onChange={(event) => setQuickReadingDate(event.target.value)} /></Field><Field label={t('electricity.quickSessionNote')}><input className="input min-h-11" maxLength={500} value={quickReadingNotes} onChange={(event) => setQuickReadingNotes(event.target.value)} /></Field></div>
        </div>
        {activeAccounts.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{t('electricity.noMeters')}</p> : <>
          <div className="divide-y divide-slate-200 md:hidden">
            {activeAccounts.map((account) => {
              const value = quickReadingValues[account.id] || ''
              const { context, canSave, usage, remaining } = getQuickReadingPreview(account, value)
              return <article key={account.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-slate-950">{account.meter_kind === 'floor_main' ? account.floor_label : account.tenant_name}</h3><p className="truncate text-xs text-slate-500">{account.unit_name || account.floor_label} · {account.meter_kind === 'floor_main' ? t('electricity.floorMain') : t('electricity.clientSubmeter')}</p></div><span className="shrink-0 text-xs text-slate-500">{t('electricity.previousReading')}: {numeric(context.previousMeterReading)}</span></div>
                <div className="grid grid-cols-2 gap-3"><Field label={t('electricity.currentMeterReading')}><input className="input min-h-11" type="number" inputMode="decimal" min={context.previousMeterReading} max={context.nextMeterReading ?? undefined} step="0.001" value={value} onChange={(event) => setQuickReadingValues((currentValues) => ({ ...currentValues, [account.id]: event.target.value }))} /></Field><div className="self-end border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-xs text-slate-500">{t('electricity.unitsConsumed')}</p><p className="mt-1 font-semibold text-slate-900">{usage === null ? '—' : `${numeric(usage)} kWh`}</p></div></div>
                <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-600">{t('electricity.carriedForward')}: <strong>{remaining === null ? (account.meter_kind === 'floor_main' ? t('electricity.mainMeterOnly') : context.isHistorical && canSave ? t('electricity.recalculatedAfterSave') : '—') : `${numeric(remaining)} kWh`}</strong></p><button type="button" className="btn-primary min-h-11 shrink-0" disabled={saving || !canSave} onClick={() => void submitQuickReading(account)}>{saving ? t('electricity.saving') : t('electricity.saveMeterRow')}</button></div>
                {value && context.duplicateDate && <p className="text-xs text-rose-700">{t('electricity.existingSessionDate')}</p>}
                {value && context.nextMeterReading !== null && Number(value) > context.nextMeterReading && <p className="text-xs text-rose-700">{t('electricity.readingAboveNext')} {numeric(context.nextMeterReading)} kWh ({formatDate(context.nextReadingDate!)}).</p>}
                {value && !context.dateAfterBaseline && <p className="text-xs text-rose-700">{t('electricity.chooseLaterReadingDate')}</p>}
                {value && context.dateAfterBaseline && Number(value) < context.previousMeterReading && <p className="text-xs text-rose-700">{t('electricity.readingBelowPrevious')} ({numeric(context.previousMeterReading)}).</p>}
              </article>
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[900px] w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600"><tr><th className="px-4 py-3">{t('electricity.client')}</th><th className="px-4 py-3">{t('electricity.previousReading')}</th><th className="px-4 py-3">{t('electricity.currentMeterReading')}</th><th className="px-4 py-3">{t('electricity.unitsConsumed')}</th><th className="px-4 py-3">{t('electricity.carriedForward')}</th><th className="px-4 py-3"><span className="sr-only">{t('electricity.saveMeterRow')}</span></th></tr></thead>
              <tbody className="divide-y divide-slate-100">{activeAccounts.map((account) => {
                const value = quickReadingValues[account.id] || ''
                const { context, canSave, usage, remaining } = getQuickReadingPreview(account, value)
                return <tr key={account.id}>
                  <td className="px-4 py-3"><p className="font-medium text-slate-900">{account.meter_kind === 'floor_main' ? account.floor_label : account.tenant_name}</p><p className="text-xs text-slate-500">{account.unit_name || account.floor_label}</p></td><td className="whitespace-nowrap px-4 py-3">{numeric(context.previousMeterReading)} kWh</td><td className="w-52 px-4 py-3"><input aria-label={`${t('electricity.currentMeterReading')} ${accountTitle(account)}`} className="input min-h-11" type="number" inputMode="decimal" min={context.previousMeterReading} max={context.nextMeterReading ?? undefined} step="0.001" value={value} onChange={(event) => setQuickReadingValues((currentValues) => ({ ...currentValues, [account.id]: event.target.value }))} /></td><td className="whitespace-nowrap px-4 py-3">{usage === null ? '—' : `${numeric(usage)} kWh`}</td><td className="whitespace-nowrap px-4 py-3 font-semibold">{remaining === null ? (account.meter_kind === 'floor_main' ? t('electricity.mainMeterOnly') : context.isHistorical && canSave ? t('electricity.recalculatedAfterSave') : '—') : `${numeric(remaining)} kWh`}</td><td className="px-4 py-3"><button type="button" className="btn-primary min-h-11 whitespace-nowrap" disabled={saving || !canSave} onClick={() => void submitQuickReading(account)}>{saving ? t('electricity.saving') : t('electricity.saveMeterRow')}</button></td>
                </tr>
              })}</tbody>
            </table>
          </div>
        </>}
      </section>}

      {activeView === 'readings' && <section className="border-y border-slate-200 bg-white" aria-labelledby="sessions-heading">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 id="sessions-heading" className="font-semibold text-slate-950">{t('electricity.savedSessions')}</h2><p className="mt-1 text-xs text-slate-500">{t('electricity.sessionHistoryHelp')}</p></div><button type="button" className="btn-secondary min-h-11" onClick={() => setActiveView('reports')}>{t('electricity.viewFullLedger')}</button></div>
        {readingSessions.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{t('electricity.noSessions')}</p> : <div className="divide-y divide-slate-200">
          {readingSessions.slice(0, 12).map((session) => <section key={session.date} aria-label={formatDate(session.date)}>
            <div className="flex items-center justify-between gap-3 bg-slate-50 px-4 py-2"><h3 className="font-semibold text-slate-900">{formatDate(session.date)}</h3><span className="text-xs text-slate-500">{t('electricity.sessionCount', { count: session.rows.length })}</span></div>
            <div className="divide-y divide-slate-100">{session.rows.map((reading) => {
              const account = accountById.get(reading.account_id)
              if (!account) return null
              const staff = data.staff.find((item) => item.auth_user_id === reading.recorded_by)
              const recordedBy = staff?.full_name || (reading.recorded_by === data.currentUserId
                ? data.currentStaffId || t('electricity.propertyOwner')
                : reading.recorded_by.slice(0, 8))
              const isMain = account.meter_kind === 'floor_main'
              return <article key={reading.id} className={`grid grid-cols-2 gap-3 border-l-4 px-4 py-3 sm:grid-cols-[minmax(0,1.5fr)_1fr_1fr_1fr_1fr] ${isMain ? 'border-l-sky-600' : 'border-l-emerald-600'}`}>
                <div className="min-w-0"><p className="truncate font-semibold text-slate-950">{accountTitle(account)}</p><span className={`mt-1 inline-block border px-2 py-0.5 text-xs font-semibold ${isMain ? 'border-sky-200 bg-sky-50 text-sky-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{t(isMain ? 'electricity.floorMain' : 'electricity.clientSubmeter')}</span>{reading.notes && <p className="mt-1 break-words text-xs text-slate-600">{reading.notes}</p>}</div>
                <LedgerValue label={t('electricity.previousReading')} value={`${numeric(reading.previous_meter_reading)} kWh`} />
                <LedgerValue label={t('electricity.currentMeterReading')} value={`${numeric(reading.current_meter_reading)} kWh`} />
                <LedgerValue label={t('electricity.unitsConsumed')} value={`${numeric(reading.usage_units)} kWh`} />
                <div><LedgerValue label={t('electricity.carriedForward')} value={reading.closing_balance_units === null ? t('electricity.mainMeterOnly') : `${numeric(reading.closing_balance_units)} kWh`} emphasized /><p className="mt-1 text-xs text-slate-500">{t('electricity.readingBy')} {recordedBy}</p></div>
              </article>
            })}</div>
          </section>)}
        </div>}
      </section>}

      {activeView === 'topups' && <section id="topups" className="scroll-mt-20 border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="topup-heading">
          <div className="mb-4 flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center bg-emerald-50 text-emerald-700"><Bolt className="h-5 w-5" /></span><div><h2 id="topup-heading" className="text-lg font-semibold text-slate-950">{t('electricity.topupTitle')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.topupHelp')}</p></div></div>
          <form onSubmit={submitTopup} className="space-y-4">
            <Field label={t('electricity.clientSubmeter')}><select required className="input min-h-11" value={topupAccountId} onChange={(event) => setTopupAccountId(event.target.value)}><option value="">{t('electricity.selectClient')}</option>{submeters.map((account) => <option key={account.id} value={account.id}>{account.tenant_name} · {account.unit_name || account.floor_label}</option>)}</select></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('electricity.purchaseDate')}><input required className="input min-h-11" type="date" value={topupDate} onChange={(event) => setTopupDate(event.target.value)} /></Field>
              <Field label={t('electricity.unitsLoaded')}><input required className="input min-h-11" type="number" inputMode="decimal" min="0.001" step="0.001" value={topupUnits} onChange={(event) => setTopupUnits(event.target.value)} /></Field>
              <Field label={t('electricity.confirmUnits')}><input required className="input min-h-11" type="number" inputMode="decimal" min="0.001" step="0.001" value={topupUnitsConfirmation} onChange={(event) => setTopupUnitsConfirmation(event.target.value)} />{topupUnitsConfirmation && !topupAmountMatches && <span className="mt-1 block text-xs text-rose-700">{t('electricity.unitsMismatch')}</span>}</Field>
              <Field label={t('electricity.purchaseValueTzs')}><input required className="input min-h-11" type="number" inputMode="decimal" min="0.01" max="1000000000" step="0.01" value={topupPurchaseAmountTzs} onChange={(event) => setTopupPurchaseAmountTzs(event.target.value)} /><span className="mt-1 block text-xs text-slate-500">{t('electricity.purchaseValueHelp')}</span></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label={t('electricity.tokenCode')}><input required className="input min-h-11 font-mono tabular-nums" type="text" inputMode="numeric" autoComplete="off" maxLength={40} value={formatLukuToken(tokenCode)} onChange={(event) => setTokenCode(digitsOnlyLukuToken(event.target.value))} />{tokenCode && tokenCode.length !== 20 ? <span className="mt-1 block text-xs text-rose-700">{t('electricity.tokenLengthError')}</span> : <span className="mt-1 block text-xs text-slate-500">{t('electricity.tokenFormatHelp')}</span>}</Field>
              <Field label={t('electricity.confirmTokenCode')}><input required className="input min-h-11 font-mono tabular-nums" type="text" inputMode="numeric" autoComplete="off" maxLength={40} value={formatLukuToken(tokenCodeConfirmation)} onChange={(event) => setTokenCodeConfirmation(digitsOnlyLukuToken(event.target.value))} />{tokenCodeConfirmation && tokenCodeConfirmation.length !== 20 ? <span className="mt-1 block text-xs text-rose-700">{t('electricity.tokenLengthError')}</span> : tokenCodeConfirmation && !topupTokenMatches && <span className="mt-1 block text-xs text-rose-700">{t('electricity.tokenMismatch')}</span>}</Field>
            </div>
            <p className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('electricity.topupDoubleCheck')}</p>
            <Field label={t('electricity.noteOptional')}><input className="input min-h-11" maxLength={500} placeholder={t('electricity.receiptNote')} value={topupNotes} onChange={(event) => setTopupNotes(event.target.value)} /></Field>
            <button className="btn-secondary min-h-12 w-full sm:w-auto" disabled={saving || !submeters.length || !topupAccountId || !topupReady}>{saving ? t('electricity.saving') : t('electricity.recordTopup')}</button>
          </form>
          <section className="mt-5 border-t border-slate-200 pt-4" aria-labelledby="topup-history-heading">
            <h3 id="topup-history-heading" className="mb-2 text-sm font-semibold text-slate-900">{t('electricity.topupHistory')}</h3>
            {propertyTopups.length === 0 ? <p className="py-3 text-sm text-slate-500">{t('electricity.noTopups')}</p> : <div className="divide-y divide-slate-100">
              {propertyTopups.slice(0, 30).map((topup) => {
                const tokenVisible = visibleTopupTokenIds.has(topup.id)
                return <div key={topup.id} className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="font-medium text-slate-900">{accountById.get(topup.account_id)?.tenant_name} · {numeric(topup.units)} kWh · {typeof topup.purchase_amount_tzs === 'number' ? formatCurrency(topup.purchase_amount_tzs, 'TZS') : '—'}</p><p className="text-xs text-slate-500">{formatDate(topup.purchase_date)}{topup.token_suffix ? ` · •••• ${topup.token_suffix}` : ''} · {topup.status === 'verified' ? t('electricity.verified') : t('electricity.reportedNotVerified')}</p>
                  {topup.token_code ? <div className="mt-2 flex flex-wrap items-center gap-2">
                    {tokenVisible && <code className="rounded bg-slate-100 px-2 py-1 font-mono text-sm tracking-wide text-slate-900">{formatLukuToken(topup.token_code)}</code>}
                    <button type="button" className="min-h-10 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-expanded={tokenVisible} onClick={() => setVisibleTopupTokenIds((current) => {
                      const next = new Set(current)
                      if (next.has(topup.id)) next.delete(topup.id)
                      else next.add(topup.id)
                      return next
                    })}>{t(tokenVisible ? 'electricity.hideFullToken' : 'electricity.showFullToken')}</button>
                    {tokenVisible && <button type="button" className="min-h-10 border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50" aria-label={t('electricity.copyFullToken')} onClick={() => void copyTopupToken(topup)}><Copy className="h-4 w-4" /></button>}
                  </div> : <p className="mt-1 text-xs text-slate-500">{t('electricity.tokenNotStored')}</p>}
                </div>
                {topup.status === 'reported' && <button type="button" className="min-h-10 self-start border border-emerald-300 px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 sm:self-auto" disabled={saving} onClick={() => void verifyTopup(topup)}>{t('electricity.confirm')}</button>}
              </div>})}
            </div>}
          </section>
        </section>}

      {activeView === 'reports' && <section id="electricity-ledger" className="space-y-4 scroll-mt-20" aria-labelledby="ledger-heading">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><h2 id="ledger-heading" className="text-lg font-semibold text-slate-950">{t('electricity.weeklyReport')}</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">{t('electricity.weeklyReportHelp')}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary min-h-11" onClick={downloadReport} disabled={!reportRows.length}><Download className="mr-2 h-4 w-4" />{t('electricity.downloadCsv')}</button><button type="button" className="btn-secondary min-h-11" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />{t('electricity.printReport')}</button></div>
        </header>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('electricity.fromDate')}><input className="input min-h-11" type="date" value={reportStartDate} max={reportEndDate} onChange={(event) => setReportStartDate(event.target.value)} /></Field>
          <Field label={t('electricity.toDate')}><input className="input min-h-11" type="date" value={reportEndDate} min={reportStartDate} max={todayISO()} onChange={(event) => setReportEndDate(event.target.value)} /></Field>
          <Field label={t('electricity.weeklyTarget')}><select className="input min-h-11" value={weeklyTarget} onChange={(event) => setWeeklyTarget(Number(event.target.value) as 2 | 3)}><option value={2}>{t('electricity.targetTwo')}</option><option value={3}>{t('electricity.targetThree')}</option></select></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label={t('electricity.activeClients')} value={String(submeters.length)} detail={selectedProperty?.name || t('electricity.property')} />
          <Metric label={t('electricity.readingsThisWeek')} value={String(Array.from(weeklyReadingsByAccount.values()).reduce((sum, count) => sum + count, 0))} detail={t('electricity.weeklyTargetHelp')} />
          <Metric label={t('electricity.clientsOnTrack')} value={String(clientsOnTrack)} detail={`${t('electricity.weeklyTarget')}: ${weeklyTarget}`} tone="normal" />
          <Metric label={t('electricity.clientsNeedReadings')} value={String(clientsNeedingReadings)} detail={t('electricity.noTargetYet')} tone={clientsNeedingReadings ? 'danger' : 'normal'} />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Metric label={t('electricity.periodTotals')} value={`${numeric(reportTotals.usage)} kWh`} detail={t('electricity.unitsConsumed')} />
          <Metric label={t('electricity.unitsPurchased')} value={`${numeric(reportTotals.purchased)} kWh`} detail={`${numeric(reportTotals.verified)} ${t('electricity.unitsVerified')}`} />
          <Metric label={t('electricity.purchaseValueTzs')} value={formatCurrency(reportTotals.purchaseValueTzs, 'TZS')} detail={t('electricity.purchaseValueHelp')} />
          <Metric label={t('electricity.unitsReported')} value={`${numeric(reportTotals.reported)} kWh`} detail={t('electricity.awaitingMeterCheck')} />
          <Metric label={t('electricity.carriedForward')} value={`${numeric(reportTotals.carried)} kWh`} detail={`${t('electricity.adjustmentAmount')}: ${reportTotals.adjustments > 0 ? '+' : ''}${numeric(reportTotals.adjustments)}`} />
        </div>
        <section className="border-y border-slate-200 bg-white" aria-labelledby="reading-coverage-heading">
          <div className="border-b border-slate-200 px-4 py-3"><h3 id="reading-coverage-heading" className="font-semibold text-slate-900">{t('electricity.weeklyTarget')}</h3></div>
          <div className="divide-y divide-slate-100">
            {submeters.map((account) => {
              const count = weeklyReadingsByAccount.get(account.id) || 0
              const complete = count >= weeklyTarget
              return <div key={account.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-slate-900">{account.tenant_name}</p><p className="truncate text-xs text-slate-500">{account.unit_name || account.floor_label}</p></div>
                <span className={`shrink-0 border px-2 py-1 text-xs font-semibold ${complete ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{count}/{weeklyTarget} · {complete ? t('electricity.clientsOnTrack') : t('electricity.clientsNeedReadings')}</span>
              </div>
            })}
            {submeters.length === 0 && <p className="px-4 py-5 text-sm text-slate-500">{t('electricity.noMeters')}</p>}
          </div>
        </section>
        <section className="border-y border-slate-200 bg-white" aria-label={t('electricity.weeklyReport')}>
          {reportRows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">{t('electricity.noReadingsForPeriod')}</p> : <>
            <div className="divide-y divide-slate-200 md:hidden">
              {reportRows.map(({ id, account, reading, periodStart, unitsPurchased, purchaseValueTzs, verifiedTopupUnits, reportedTopupUnits, cutoffReading, adjustmentUnits }) => <article key={id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-slate-950">{account.tenant_name}</h3><p className="truncate text-xs text-slate-500">{account.unit_name || account.floor_label} · {formatDate(reading.reading_date)}</p></div><span className="shrink-0 border border-slate-200 px-2 py-1 text-xs text-slate-600">{account.meter_kind === 'floor_main' ? t('electricity.floorMain') : t('electricity.clientSubmeter')}</span></div>
                <p className="text-xs text-slate-600">{formatDate(periodStart)} {t('electricity.to')} {formatDate(reading.reading_date)}</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <LedgerValue label={t('electricity.previousReading')} value={`${numeric(reading.previous_meter_reading)} kWh`} />
                  <LedgerValue label={t('electricity.currentMeterReading')} value={`${numeric(reading.current_meter_reading)} kWh`} />
                  <LedgerValue label={t('electricity.broughtForward')} value={reading.opening_balance_units === null ? '—' : `${numeric(reading.opening_balance_units)} kWh`} />
                  <LedgerValue label={t('electricity.unitsConsumed')} value={`${numeric(reading.usage_units)} kWh`} />
                  <LedgerValue label={t('electricity.unitsPurchased')} value={`${numeric(unitsPurchased)} kWh`} />
                  <LedgerValue label={t('electricity.purchaseValueTzs')} value={formatCurrency(purchaseValueTzs, 'TZS')} />
                  <LedgerValue label={t('electricity.unitsVerified')} value={`${numeric(verifiedTopupUnits)} kWh`} />
                  <LedgerValue label={t('electricity.unitsReported')} value={`${numeric(reportedTopupUnits)} kWh`} />
                  <LedgerValue label={t('electricity.cutoffReading')} value={cutoffReading === null ? '—' : `${numeric(cutoffReading)} kWh`} />
                  <LedgerValue label={t('electricity.adjustmentAmount')} value={`${adjustmentUnits > 0 ? '+' : ''}${numeric(adjustmentUnits)} kWh`} />
                  <LedgerValue label={t('electricity.carriedForward')} value={reading.closing_balance_units === null ? '—' : `${numeric(reading.closing_balance_units)} kWh`} emphasized />
                </div>
              </article>)}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[1600px] w-full border-collapse text-left text-xs">
                <thead className="bg-slate-50 text-slate-600"><tr>{['electricity.client', 'electricity.unit', 'electricity.period', 'electricity.previousReading', 'electricity.currentMeterReading', 'electricity.broughtForward', 'electricity.unitsConsumed', 'electricity.unitsPurchased', 'electricity.purchaseValueTzs', 'electricity.unitsVerified', 'electricity.unitsReported', 'electricity.cutoffReading', 'electricity.adjustmentAmount', 'electricity.carriedForward'].map((key) => <th key={key} className="whitespace-nowrap border-b border-slate-200 px-3 py-3 font-semibold">{t(key as TranslationKey)}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100">{reportRows.map(({ id, account, reading, periodStart, unitsPurchased, purchaseValueTzs, verifiedTopupUnits, reportedTopupUnits, cutoffReading, adjustmentUnits }) => <tr key={id}>
                  <td className="whitespace-nowrap px-3 py-3 font-medium text-slate-900">{account.tenant_name}</td><td className="whitespace-nowrap px-3 py-3">{account.unit_name || account.floor_label}</td><td className="whitespace-nowrap px-3 py-3">{formatDate(periodStart)} {t('electricity.to')} {formatDate(reading.reading_date)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reading.previous_meter_reading)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reading.current_meter_reading)}</td><td className="whitespace-nowrap px-3 py-3">{reading.opening_balance_units === null ? '—' : numeric(reading.opening_balance_units)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reading.usage_units)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(unitsPurchased)}</td><td className="whitespace-nowrap px-3 py-3">{formatCurrency(purchaseValueTzs, 'TZS')}</td><td className="whitespace-nowrap px-3 py-3">{numeric(verifiedTopupUnits)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reportedTopupUnits)}</td><td className="whitespace-nowrap px-3 py-3">{cutoffReading === null ? '—' : numeric(cutoffReading)}</td><td className="whitespace-nowrap px-3 py-3">{adjustmentUnits > 0 ? '+' : ''}{numeric(adjustmentUnits)}</td><td className="whitespace-nowrap px-3 py-3 font-semibold">{reading.closing_balance_units === null ? '—' : numeric(reading.closing_balance_units)}</td>
                </tr>)}</tbody>
                <tfoot className="bg-slate-50 font-semibold text-slate-900"><tr><th colSpan={6} className="whitespace-nowrap px-3 py-3 text-left">{t('electricity.periodTotals')}</th><td className="whitespace-nowrap px-3 py-3">{numeric(reportTotals.usage)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reportTotals.purchased)}</td><td className="whitespace-nowrap px-3 py-3">{formatCurrency(reportTotals.purchaseValueTzs, 'TZS')}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reportTotals.verified)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reportTotals.reported)}</td><td className="px-3 py-3">—</td><td className="whitespace-nowrap px-3 py-3">{reportTotals.adjustments > 0 ? '+' : ''}{numeric(reportTotals.adjustments)}</td><td className="whitespace-nowrap px-3 py-3">{numeric(reportTotals.carried)}</td></tr></tfoot>
              </table>
            </div>
          </>}
        </section>
        <section className="border-y border-slate-200 bg-white" aria-labelledby="adjustment-history-heading">
          <div className="border-b border-slate-200 px-4 py-3"><h3 id="adjustment-history-heading" className="font-semibold text-slate-900">{t('electricity.adjustmentHistory')}</h3></div>
          {data.adjustments.filter((adjustment) => accountById.has(adjustment.account_id)).length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">{t('electricity.noAdjustments')}</p> : <div className="divide-y divide-slate-100">{data.adjustments.filter((adjustment) => accountById.has(adjustment.account_id)).map((adjustment) => {
            const account = accountById.get(adjustment.account_id)
            const staff = data.staff.find((item) => item.auth_user_id === adjustment.recorded_by)
            const actorName = staff?.full_name || (adjustment.recorded_by === data.currentUserId ? t('electricity.propertyOwner') : adjustment.recorded_by.slice(0, 8))
            return <article key={adjustment.id} className="grid grid-cols-1 gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><p className="font-medium text-slate-900">{account ? accountTitle(account) : t('electricity.clientSubmeter')} · {adjustment.adjustment_units > 0 ? '+' : ''}{numeric(adjustment.adjustment_units)} kWh</p><p className="mt-1 text-xs text-slate-600">{adjustment.reason}</p><p className="mt-1 text-xs text-slate-500">{formatDate(adjustment.adjustment_date)} · {t('electricity.readingBy')} {actorName}</p></div><span className="text-xs text-slate-500">{adjustment.applied_reading_id ? t('electricity.adjustmentApplied') : t('electricity.adjustmentPending')}</span></article>
          })}</div>}
        </section>
      </section>}

      {activeView === 'meters' && <section id="meters" className="scroll-mt-20" aria-labelledby="meters-heading">
        <div className="mb-3 flex items-end justify-between gap-3"><div><h2 id="meters-heading" className="text-lg font-semibold text-slate-950">{t('electricity.metersLatest')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.metersHelp')}</p></div><span className="text-sm text-slate-500">{activeAccounts.length} {t('electricity.activeMeters')}</span></div>
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Metric label={t('electricity.estimatedUnitsLeft')} value={`${numeric(verifiedReadingBalance)} kWh`} detail={t('electricity.latestBalances')} />
          <Metric label={t('electricity.lowOrEmpty')} value={String(lowCount)} detail={t('electricity.reviewContact')} tone={lowCount ? 'danger' : 'normal'} />
          <div className="col-span-2 lg:col-span-1"><Metric label={t('electricity.activeSubmeters')} value={String(submeters.length)} detail={selectedProperty?.name || t('electricity.property')} /></div>
        </div>
        {mainMeters.length > 0 && <section className="border-y border-sky-200 bg-white" aria-labelledby="main-balance-heading">
          <header className="border-b border-sky-200 bg-sky-50 px-4 py-3 sm:px-5">
            <h3 id="main-balance-heading" className="font-semibold text-sky-950">{t('electricity.mainBalanceTitle')}</h3>
            <p className="mt-1 text-sm text-sky-900">{t('electricity.mainBalanceHelp')}</p>
          </header>
          <form onSubmit={submitMainBalance} className="grid grid-cols-1 gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label={t('electricity.selectMainMeter')}><select required className="input min-h-11" value={mainBalanceAccountId} onChange={(event) => setMainBalanceAccountId(event.target.value)}><option value="">{t('electricity.selectMainMeter')}</option>{mainMeters.map((account) => <option key={account.id} value={account.id}>{account.floor_label}</option>)}</select></Field>
            <Field label={t('electricity.visitDate')}><input required className="input min-h-11" type="date" max={todayISO()} value={mainBalanceDate} onChange={(event) => setMainBalanceDate(event.target.value)} /></Field>
            <Field label={t('electricity.unitsRemainingOnMain')}><input required className="input min-h-11 tabular-nums" type="number" inputMode="decimal" min="0" max="1000000" step="0.001" value={mainBalanceUnits} onChange={(event) => setMainBalanceUnits(event.target.value)} /></Field>
            <Field label={t('electricity.quickSessionNote')}><input className="input min-h-11" maxLength={500} value={mainBalanceNotes} onChange={(event) => setMainBalanceNotes(event.target.value)} /></Field>
            <div className="sm:col-span-2 lg:col-span-4"><button className="btn-primary min-h-11 w-full sm:w-auto" disabled={saving || !mainMeters.some((account) => account.id === mainBalanceAccountId) || mainBalanceUnits.trim() === ''}>{saving ? t('electricity.saving') : t('electricity.saveMainBalance')}</button></div>
          </form>
          {mainMeterBalances.length === 0 ? <p className="px-4 py-4 text-sm text-slate-600">{t('electricity.noMainBalances')}</p> : <div className="divide-y divide-slate-200">
            {mainMeterBalances.slice(0, 24).map((balance) => {
              const account = mainMeters.find((item) => item.id === balance.account_id)
              const staff = data.staff.find((item) => item.auth_user_id === balance.recorded_by)
              const recordedBy = staff?.full_name || (balance.recorded_by === data.currentUserId ? t('electricity.propertyOwner') : t('electricity.readingByStaff'))
              return <article key={balance.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0"><p className="font-semibold text-slate-900">{account?.floor_label || t('electricity.mainMeter')} <span className="font-normal text-slate-500">· {formatDate(balance.reading_date)}</span></p><p className="mt-1 text-xs text-slate-600">{recordedBy}{balance.notes ? ` · ${balance.notes}` : ''}</p></div>
                <p className="text-xl font-extrabold tabular-nums text-sky-900 sm:text-2xl">{numeric(balance.units_remaining)} <span className="text-sm font-semibold">kWh</span></p>
              </article>
            })}
          </div>}
        </section>}
        {activeAccounts.length === 0 ? <div className="border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">{t('electricity.noMeters')}</div> : <div className="space-y-5">
          {mainMeters.length > 0 && <section className="border border-sky-200 bg-sky-50/40" aria-labelledby="main-meter-group-heading">
            <header className="flex items-start gap-3 border-b border-sky-200 bg-sky-50 px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center border border-sky-200 bg-white text-sky-700"><Building2 className="h-5 w-5" /></span><div><h3 id="main-meter-group-heading" className="font-semibold text-sky-950">{t('electricity.mainMeters')}</h3><p className="mt-1 text-xs text-sky-900">{t('electricity.mainMeterGroupHelp')}</p></div></header>
            <div className="divide-y divide-sky-100">{mainMeters.map(renderMeterCard)}</div>
          </section>}
          {submeters.length > 0 && <section className="border border-emerald-200 bg-emerald-50/30" aria-labelledby="client-meter-group-heading">
            <header className="flex items-start gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center border border-emerald-200 bg-white text-emerald-700"><Gauge className="h-5 w-5" /></span><div><h3 id="client-meter-group-heading" className="font-semibold text-emerald-950">{t('electricity.activeSubmeters')}</h3><p className="mt-1 text-xs text-emerald-900">{t('electricity.submeterGroupHelp')}</p></div></header>
            <div className="divide-y divide-emerald-100 bg-white">{submeters.map(renderMeterCard)}</div>
          </section>}
        </div>}
      </section>}

      {adjustmentTarget && data.ownerMode && <section className="border border-blue-200 bg-blue-50 p-4 sm:p-5" aria-labelledby="adjustment-heading">
        <div className="mb-3 flex items-start justify-between gap-3"><div><h2 id="adjustment-heading" className="font-semibold text-blue-950">{t('electricity.ownerBalanceTools')} · {accountTitle(adjustmentTarget)}</h2><p className="mt-1 text-sm text-blue-900">{t('electricity.adjustmentHelp')}</p></div><button type="button" className="icon-button" onClick={() => setAdjustmentTarget(null)} aria-label={t('electricity.cancel')}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submitAdjustment} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border border-blue-200 bg-white px-3 py-2"><p className="text-xs text-slate-500">{t('electricity.currentUnits')}</p><p className="mt-1 font-semibold text-slate-950">{numeric(adjustmentTarget.estimated_balance_units)} kWh</p></div>
          <fieldset className="sm:col-span-2 lg:col-span-2"><legend className="text-sm font-medium text-slate-700">{t('electricity.adjustmentUnitsOnly')}</legend><div className="mt-1 grid grid-cols-2 gap-2" role="group" aria-label={t('electricity.adjustmentUnitsOnly')}><button type="button" aria-pressed={adjustmentDirection === 'add'} className={`min-h-11 border px-3 text-sm font-semibold ${adjustmentDirection === 'add' ? 'border-emerald-600 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-white text-slate-600'}`} onClick={() => setAdjustmentDirection('add')}><Plus className="mr-2 inline h-4 w-4" />{t('electricity.addUnits')}</button><button type="button" aria-pressed={adjustmentDirection === 'remove'} className={`min-h-11 border px-3 text-sm font-semibold ${adjustmentDirection === 'remove' ? 'border-rose-600 bg-rose-50 text-rose-900' : 'border-slate-300 bg-white text-slate-600'}`} onClick={() => setAdjustmentDirection('remove')}><Minus className="mr-2 inline h-4 w-4" />{t('electricity.removeUnits')}</button></div><input required aria-label={t('electricity.adjustmentUnitsOnly')} className="input mt-2 min-h-11" type="number" inputMode="decimal" step="0.001" min="0.001" max="100000" value={adjustmentUnits} onChange={(event) => setAdjustmentUnits(event.target.value)} /></fieldset>
          <div className="border border-blue-200 bg-white px-3 py-2"><p className="text-xs text-slate-500">{t('electricity.adjustmentPreview')}</p><p className="mt-1 font-semibold text-slate-950">{numeric(adjustmentTarget.estimated_balance_units + (adjustmentDirection === 'add' ? 1 : -1) * (Number(adjustmentUnits) || 0))} kWh</p></div>
          <Field label={t('electricity.adjustmentDate')}><input required className="input min-h-11" type="date" max={todayISO()} value={adjustmentDate} onChange={(event) => setAdjustmentDate(event.target.value)} /></Field>
          <Field label={t('electricity.adjustmentReason')}><input required minLength={3} maxLength={500} className="input min-h-11" placeholder={t('electricity.adjustmentReasonPlaceholder')} value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} /></Field>
          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button className="btn-primary min-h-11 flex-1 sm:flex-none" disabled={saving || Number(adjustmentUnits) <= 0 || !adjustmentReason.trim()}>{saving ? t('electricity.saving') : t('electricity.saveAdjustment')}</button><button type="button" className="btn-secondary min-h-11" onClick={() => setAdjustmentTarget(null)}>{t('electricity.cancel')}</button></div>
        </form>
      </section>}

      {cutoffTarget && <section className="border border-rose-200 bg-rose-50 p-4 sm:p-5" aria-labelledby="manual-action-heading">
        <div className="mb-3 flex items-start justify-between gap-3"><div><h2 id="manual-action-heading" className="font-semibold text-rose-950">{cutoffTarget.action === 'disconnected' ? t('electricity.recordManualAction') : t('electricity.recordRestoration')}</h2><p className="mt-1 text-sm text-rose-800">{t('electricity.manualActionHelp')}</p></div><button className="icon-button" onClick={() => setCutoffTarget(null)} aria-label={t('electricity.cancelAction')}><X className="h-4 w-4" /></button></div>
        <form onSubmit={submitCutoffEvent} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('electricity.reason')}><input required minLength={3} maxLength={500} className="input min-h-11" value={cutoffReason} onChange={(event) => setCutoffReason(event.target.value)} placeholder={t('electricity.onSiteReason')} /></Field>
          <Field label={t('electricity.readingOptional')}><input className="input min-h-11" type="number" inputMode="decimal" min="0" step="0.001" value={cutoffReading} onChange={(event) => setCutoffReading(event.target.value)} /></Field>
          <div className="flex items-end gap-2"><button className="min-h-11 flex-1 bg-rose-700 px-4 text-sm font-semibold text-white hover:bg-rose-800" disabled={saving}>{saving ? t('electricity.saving') : t('electricity.confirmLogged')}</button><button type="button" className="btn-secondary min-h-11" onClick={() => setCutoffTarget(null)}>{t('electricity.cancel')}</button></div>
        </form>
      </section>}

      {data.ownerMode && activeView === 'staff' && <section className="space-y-4 border-t border-slate-200 pt-6" aria-labelledby="access-heading">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 id="access-heading" className="text-lg font-semibold text-slate-950">{t('electricity.staffAccess')}</h2><p className="mt-1 text-sm text-slate-600">{t('electricity.staffAccessHelp')}</p></div><button className="btn-secondary min-h-11" onClick={() => setShowStaffSetup((show) => !show)}><UserPlus className="mr-2 h-4 w-4" />{t('electricity.addStaff')}</button></div>
        {showStaffSetup && <form onSubmit={submitStaff} className="grid grid-cols-1 gap-3 border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <fieldset className="sm:col-span-2 lg:col-span-4">
            <legend className="text-sm font-medium text-slate-700">{t('electricity.allowedProperties')}</legend>
            <p className="mb-2 mt-1 text-xs text-slate-500">{t('electricity.staffPropertiesHelp')}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.properties.map((property) => <label key={property.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={staffForm.propertyIds.includes(property.id)} onChange={(event) => setStaffForm((current) => ({ ...current, propertyIds: event.target.checked ? [...current.propertyIds, property.id] : current.propertyIds.filter((id) => id !== property.id) }))} />
                <span>{property.name}</span>
              </label>)}
            </div>
          </fieldset>
          <Field label={t('electricity.staffId')}><input required minLength={3} maxLength={24} className="input min-h-11" value={staffForm.staffId} onChange={(event) => setStaffForm({ ...staffForm, staffId: event.target.value.toUpperCase() })} placeholder="For example, DT-014" /></Field>
          <Field label={t('electricity.staffName')}><input required minLength={2} maxLength={100} className="input min-h-11" value={staffForm.fullName} onChange={(event) => setStaffForm({ ...staffForm, fullName: event.target.value })} /></Field>
          <Field label={t('electricity.pinLength')}><input required pattern="[0-9]{8,12}" inputMode="numeric" autoComplete="new-password" className="input min-h-11" type="password" value={staffForm.pin} onChange={(event) => setStaffForm({ ...staffForm, pin: event.target.value.replace(/\D/g, '').slice(0, 12) })} /></Field>
          <div className="sm:col-span-2 lg:col-span-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary min-h-11" onClick={() => setShowStaffSetup(false)}>{t('electricity.cancel')}</button><button className="btn-primary min-h-11" disabled={saving || staffForm.propertyIds.length === 0}>{saving ? t('electricity.creating') : t('electricity.createStaff')}</button></div>
        </form>}
        {data.staff.length === 0 ? <p className="border-y border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">{t('electricity.noStaff')}</p> : <div className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {data.staff.map((staff) => <div key={staff.id} className="flex flex-col gap-3 px-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-4">
            <div className="min-w-0"><p className="font-semibold text-slate-950">{staff.full_name} <span className="font-normal text-slate-500">· {staff.staff_id}</span></p><p className="mt-1 text-xs text-slate-500">{staff.property_ids.map((id) => data.properties.find((property) => property.id === id)?.name || t('electricity.assignedProperty')).join(', ') || t('electricity.noProperty')} · {staff.active ? t('electricity.active') : t('electricity.deactivated')}</p><p className="mt-2 text-xs text-slate-700"><span className="font-semibold">{t('electricity.staffLastLogin')}:</span> {staff.last_login_at ? formatTimestamp(staff.last_login_at) : t('electricity.staffNeverLoggedIn')}</p><p className="mt-1 break-words text-xs text-slate-700"><span className="font-semibold">{t('electricity.staffLastDataEntry')}:</span> {staff.last_activity ? <>{t(staffActivityLabelKeys[staff.last_activity.action])} · {staff.last_activity.account_label} · {formatTimestamp(staff.last_activity.occurred_at)}</> : t('electricity.staffNoDataYet')}</p></div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary min-h-10" onClick={() => openStaffAssignments(staff)} aria-expanded={editingStaffId === staff.id}><Building2 className="mr-2 h-4 w-4" />{editingStaffId === staff.id ? t('electricity.closeProperties') : t('electricity.editProperties')}</button>
              <button className="btn-secondary min-h-10" onClick={() => { setResetStaffId(resetStaffId === staff.id ? '' : staff.id); setResetPin('') }}><KeyRound className="mr-2 h-4 w-4" />{t('electricity.resetPin')}</button>
              <button className={`min-h-10 border px-3 text-sm font-semibold ${staff.active ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`} onClick={() => void toggleStaff(staff)} disabled={saving}>{staff.active ? t('electricity.deactivate') : t('electricity.reactivate')}</button>
            </div>
            {editingStaffId === staff.id && <form onSubmit={(event) => void submitStaffAssignments(event, staff.id)} className="w-full border-t border-slate-200 pt-3">
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">{t('electricity.allowedPropertiesFor')} {staff.full_name}</legend>
                <p className="mb-2 mt-1 text-xs text-slate-500">{t('electricity.staffPropertyAccessHelp')}</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data.properties.map((property) => <label key={property.id} className="flex min-h-11 cursor-pointer items-center gap-3 border border-slate-200 px-3 py-2 text-sm text-slate-800 hover:bg-slate-50">
                    <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={assignmentPropertyIds.includes(property.id)} onChange={(event) => setAssignmentPropertyIds((current) => event.target.checked ? [...current, property.id] : current.filter((id) => id !== property.id))} />
                    <span>{property.name}</span>
                  </label>)}
                </div>
              </fieldset>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary min-h-11" onClick={() => openStaffAssignments(staff)}>{t('electricity.cancel')}</button><button className="btn-primary min-h-11" disabled={saving}>{saving ? t('electricity.saving') : t('electricity.savePropertyAccess')}</button></div>
            </form>}
            {resetStaffId === staff.id && <form onSubmit={submitResetPin} className="flex w-full flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:items-end sm:justify-end"><Field label={t('electricity.pinLength')}><input required pattern="[0-9]{8,12}" inputMode="numeric" autoComplete="new-password" className="input min-h-11" type="password" value={resetPin} onChange={(event) => setResetPin(event.target.value.replace(/\D/g, '').slice(0, 12))} /></Field><button className="btn-primary min-h-11" disabled={saving}>{saving ? t('electricity.saving') : t('electricity.updatePin')}</button></form>}
          </div>)}
        </div>}
        <section className="border-y border-slate-200 bg-white" aria-labelledby="staff-signins-heading">
          <div className="border-b border-slate-200 px-4 py-3"><h3 id="staff-signins-heading" className="font-semibold text-slate-900">{t('electricity.recentStaffSignIns')}</h3></div>
          {data.staffLoginEvents.length === 0 ? <p className="px-4 py-5 text-sm text-slate-500">{t('electricity.noStaffSignIns')}</p> : <div className="divide-y divide-slate-100">
            {data.staffLoginEvents.slice(0, 10).map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"><p className="font-medium text-slate-900">{event.staff_name} <span className="font-normal text-slate-500">· {event.staff_code}</span></p><time className="text-xs text-slate-600" dateTime={event.logged_in_at}>{formatTimestamp(event.logged_in_at)}</time></div>)}
          </div>}
        </section>
        <p className="flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />{t('electricity.staffPinPrivacy')}</p>
      </section>}

      {activeView === 'overview' && <section aria-labelledby="history-heading" className="border-t border-slate-200 pt-5">
        <h2 id="history-heading" className="text-base font-semibold text-slate-950">{t('electricity.recentActivity')}</h2>
        {data.readings.filter((reading) => accountById.has(reading.account_id)).length === 0 ? <p className="mt-3 border-y border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">{t('electricity.noReadings')}</p> : <div className="mt-3 divide-y divide-slate-200 border-y border-slate-200 bg-white">
          {data.readings.filter((reading) => accountById.has(reading.account_id)).slice(0, 8).map((reading) => {
            const account = accountById.get(reading.account_id)
            return <div key={reading.id} className="grid grid-cols-2 gap-2 px-3 py-3 text-sm sm:grid-cols-4 sm:px-4">
              <div><p className="text-xs text-slate-500">{t('electricity.meterClient')}</p><p className="mt-1 truncate font-medium text-slate-900">{account ? accountTitle(account) : t('electricity.meterType')}</p></div>
              <div><p className="text-xs text-slate-500">{t('electricity.period')}</p><p className="mt-1 text-slate-800">{reading.previous_reading_date ? `${formatDate(reading.previous_reading_date)} ${t('electricity.to')} ${formatDate(reading.reading_date)}` : `${t('electricity.startDateUnknown')} · ${formatDate(reading.reading_date)}`}</p></div>
              <div><p className="text-xs text-slate-500">{t('electricity.used')}</p><p className="mt-1 text-slate-800">{numeric(reading.usage_units)} kWh</p></div>
              <div><p className="text-xs text-slate-500">{t('electricity.unitsCarried')}</p><p className="mt-1 font-semibold text-slate-900">{reading.closing_balance_units === null ? t('electricity.mainMeter') : `${numeric(reading.closing_balance_units)} kWh`}</p></div>
            </div>
          })}
        </div>}
      </section>}

      {data.currentStaffId && <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">{t('electricity.signedInStaff')} {data.currentStaffId}. {t('electricity.activityRecorded')}</p>}
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

function LedgerValue({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return <div className="min-w-0"><p className="text-xs text-slate-500">{label}</p><p className={`mt-0.5 truncate ${emphasized ? 'font-semibold text-slate-950' : 'text-slate-800'}`}>{value}</p></div>
}
