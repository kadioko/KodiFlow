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
import { formatCurrency, formatDate, getCurrentMonthYear, getMonthName } from '@/utils/currency'

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
}

const currentYear = new Date().getFullYear()
const reportYears = Array.from({ length: 7 }, (_, index) => currentYear - 3 + index)

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthYear().month)
  const [selectedYear, setSelectedYear] = useState(getCurrentMonthYear().year)
  
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [propertyReports, setPropertyReports] = useState<PropertyReport[]>([])
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
      .select('*')
      .eq('user_id', user.id)
      .eq('billing_month', selectedMonth)
      .eq('billing_year', selectedYear)

    // Fetch all active leases
    const { data: leases } = await supabase
      .from('leases')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')

    // Fetch tenants count
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)

    // Calculate property reports
    const propertyReportsData: PropertyReport[] = []
    
    if (properties) {
      properties.forEach((prop: any) => {
        const units = prop.units || []
        const occupied = units.filter((u: any) => u.status === 'occupied').length
        const vacant = units.filter((u: any) => u.status === 'vacant').length
        
        const propInvoices = invoices?.filter((inv: any) => inv.property_id === prop.id) || []
        const totalInvoiced = propInvoices.reduce((sum: number, inv: any) => sum + inv.subtotal, 0)
        const totalCollected = propInvoices.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0)
        
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
        })
      })
    }

    setPropertyReports(propertyReportsData)

    // Calculate summary
    const totalInvoiced = invoices?.reduce((sum: number, inv: any) => sum + inv.subtotal, 0) || 0
    const totalCollected = invoices?.reduce((sum: number, inv: any) => sum + inv.amount_paid, 0) || 0
    const overdueInvoices = invoices?.filter((inv: any) => inv.status === 'overdue') || []

    const totalUnits = properties?.reduce((sum: number, p: any) => sum + (p.units?.length || 0), 0) || 0
    const occupiedUnits = properties?.reduce((sum: number, p: any) => {
      return sum + (p.units?.filter((u: any) => u.status === 'occupied').length || 0)
    }, 0) || 0

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
    })

    setLoading(false)
  }

  const handleExportCSV = () => {
    const csvContent = [
      ['Property', 'Type', 'Units', 'Occupied', 'Vacant', 'Monthly Rent', 'Invoiced', 'Collected', 'Outstanding'],
      ...propertyReports.map(p => [
        p.property_name,
        p.property_type,
        p.total_units,
        p.occupied_units,
        p.vacant_units,
        p.monthly_rent,
        p.total_invoiced,
        p.total_collected,
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
                  <td className={`table-cell ${property.outstanding > 0 ? 'text-danger-600' : ''}`}>
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
