'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Home, 
  AlertCircle,
  Download,
  Calendar,
  Filter
} from 'lucide-react'
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/utils/currency'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Area,
  AreaChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { calculateLateFee, calculateNetIncome } from '@/utils/finance'

interface MonthlyData {
  month: number
  year: number
  expected: number
  collected: number
  outstanding: number
}

interface PropertyReport {
  property_id: string
  property_name: string
  property_type: string
  total_units: number
  occupied_units: number
  vacant_units: number
  monthly_rent: number
  total_invoiced: number
  total_collected: number
  outstanding: number
  expenses: number
  net_income: number
}

interface TenantBalanceReport {
  tenant_id: string
  tenant_name: string
  outstanding: number
  overdue: number
  invoice_count: number
}

interface DepositReport {
  expected: number
  paid: number
  outstanding: number
  pendingCount: number
}

interface TenantMixReport {
  tenant_type: string
  count: number
}

interface UtilityReport {
  utility_type: string
  usage_amount: number
  total_amount: number
}

interface InvoiceAnalytics {
  statusData: { status: string; count: number; amount: number }[]
  outstandingByAge: { bucket: string; amount: number }[]
  topOutstandingTenants: TenantBalanceReport[]
}

type InvoiceWithTenant = {
  id: string
  tenant_id: string
  subtotal: number | null
  amount_paid: number | null
  balance: number | null
  due_date: string
  status: string
  billing_month: number
  billing_year: number
  tenants: { full_name: string | null; business_name: string | null } | { full_name: string | null; business_name: string | null }[] | null
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value
}

const chartColors = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed']

const currentYear = new Date().getFullYear()
const reportYears = Array.from({ length: 7 }, (_, index) => currentYear - 3 + index)

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear().month)
  const [selectedYear, setSelectedYear] = useState(getCurrentMonthYear().year)
  
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [propertyReports, setPropertyReports] = useState<PropertyReport[]>([])
  const [tenantMix, setTenantMix] = useState<TenantMixReport[]>([])
  const [utilityReports, setUtilityReports] = useState<UtilityReport[]>([])
  const [invoiceAnalytics, setInvoiceAnalytics] = useState<InvoiceAnalytics>({
    statusData: [],
    outstandingByAge: [],
    topOutstandingTenants: [],
  })
  const [depositReport, setDepositReport] = useState<DepositReport>({
    expected: 0,
    paid: 0,
    outstanding: 0,
    pendingCount: 0,
  })
  const [summary, setSummary] = useState({
    totalProperties: 0,
    totalUnits: 0,
    occupiedUnits: 0,
    vacantUnits: 0,
    totalTenants: 0,
    activeLeases: 0,
    monthlyExpected: 0,
    monthlyCollected: 0,
    totalOutstanding: 0,
    overdueCount: 0,
    totalExpenses: 0,
    netIncome: 0,
    lateFeesEstimated: 0,
    allOutstanding: 0,
    allOverdue: 0,
  })

  useEffect(() => {
    fetchReportData()
  }, [selectedMonth, selectedYear])

  const fetchReportData = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Fetch properties with units and occupancy
    const { data: properties } = await supabase
      .from('properties')
      .select(`
        id,
        name,
        property_type,
        units(id, status, monthly_rent)
      `)
      .eq('user_id', user.id)

    // Fetch invoices for selected month
    const { data: invoices } = await supabase
      .from('rent_invoices')
      .select('*, tenants(full_name, business_name)')
      .eq('user_id', user.id)
      .eq('billing_month', selectedMonth)
      .eq('billing_year', selectedYear)

    const { data: allInvoicesData } = await supabase
      .from('rent_invoices')
      .select('id, tenant_id, subtotal, amount_paid, balance, due_date, status, billing_month, billing_year, tenants(full_name, business_name)')
      .eq('user_id', user.id)

    const allInvoices = (allInvoicesData || []) as InvoiceWithTenant[]

    const { data: profile } = await supabase
      .from('profiles')
      .select('late_fee_rate')
      .eq('id', user.id)
      .single()

    // Fetch all active leases
    const { data: leases } = await supabase
      .from('leases')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    const { data: expenses } = await supabase
      .from('expenses')
      .select('*')
      .eq('user_id', user.id)

    const monthlyExpenses = expenses?.filter((expense: any) => {
      const date = new Date(expense.expense_date)
      return date.getMonth() + 1 === selectedMonth && date.getFullYear() === selectedYear
    }) || []

    // Fetch tenants count
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id, tenant_type', { count: 'exact' })
      .eq('user_id', user.id)

    const { data: utilities, error: utilitiesError } = await supabase
      .from('utility_meter_readings')
      .select('*')
      .eq('user_id', user.id)
      .eq('billing_month', selectedMonth)
      .eq('billing_year', selectedYear)

    // Calculate property reports
    const propertyReportsData: PropertyReport[] = []
    
    if (properties) {
      properties.forEach((prop: any) => {
        const units = prop.units || []
        const occupied = units.filter((u: any) => u.status === 'occupied').length
        const vacant = units.filter((u: any) => u.status === 'vacant').length
        
        const propInvoices = invoices?.filter((inv: any) => inv.property_id === prop.id) || []
        const propExpenses = monthlyExpenses.filter((expense: any) => expense.property_id === prop.id)
        const totalInvoiced = propInvoices.reduce((sum: number, inv: any) => sum + inv.subtotal, 0)
        const totalCollected = propInvoices.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0)
        const totalExpenses = propExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
        
        propertyReportsData.push({
          property_id: prop.id,
          property_name: prop.name,
          property_type: prop.property_type,
          total_units: units.length,
          occupied_units: occupied,
          vacant_units: vacant,
          monthly_rent: units.reduce((sum: number, u: any) => sum + (u.monthly_rent || 0), 0),
          total_invoiced: totalInvoiced,
          total_collected: totalCollected,
          outstanding: totalInvoiced - totalCollected,
          expenses: totalExpenses,
          net_income: calculateNetIncome(totalCollected, totalExpenses),
        })
      })
    }

    setPropertyReports(propertyReportsData)

    // Calculate summary
    const totalInvoiced = invoices?.reduce((sum: number, inv: any) => sum + inv.subtotal, 0) || 0
    const totalCollected = invoices?.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0) || 0
    const overdueInvoices = invoices?.filter((inv: any) => inv.status === 'overdue') || []
    const totalExpenses = monthlyExpenses.reduce((sum: number, expense: any) => sum + expense.amount, 0)
    const lateFeeRate = Number(profile?.late_fee_rate || 0)
    const lateFeesEstimated = overdueInvoices.reduce((sum: number, invoice: any) => {
      return sum + calculateLateFee(invoice.balance || 0, invoice.due_date, lateFeeRate)
    }, 0)

    const tenantBalanceMap = new Map<string, TenantBalanceReport>()
    allInvoices.forEach((invoice) => {
      if ((invoice.balance || 0) <= 0) return
      const tenant = firstRelation(invoice.tenants)
      const current = tenantBalanceMap.get(invoice.tenant_id) || {
        tenant_id: invoice.tenant_id,
        tenant_name: tenant?.full_name || tenant?.business_name || 'Unknown tenant',
        outstanding: 0,
        overdue: 0,
        invoice_count: 0,
      }
      current.outstanding += invoice.balance || 0
      current.invoice_count += 1
      if (invoice.status === 'overdue') {
        current.overdue += invoice.balance || 0
      }
      tenantBalanceMap.set(invoice.tenant_id, current)
    })
    const tenantBalanceRows = Array.from(tenantBalanceMap.values()).sort((a, b) => b.outstanding - a.outstanding)

    const statusMap = new Map<string, { status: string; count: number; amount: number }>()
    allInvoices.forEach((invoice) => {
      const current = statusMap.get(invoice.status) || { status: invoice.status.replace('_', ' '), count: 0, amount: 0 }
      current.count += 1
      current.amount += invoice.balance || 0
      statusMap.set(invoice.status, current)
    })

    const today = new Date()
    const agingBuckets = [
      { bucket: 'Not due', amount: 0 },
      { bucket: '1-30 days', amount: 0 },
      { bucket: '31-60 days', amount: 0 },
      { bucket: '60+ days', amount: 0 },
    ]

    allInvoices.forEach((invoice) => {
      const balance = invoice.balance || 0
      if (balance <= 0) return
      const dueDate = new Date(`${invoice.due_date}T00:00:00`)
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / 86400000)

      if (daysOverdue <= 0) agingBuckets[0].amount += balance
      else if (daysOverdue <= 30) agingBuckets[1].amount += balance
      else if (daysOverdue <= 60) agingBuckets[2].amount += balance
      else agingBuckets[3].amount += balance
    })

    setInvoiceAnalytics({
      statusData: Array.from(statusMap.values()),
      outstandingByAge: agingBuckets,
      topOutstandingTenants: tenantBalanceRows.slice(0, 8),
    })

    const tenantMixMap = new Map<string, number>()
    tenants?.forEach((tenant: any) => {
      tenantMixMap.set(tenant.tenant_type, (tenantMixMap.get(tenant.tenant_type) || 0) + 1)
    })
    setTenantMix(Array.from(tenantMixMap.entries()).map(([tenant_type, count]) => ({ tenant_type, count })))

    const utilityMap = new Map<string, UtilityReport>()
    if (utilitiesError) {
      setUtilityReports([])
    }

    utilities?.forEach((utility: any) => {
      const current = utilityMap.get(utility.utility_type) || {
        utility_type: utility.utility_type,
        usage_amount: 0,
        total_amount: 0,
      }
      current.usage_amount += utility.usage_amount || 0
      current.total_amount += utility.total_amount || 0
      utilityMap.set(utility.utility_type, current)
    })
    setUtilityReports(Array.from(utilityMap.values()))

    const depositExpected = leases?.reduce((sum: number, lease: any) => sum + (lease.deposit_amount || 0), 0) || 0
    const depositPaid = leases?.reduce((sum: number, lease: any) => sum + (lease.deposit_paid_amount || 0), 0) || 0
    setDepositReport({
      expected: depositExpected,
      paid: depositPaid,
      outstanding: depositExpected - depositPaid,
      pendingCount: leases?.filter((lease: any) => lease.deposit_status !== 'paid').length || 0,
    })

    const totalUnits = properties?.reduce((sum: number, p: any) => sum + (p.units?.length || 0), 0) || 0
    const occupiedUnits = properties?.reduce((sum: number, p: any) => {
      return sum + (p.units?.filter((u: any) => u.status === 'occupied').length || 0)
    }, 0) || 0

    const allOutstanding = allInvoices.reduce((sum, invoice) => sum + Math.max(invoice.balance || 0, 0), 0)
    const allOverdue = allInvoices
      .filter((invoice) => invoice.status === 'overdue')
      .reduce((sum, invoice) => sum + Math.max(invoice.balance || 0, 0), 0)

    const trendData = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(selectedYear, selectedMonth - 1 - (5 - index), 1)
      const trendMonth = date.getMonth() + 1
      const trendYear = date.getFullYear()
      const trendInvoices = allInvoices.filter((invoice) => invoice.billing_month === trendMonth && invoice.billing_year === trendYear)

      return {
        month: trendMonth,
        year: trendYear,
        expected: trendInvoices.reduce((sum, invoice) => sum + (invoice.subtotal || 0), 0),
        collected: trendInvoices.reduce((sum, invoice) => sum + (invoice.amount_paid || 0), 0),
        outstanding: trendInvoices.reduce((sum, invoice) => sum + (invoice.balance || 0), 0),
      }
    })
    setMonthlyData(trendData)

    setSummary({
      totalProperties: properties?.length || 0,
      totalUnits: totalUnits,
      occupiedUnits: occupiedUnits,
      vacantUnits: totalUnits - occupiedUnits,
      totalTenants: tenants?.length || 0,
      activeLeases: leases?.length || 0,
      monthlyExpected: totalInvoiced,
      monthlyCollected: totalCollected,
      totalOutstanding: totalInvoiced - totalCollected,
      overdueCount: overdueInvoices.length,
      totalExpenses,
      netIncome: calculateNetIncome(totalCollected, totalExpenses),
      lateFeesEstimated,
      allOutstanding,
      allOverdue,
    })

    setLoading(false)
  }

  const handleExportCSV = () => {
    const csvContent = [
      ['Property', 'Type', 'Units', 'Occupied', 'Vacant', 'Monthly Rent', 'Invoiced', 'Collected', 'Expenses', 'Net Income', 'Outstanding'],
      ...propertyReports.map(p => [
        p.property_name,
        p.property_type,
        p.total_units,
        p.occupied_units,
        p.vacant_units,
        p.monthly_rent,
        p.total_invoiced,
        p.total_collected,
        p.expenses,
        p.net_income,
        p.outstanding,
      ]),
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${selectedMonth}-${selectedYear}.csv`
    a.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Financial Reports</h1>
          <p className="text-gray-500">Property performance and collection reports</p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </button>
      </div>

      {/* Period Selector */}
      <div className="card p-4">
        <div className="flex items-center space-x-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-gray-500">Report Period:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="input w-40"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{getMonthName(m)}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="input w-32"
          >
            {reportYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Expected This Month</p>
              <p className="stat-value">{formatCurrency(summary.monthlyExpected)}</p>
            </div>
            <div className="p-3 bg-primary-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Collected This Month</p>
              <p className="stat-value text-success-600">{formatCurrency(summary.monthlyCollected)}</p>
            </div>
            <div className="p-3 bg-success-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-success-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Outstanding</p>
              <p className={`stat-value ${summary.totalOutstanding > 0 ? 'text-danger-600' : ''}`}>
                {formatCurrency(summary.totalOutstanding)}
              </p>
            </div>
            <div className="p-3 bg-danger-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-danger-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Collection Rate</p>
              <p className="stat-value">
                {summary.monthlyExpected > 0 
                  ? Math.round((summary.monthlyCollected / summary.monthlyExpected) * 100) 
                  : 0}%
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Filter className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Occupancy Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Total Properties</p>
              <p className="text-2xl font-bold">{summary.totalProperties}</p>
            </div>
            <Home className="h-8 w-8 text-primary-500" />
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Occupancy Rate</p>
              <p className="text-2xl font-bold">
                {summary.totalUnits > 0 
                  ? Math.round((summary.occupiedUnits / summary.totalUnits) * 100) 
                  : 0}%
              </p>
            </div>
            <Users className="h-8 w-8 text-success-500" />
          </div>
          <div className="text-sm text-gray-500">
            {summary.occupiedUnits} occupied / {summary.vacantUnits} vacant
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-gray-500">Active Leases</p>
              <p className="text-2xl font-bold">{summary.activeLeases}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-warning-500" />
          </div>
          <div className="text-sm text-gray-500">
            {summary.overdueCount} overdue invoices
          </div>
        </div>
      </div>

      {/* Financial Enhancements */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Expenses</p>
          <p className="stat-value text-warning-600">{formatCurrency(summary.totalExpenses)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Net Income</p>
          <p className={`stat-value ${summary.netIncome >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
            {formatCurrency(summary.netIncome)}
          </p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Late Fees Estimated</p>
          <p className="stat-value text-danger-600">{formatCurrency(summary.lateFeesEstimated)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Deposit Outstanding</p>
          <p className="stat-value text-warning-600">{formatCurrency(depositReport.outstanding)}</p>
          <p className="text-sm text-gray-500">{depositReport.pendingCount} pending lease(s)</p>
        </div>
      </div>

      {/* Outstanding Analytics */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Collection Trend</h3>
              <p className="text-sm text-gray-500">Last six billing periods up to {getMonthName(selectedMonth)} {selectedYear}</p>
            </div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData.map((item) => ({
                ...item,
                label: `${getMonthName(item.month).slice(0, 3)} ${item.year}`,
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Area type="monotone" dataKey="expected" name="Expected" stroke="#2563eb" fill="#bfdbfe" />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#16a34a" fill="#bbf7d0" />
                <Area type="monotone" dataKey="outstanding" name="Outstanding" stroke="#dc2626" fill="#fecaca" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900">Invoice Status Mix</h3>
          <p className="mt-1 text-sm text-gray-500">All open and closed invoices</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={invoiceAnalytics.statusData}
                  dataKey="count"
                  nameKey="status"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                >
                  {invoiceAnalytics.statusData.map((entry, index) => (
                    <Cell key={entry.status} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [value, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6">
          <p className="text-sm text-gray-500">Total Outstanding Across All Periods</p>
          <p className="mt-2 text-3xl font-bold text-danger-600">{formatCurrency(summary.allOutstanding)}</p>
          <p className="mt-2 text-sm text-gray-500">Overdue: {formatCurrency(summary.allOverdue)}</p>
        </div>

        <div className="card p-6 xl:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding Aging</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={invoiceAnalytics.outstandingByAge}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="amount" name="Outstanding" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Property Collection Performance</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyReports}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="property_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="total_invoiced" name="Invoiced" fill="#3b82f6" />
                <Bar dataKey="total_collected" name="Collected" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Occupancy by Property</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={propertyReports}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="property_name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="occupied_units" name="Occupied" fill="#8b5cf6" />
                <Bar dataKey="vacant_units" name="Vacant" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Tenant Mix and Utilities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Tenant Mix</h3>
          </div>
          <div className="card-body">
            {tenantMix.length === 0 ? (
              <p className="text-gray-500">No tenant mix data available.</p>
            ) : (
              <div className="space-y-3">
                {tenantMix.map((item) => (
                  <div key={item.tenant_type} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="capitalize text-gray-700">{item.tenant_type.replace('_', ' ')}</span>
                    <span className="font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold">Utility Usage Summary</h3>
          </div>
          <div className="card-body">
            {utilityReports.length === 0 ? (
              <p className="text-gray-500">No utility readings for this period.</p>
            ) : (
              <div className="space-y-3">
                {utilityReports.map((item) => (
                  <div key={item.utility_type} className="flex items-center justify-between border-b border-gray-100 pb-2">
                    <span className="capitalize text-gray-700">{item.utility_type}</span>
                    <span className="font-semibold">{item.usage_amount} units • {formatCurrency(item.total_amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Outstanding Balances by Tenant */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Top Outstanding Tenants</h3>
        </div>
        <div className="card-body">
          {invoiceAnalytics.topOutstandingTenants.length === 0 ? (
            <p className="text-gray-500">No outstanding tenant balances.</p>
          ) : (
            <div className="space-y-3">
              {invoiceAnalytics.topOutstandingTenants.map((tenant) => (
                <div key={tenant.tenant_id} className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div>
                    <span className="text-gray-700">{tenant.tenant_name}</span>
                    <p className="text-xs text-gray-500">{tenant.invoice_count} open invoice(s), overdue {formatCurrency(tenant.overdue)}</p>
                  </div>
                  <span className="font-semibold text-danger-600">{formatCurrency(tenant.outstanding)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Property Reports Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold">Property Performance</h3>
        </div>
        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell">Property</th>
                <th className="table-header-cell">Type</th>
                <th className="table-header-cell">Units</th>
                <th className="table-header-cell">Occupancy</th>
                <th className="table-header-cell">Expected</th>
                <th className="table-header-cell">Collected</th>
                <th className="table-header-cell">Expenses</th>
                <th className="table-header-cell">Net Income</th>
                <th className="table-header-cell">Outstanding</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {propertyReports.map((property) => (
                <tr key={property.property_id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium">{property.property_name}</td>
                  <td className="table-cell capitalize">{property.property_type}</td>
                  <td className="table-cell">{property.total_units}</td>
                  <td className="table-cell">
                    <div className="flex items-center">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full mr-2 max-w-24">
                        <div 
                          className="h-2 bg-primary-500 rounded-full"
                          style={{ 
                            width: `${property.total_units > 0 
                              ? (property.occupied_units / property.total_units) * 100 
                              : 0}%` 
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-500">
                        {property.total_units > 0 
                          ? Math.round((property.occupied_units / property.total_units) * 100) 
                          : 0}%
                      </span>
                    </div>
                  </td>
                  <td className="table-cell">{formatCurrency(property.total_invoiced)}</td>
                  <td className="table-cell text-success-600">{formatCurrency(property.total_collected)}</td>
                  <td className="table-cell text-warning-600">{formatCurrency(property.expenses)}</td>
                  <td className={`table-cell font-medium ${property.net_income >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
                    {formatCurrency(property.net_income)}
                  </td>
                  <td className={`table-cell font-medium ${property.outstanding > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                    {formatCurrency(property.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
