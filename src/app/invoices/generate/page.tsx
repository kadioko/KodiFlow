'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Receipt, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { formatCurrency, getCurrentMonthYear, getMonthName } from '@/utils/currency'
import { calculateInvoiceTotal as calculateBillingInvoiceTotal, getBillingPeriod } from '@/utils/billing'

interface Lease {
  id: string
  tenant_id: string
  unit_id: string
  property_id: string
  tenant_name: string
  unit_name: string
  property_name: string
  monthly_rent: number
  lease_type: string
  billing_frequency: string
}

interface Charge {
  id: string
  lease_id: string
  charge_name: string
  charge_type: string
  amount: number
  notes?: string
}

export default function GenerateInvoicesPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  
  const { month, year } = getCurrentMonthYear()
  
  const [billingMonth, setBillingMonth] = useState(month)
  const [billingYear, setBillingYear] = useState(year)
  const [dueDay, setDueDay] = useState(5)
  
  const [leases, setLeases] = useState<Lease[]>([])
  const [charges, setCharges] = useState<Record<string, Charge[]>>({})
  const [selectedLeases, setSelectedLeases] = useState<Set<string>>(new Set())
  const [generating, setGenerating] = useState<Set<string>>(new Set())

  // Fetch active leases
  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Fetch active leases
        const { data: leasesData } = await supabase
          .from('leases')
          .select(`
            id,
            tenant_id,
            unit_id,
            property_id,
            monthly_rent,
            lease_type,
            billing_frequency,
            tenants(full_name, business_name),
            units(unit_name),
            properties(name)
          `)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .order('created_at')
        
        if (leasesData) {
          const formattedLeases = leasesData.map((l: any) => ({
            id: l.id,
            tenant_id: l.tenant_id,
            unit_id: l.unit_id,
            property_id: l.property_id,
            tenant_name: l.tenants?.full_name || l.tenants?.business_name,
            unit_name: l.units?.unit_name,
            property_name: l.properties?.name,
            monthly_rent: l.monthly_rent,
            lease_type: l.lease_type,
            billing_frequency: l.billing_frequency,
          }))
          setLeases(formattedLeases)
          
          // Select all by default
          setSelectedLeases(new Set(formattedLeases.map(l => l.id)))

          // Fetch charges for each lease
          const leaseIds = formattedLeases.map(l => l.id)
          const { data: chargesData } = await supabase
            .from('charges')
            .select('*')
            .in('lease_id', leaseIds)
            .eq('is_active', true)
          
          if (chargesData) {
            const chargesByLease: Record<string, Charge[]> = {}
            chargesData.forEach((charge: any) => {
              if (!chargesByLease[charge.lease_id]) {
                chargesByLease[charge.lease_id] = []
              }
              chargesByLease[charge.lease_id].push(charge)
            })
            setCharges(chargesByLease)
          }
        }
      }
      setFetching(false)
    }
    fetchData()
  }, [])

  const toggleLease = (leaseId: string) => {
    const newSelected = new Set(selectedLeases)
    if (newSelected.has(leaseId)) {
      newSelected.delete(leaseId)
    } else {
      newSelected.add(leaseId)
    }
    setSelectedLeases(newSelected)
  }

  const toggleAll = () => {
    if (selectedLeases.size === leases.length) {
      setSelectedLeases(new Set())
    } else {
      setSelectedLeases(new Set(leases.map(l => l.id)))
    }
  }

  const calculateInvoiceTotal = (lease: Lease) => {
    const leaseCharges = charges[lease.id] || []
    return calculateBillingInvoiceTotal(
      lease.monthly_rent,
      leaseCharges.filter(charge => charge.charge_type !== 'rent').map(charge => charge.amount),
      lease.billing_frequency
    )
  }

  const generateInvoices = async () => {
    if (selectedLeases.size === 0) {
      setError('Please select at least one lease')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be logged in')
      setLoading(false)
      return
    }

    const selectedLeasesList = leases.filter(l => selectedLeases.has(l.id))
    let generated = 0
    let skipped = 0
    const generatingSet = new Set<string>()

    for (const lease of selectedLeasesList) {
      generatingSet.add(lease.id)
      setGenerating(new Set(generatingSet))

      // Check if invoice already exists for this period
      const { data: existingInvoice } = await supabase
        .from('rent_invoices')
        .select('id')
        .eq('lease_id', lease.id)
        .eq('billing_month', billingMonth)
        .eq('billing_year', billingYear)
        .maybeSingle()

      if (existingInvoice) {
        skipped++
        generatingSet.delete(lease.id)
        setGenerating(new Set(generatingSet))
        continue
      }

      // Calculate billing period
      const { months, periodStart, periodEnd } = getBillingPeriod(billingYear, billingMonth, lease.billing_frequency)
      const dueDate = new Date(billingYear, billingMonth - 1, dueDay)

      // Calculate subtotal
      const subtotal = calculateInvoiceTotal(lease)

      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('rent_invoices')
        .insert({
          user_id: user.id,
          lease_id: lease.id,
          tenant_id: lease.tenant_id,
          unit_id: lease.unit_id,
          property_id: lease.property_id,
          billing_period_start: periodStart.toISOString().split('T')[0],
          billing_period_end: periodEnd.toISOString().split('T')[0],
          billing_month: billingMonth,
          billing_year: billingYear,
          subtotal: subtotal,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'unpaid',
        })
        .select()
        .single()

      if (invoiceError || !invoice) {
        console.error('Error creating invoice:', invoiceError)
        generatingSet.delete(lease.id)
        setGenerating(new Set(generatingSet))
        continue
      }

      // Create invoice items
      const invoiceItems = []
      
      // Rent item
      invoiceItems.push({
        user_id: user.id,
        invoice_id: invoice.id,
        item_name: `${months === 1 ? getMonthName(billingMonth) : `${months}-Month`} ${billingYear} Rent`,
        item_type: 'rent',
        amount: lease.monthly_rent * months,
      })

      // Additional charges
      const leaseCharges = charges[lease.id] || []
      leaseCharges.forEach(charge => {
        if (charge.charge_type !== 'rent') {
          invoiceItems.push({
            user_id: user.id,
            invoice_id: invoice.id,
            item_name: charge.charge_name,
            item_type: charge.charge_type,
            amount: charge.amount * months,
            notes: charge.notes,
          })
        }
      })

      // Insert invoice items
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems)

      if (itemsError) {
        console.error('Error creating invoice items:', itemsError)
      } else {
        generated++
      }

      generatingSet.delete(lease.id)
      setGenerating(new Set(generatingSet))
    }

    setLoading(false)
    setGenerating(new Set())
    
    if (generated > 0) {
      setSuccess(`Generated ${generated} invoice(s). ${skipped > 0 ? `Skipped ${skipped} (already exist).` : ''}`)
      setTimeout(() => {
        router.push('/invoices')
        router.refresh()
      }, 2000)
    } else if (skipped > 0) {
      setError(`All ${skipped} invoice(s) already exist for this billing period.`)
    } else {
      setError('Failed to generate invoices. Please try again.')
    }
  }

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="page-header">
        <div className="flex items-center">
          <Link href="/invoices" className="mr-4 p-2 rounded-lg hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="page-title">Generate Invoices</h1>
            <p className="text-gray-500">Create rent invoices for active leases</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-danger-50 border border-danger-200 text-danger-700 px-4 py-3 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 bg-success-50 border border-success-200 text-success-700 px-4 py-3 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 mr-2" />
          {success}
        </div>
      )}

      {/* Billing Period Settings */}
      <div className="card mb-6">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Billing Period</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="label">Month</label>
              <select
                value={billingMonth}
                onChange={(e) => setBillingMonth(parseInt(e.target.value))}
                className="input"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {getMonthName(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="label">Year</label>
              <input
                type="number"
                value={billingYear}
                onChange={(e) => setBillingYear(parseInt(e.target.value))}
                className="input"
                min="2020"
                max="2050"
              />
            </div>

            <div className="form-group">
              <label className="label">Due Day of Month</label>
              <select
                value={dueDay}
                onChange={(e) => setDueDay(parseInt(e.target.value))}
                className="input"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                  <option key={day} value={day}>
                    {day}th
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Leases List */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedLeases.size === leases.length && leases.length > 0}
              onChange={toggleAll}
              className="h-4 w-4 text-primary-600 rounded border-gray-300 mr-3"
            />
            <h3 className="text-lg font-semibold text-gray-900">
              Active Leases ({selectedLeases.size} of {leases.length} selected)
            </h3>
          </div>
        </div>

        <div className="table-container">
          <table className="table">
            <thead className="table-header">
              <tr>
                <th className="table-header-cell w-10"></th>
                <th className="table-header-cell">Tenant</th>
                <th className="table-header-cell">Property/Unit</th>
                <th className="table-header-cell">Base Rent</th>
                <th className="table-header-cell">Additional Charges</th>
                <th className="table-header-cell">Total</th>
              </tr>
            </thead>
            <tbody className="table-body">
              {leases.map((lease) => {
                const leaseCharges = charges[lease.id] || []
                const additionalTotal = leaseCharges.reduce((sum, c) => sum + c.amount, 0)
                const total = calculateInvoiceTotal(lease)
                const isGenerating = generating.has(lease.id)

                return (
                  <tr key={lease.id} className={`hover:bg-gray-50 ${isGenerating ? 'opacity-50' : ''}`}>
                    <td className="table-cell">
                      <input
                        type="checkbox"
                        checked={selectedLeases.has(lease.id)}
                        onChange={() => toggleLease(lease.id)}
                        disabled={isGenerating}
                        className="h-4 w-4 text-primary-600 rounded border-gray-300"
                      />
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{lease.tenant_name}</p>
                      <p className="text-xs text-gray-500">{lease.lease_type}</p>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{lease.property_name}</p>
                      <p className="text-xs text-gray-500">{lease.unit_name}</p>
                    </td>
                    <td className="table-cell">{formatCurrency(lease.monthly_rent)}</td>
                    <td className="table-cell">
                      {leaseCharges.length > 0 ? (
                        <div className="text-sm">
                          <p className="text-success-600">+{formatCurrency(additionalTotal)}</p>
                          <p className="text-xs text-gray-500">
                            {leaseCharges.map(c => c.charge_name).join(', ')}
                          </p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell font-semibold">{formatCurrency(total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {leases.length === 0 && (
          <div className="p-8 text-center">
            <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No active leases found.</p>
            <Link href="/leases/new" className="btn-primary mt-4 inline-flex">
              Create Lease
            </Link>
          </div>
        )}
      </div>

      {/* Generate Button */}
      {leases.length > 0 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-gray-600">
            Total to generate: {formatCurrency(
              Array.from(selectedLeases).reduce((sum, leaseId) => {
                const lease = leases.find(l => l.id === leaseId)
                return sum + (lease ? calculateInvoiceTotal(lease) : 0)
              }, 0)
            )}
          </p>
          <button
            onClick={generateInvoices}
            disabled={loading || selectedLeases.size === 0}
            className="btn-success text-lg px-8 py-3"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Receipt className="h-5 w-5 mr-2" />
                Generate {selectedLeases.size} Invoice(s)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
