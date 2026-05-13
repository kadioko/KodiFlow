import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, getCurrentMonthYear, getMonthName } from '@/utils/currency'
import DashboardPropertyVisibility from '@/components/dashboard/DashboardPropertyVisibility'
import Link from 'next/link'
import {
  Building2,
  Users,
  DoorOpen,
  Wallet,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Clock,
} from 'lucide-react'

async function getDashboardMetrics() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return null

  const { month, year } = getCurrentMonthYear()

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

  // Get leases ending soon (within 90 days)
  const ninetyDaysFromNow = new Date()
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90)
  
  const { data: endingLeases } = await supabase
    .from('leases')
    .select('id, end_date')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .lte('end_date', ninetyDaysFromNow.toISOString().split('T')[0])
    .gte('end_date', new Date().toISOString().split('T')[0])

  // Calculate metrics
  const totalProperties = properties?.length || 0
  const totalUnits = units?.length || 0
  const totalTenants = tenants?.length || 0
  const occupiedUnits = units?.filter(u => u.status === 'occupied').length || 0
  const vacantUnits = units?.filter(u => u.status === 'vacant').length || 0
  
  const totalExpectedThisMonth = invoices?.reduce((sum, inv) => sum + (inv.subtotal || 0), 0) || 0
  const totalCollectedThisMonth = invoices?.reduce((sum, inv) => sum + (inv.amount_paid || 0), 0) || 0
  const totalOutstanding = invoices?.reduce((sum, inv) => sum + (inv.balance || 0), 0) || 0
  const overdueInvoices = invoices?.filter(inv => inv.status === 'overdue') || []
  const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.balance || 0), 0)
  const overdueTenantsCount = new Set(overdueInvoices.map(inv => inv.id)).size

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
    leasesEndingSoonCount: endingLeases?.length || 0,
    residentialUnits,
    commercialUnits,
    mixedUnits,
    propertySummaries,
  }
}

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics()

  if (!metrics) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-gray-500">Overview for {metrics.month} {metrics.year}</p>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Expected Revenue */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-primary-100">
              <Wallet className="h-6 w-6 text-primary-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Expected This Month</p>
          <p className="stat-value">{formatCurrency(metrics.totalExpectedThisMonth)}</p>
        </div>

        {/* Collected Revenue */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-success-100">
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
            <div className="p-3 rounded-lg bg-warning-100">
              <TrendingDown className="h-6 w-6 text-warning-600" />
            </div>
          </div>
          <p className="stat-label mt-4">Total Outstanding</p>
          <p className="stat-value">{formatCurrency(metrics.totalOutstanding)}</p>
        </div>

        {/* Overdue Amount */}
        <div className="stat-card">
          <div className="flex items-center">
            <div className="p-3 rounded-lg bg-danger-100">
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
            <div className="p-3 rounded-lg bg-blue-100">
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
            <div className="p-3 rounded-lg bg-purple-100">
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
            <div className="p-3 rounded-lg bg-green-100">
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

      <DashboardPropertyVisibility properties={metrics.propertySummaries} />

      {/* Quick Actions */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
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
        <div className="card border-warning-200">
          <div className="card-header bg-warning-50">
            <h3 className="text-lg font-semibold text-warning-800 flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              Attention Required
            </h3>
          </div>
          <div className="card-body">
            <div className="space-y-2">
              {metrics.overdueTenantsCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-danger-50 rounded-lg">
                  <span className="text-danger-700">
                    {metrics.overdueTenantsCount} tenant(s) with overdue payments
                  </span>
                  <Link href="/invoices?status=overdue" className="text-danger-700 font-medium hover:underline">
                    View
                  </Link>
                </div>
              )}
              {metrics.leasesEndingSoonCount > 0 && (
                <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
                  <span className="text-warning-700">
                    {metrics.leasesEndingSoonCount} lease(s) ending within 90 days
                  </span>
                  <Link href="/leases?filter=ending_soon" className="text-warning-700 font-medium hover:underline">
                    View
                  </Link>
                </div>
              )}
              {metrics.vacantUnits > 0 && (
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
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
