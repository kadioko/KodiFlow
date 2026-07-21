import { createClient } from '@/lib/supabase/server'
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/utils/currency'
import DashboardPropertyVisibility from '@/components/dashboard/DashboardPropertyVisibility'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Building2,
  Users,
  DoorOpen,
  Wallet,
  AlertCircle,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'

async function getDashboardMetrics() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { month, year } = getCurrentMonthYear()

  const todayIso = new Date().toISOString().split('T')[0]

  await supabase.rpc('expire_stale_leases')
  await supabase.rpc('refresh_overdue_invoices')

  const { data: profile } = await supabase
    .from('profiles')
    .select('dashboard_hidden_property_ids')
    .eq('id', user.id)
    .single()

  // Get counts
  const { data: properties } = await supabase
    .from('properties')
    .select(`
      id,
      name,
      property_type,
      units(id, status, monthly_rent)
    `)
    .eq('user_id', user.id)
    .order('name')

  const { data: units } = await supabase
    .from('units')
    .select('id, status, usage_type')
    .eq('user_id', user.id)

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)

  // Get current month invoices
  const { data: invoices } = await supabase
    .from('rent_invoices')
    .select('id, subtotal, amount_paid, balance, status, billing_month, billing_year')
    .eq('user_id', user.id)
    .eq('billing_month', month)
    .eq('billing_year', year)

  const { data: allInvoices } = await supabase
    .from('rent_invoices')
    .select('id, tenant_id, balance, status, due_date')
    .eq('user_id', user.id)

  const { data: activeLeases } = await supabase
    .from('leases')
    .select('id, tenant_id, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')

  // Calculate metrics
  const totalProperties = properties?.length || 0
  const totalUnits = units?.length || 0
  const totalTenants = tenants?.length || 0
  const occupiedUnits = units?.filter(u => u.status === 'occupied').length || 0
  const vacantUnits = units?.filter(u => u.status === 'vacant').length || 0
  
  const totalExpectedThisMonth = invoices?.reduce((sum, inv) => sum + (inv.subtotal || 0), 0) || 0
  const totalCollectedThisMonth = invoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0
  const openInvoices = (allInvoices || []).filter((invoice) => !['cancelled', 'transferred', 'paid'].includes(invoice.status))
  const totalOutstanding = openInvoices.reduce((sum, invoice) => sum + (invoice.balance || 0), 0)
  const overdueInvoices = openInvoices.filter(invoice => invoice.status === 'overdue')
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0)
  const overdueTenantsCount = new Set(overdueInvoices.map(inv => inv.tenant_id)).size
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const invoicesDueThisWeek = openInvoices.filter((invoice) => invoice.due_date >= todayIso && invoice.due_date <= nextWeek.toISOString().split('T')[0])
  const activeTenantIds = new Set((activeLeases || []).map((lease) => lease.tenant_id))
  const tenantsWithoutActiveUnit = (tenants || []).filter((tenant) => !activeTenantIds.has(tenant.id)).length
  const endingLeaseCounts = [30, 60, 90].map((days) => ({
    days,
    count: (activeLeases || []).filter((lease) => {
      const end = lease.end_date
      const threshold = new Date()
      threshold.setDate(threshold.getDate() + days)
      return end >= todayIso && end <= threshold.toISOString().split('T')[0]
    }).length,
  }))
  const leasesEndingSoonCount = endingLeaseCounts[2].count

  // By property type
  const residentialUnits = units?.filter(u => u.usage_type === 'residential').length || 0
  const commercialUnits = units?.filter(u => u.usage_type === 'commercial').length || 0
  const mixedUnits = units?.filter(u => u.usage_type === 'mixed').length || 0
  const propertySummaries = (properties || []).map((property: any) => {
    const propertyUnits = property.units || []

    return {
      id: property.id,
      name: property.name,
      property_type: property.property_type,
      total_units: propertyUnits.length,
      occupied_units: propertyUnits.filter((unit: any) => unit.status === 'occupied').length,
      vacant_units: propertyUnits.filter((unit: any) => unit.status === 'vacant').length,
      monthly_rent: propertyUnits.reduce((sum: number, unit: any) => sum + (unit.monthly_rent || 0), 0),
    }
  })

  return {
    month: getMonthName(month),
    year,
    totalProperties,
    totalUnits,
    totalTenants,
    occupiedUnits,
    vacantUnits,
    occupancyRate: totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0,
    totalExpectedThisMonth,
    totalCollectedThisMonth,
    collectionRate: totalExpectedThisMonth > 0 ? Math.round((totalCollectedThisMonth / totalExpectedThisMonth) * 100) : 0,
    totalOutstanding,
    totalOverdue,
    overdueTenantsCount,
    leasesEndingSoonCount,
    invoicesDueThisWeekCount: invoicesDueThisWeek.length,
    invoicesDueThisWeekAmount: invoicesDueThisWeek.reduce((sum, invoice) => sum + (invoice.balance || 0), 0),
    tenantsWithoutActiveUnit,
    endingLeaseCounts,
    residentialUnits,
    commercialUnits,
    mixedUnits,
    propertySummaries,
    hiddenPropertyIds: Array.isArray(profile?.dashboard_hidden_property_ids) ? profile.dashboard_hidden_property_ids : [],
  }
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  if (!metrics) {
    redirect('/auth/login?next=/dashboard')
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary-700">Property operations</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Dashboard</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500 sm:text-base">
              Overview for {metrics.month} {metrics.year}. Track collections, occupancy, overdue invoices, and upcoming lease events.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-white p-3">
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">Collection</p>
              <p className="text-xl font-bold text-slate-950">{metrics.collectionRate}%</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">Occupancy</p>
              <p className="text-xl font-bold text-slate-950">{metrics.occupancyRate}%</p>
            </div>
            <div className="px-3 py-2">
              <p className="text-xs text-slate-500">Alerts</p>
              <p className="text-xl font-bold text-slate-950">{metrics.overdueTenantsCount + metrics.leasesEndingSoonCount}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="card">
        <div className="card-header flex items-center justify-between">
          <div><h2 className="text-lg font-semibold text-slate-950">Today&apos;s work queue</h2><p className="mt-1 text-sm text-slate-500">The records that need a decision or follow-up now.</p></div>
          <span className="badge bg-slate-100 text-slate-700">{metrics.overdueTenantsCount + metrics.invoicesDueThisWeekCount + metrics.vacantUnits + metrics.tenantsWithoutActiveUnit} items</span>
        </div>
        <div className="divide-y divide-slate-100">
          <WorkQueueItem label="Overdue payments" detail={`${metrics.overdueTenantsCount} tenant${metrics.overdueTenantsCount === 1 ? '' : 's'} · ${formatCurrency(metrics.totalOverdue)} outstanding`} href="/invoices?status=overdue" tone="danger" />
          <WorkQueueItem label="Invoices due this week" detail={`${metrics.invoicesDueThisWeekCount} invoice${metrics.invoicesDueThisWeekCount === 1 ? '' : 's'} · ${formatCurrency(metrics.invoicesDueThisWeekAmount)} to collect`} href="/invoices?sort=due_asc" tone="warning" />
          <WorkQueueItem label="Lease renewals" detail={`${metrics.endingLeaseCounts[0].count} in 30 days · ${metrics.endingLeaseCounts[1].count} in 60 days · ${metrics.endingLeaseCounts[2].count} in 90 days`} href="/leases" tone="primary" />
          <WorkQueueItem label="Vacant units" detail={`${metrics.vacantUnits} unit${metrics.vacantUnits === 1 ? '' : 's'} available to assign`} href="/units" tone="success" />
          <WorkQueueItem label="Tenants without an active unit" detail={`${metrics.tenantsWithoutActiveUnit} tenant${metrics.tenantsWithoutActiveUnit === 1 ? '' : 's'} need assignment or review`} href="/tenants" tone="slate" />
        </div>
      </section>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Expected Revenue */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-primary-100 p-3 ring-8 ring-primary-50">
              <Wallet className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Expected This Month</p>
          <p className="stat-value">{formatCurrency(metrics.totalExpectedThisMonth)}</p>
        </div>

        {/* Collected Revenue */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-success-100 p-3 ring-8 ring-success-50">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Collected This Month</p>
          <p className="stat-value">{formatCurrency(metrics.totalCollectedThisMonth)}</p>
          <p className={`stat-change ${metrics.collectionRate >= 80 ? 'stat-change-positive' : 'stat-change-negative'}`}>
            {metrics.collectionRate}% collection rate
          </p>
        </div>

        {/* Outstanding Balance */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-warning-100 p-3 ring-8 ring-warning-50">
              <TrendingDown className="h-6 w-6 text-warning-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Total Outstanding</p>
          <p className="stat-value">{formatCurrency(metrics.totalOutstanding)}</p>
        </div>

        {/* Overdue Amount */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-danger-100 p-3 ring-8 ring-danger-50">
              <AlertCircle className="h-6 w-6 text-danger-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Total Overdue</p>
          <p className="stat-value text-danger-600">{formatCurrency(metrics.totalOverdue)}</p>
          <p className="text-sm text-danger-600">{metrics.overdueTenantsCount} overdue tenants</p>
        </div>
      </div>

      {/* Property Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-blue-100 p-3 ring-8 ring-blue-50">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Properties</p>
          <p className="stat-value">{metrics.totalProperties}</p>
          <div className="mt-2 text-sm text-gray-500">
            {metrics.residentialUnits > 0 && <span>{metrics.residentialUnits} residential units</span>}
            {metrics.commercialUnits > 0 && <span className="ml-2">{metrics.commercialUnits} commercial units</span>}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-purple-100 p-3 ring-8 ring-purple-50">
              <DoorOpen className="h-6 w-6 text-purple-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Units</p>
          <p className="stat-value">{metrics.totalUnits}</p>
          <p className="stat-change">
            <span className="text-success-600">{metrics.occupiedUnits} occupied</span>
            <span className="text-gray-400 mx-1">|</span>
            <span className="text-danger-600">{metrics.vacantUnits} vacant</span>
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center">
            <div className="rounded-2xl bg-green-100 p-3 ring-8 ring-green-50">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Tenants</p>
          <p className="stat-value">{metrics.totalTenants}</p>
          <p className="stat-change">
            <span className="text-warning-600">{metrics.leasesEndingSoonCount} leases ending soon</span>
          </p>
        </div>
      </div>

      <DashboardPropertyVisibility properties={metrics.propertySummaries} initialHiddenIds={metrics.hiddenPropertyIds} />

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-bold text-slate-900">Quick Actions</h3>
        </div>
        <div className="card-body">
          <div className="flex flex-wrap gap-3">
            <Link href="/tenants/new" className="btn-primary">
              Add Tenant
            </Link>
            <Link href="/units/new" className="btn-primary">
              Add Unit
            </Link>
            <Link href="/leases/new" className="btn-primary">
              Create Lease
            </Link>
            <Link href="/invoices/generate" className="btn-success">
              Generate Invoice
            </Link>
            <Link href="/payments/new" className="btn-secondary">
              Record Payment
            </Link>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {(metrics.overdueTenantsCount > 0 || metrics.leasesEndingSoonCount > 0 || metrics.vacantUnits > 0) && (
        <div className="card border-warning-200 bg-warning-50/50">
          <div className="card-header bg-warning-50/80">
            <h3 className="text-lg font-semibold text-warning-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Attention Required
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {metrics.overdueTenantsCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-danger-100 bg-danger-50 p-4">
                  <span className="text-danger-700">
                    {metrics.overdueTenantsCount} tenant(s) with overdue payments
                  </span>
                  <Link href="/invoices?status=overdue" className="text-danger-700 font-medium hover:underline">
                    View
                  </Link>
                </div>
              )}
              {metrics.leasesEndingSoonCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-warning-100 bg-warning-50 p-4">
                  <span className="text-warning-700">
                    {metrics.leasesEndingSoonCount} lease(s) ending within 90 days
                  </span>
                  <Link href="/leases?filter=ending_soon" className="text-warning-700 font-medium hover:underline">
                    View
                  </Link>
                </div>
              )}
              {metrics.vacantUnits > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <span className="text-blue-700">
                    {metrics.vacantUnits} vacant unit(s) available
                  </span>
                  <Link href="/units?status=vacant" className="text-blue-700 font-medium hover:underline">
                    View
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function WorkQueueItem({ label, detail, href, tone }: { label: string; detail: string; href: string; tone: 'danger' | 'warning' | 'primary' | 'success' | 'slate' }) {
  const tones = { danger: 'bg-danger-500', warning: 'bg-warning-500', primary: 'bg-primary-500', success: 'bg-success-500', slate: 'bg-slate-400' }
  return <Link href={href} className="flex items-center gap-3 px-5 py-4 transition hover:bg-slate-50"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tones[tone]}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900">{label}</span><span className="block truncate text-sm text-slate-500">{detail}</span></span><span className="text-sm font-semibold text-primary-700">View</span></Link>
}
