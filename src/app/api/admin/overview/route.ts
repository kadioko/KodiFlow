import { NextResponse } from 'next/server'
import { createServiceClient, getCurrentAdmin, isAdminRole } from '@/lib/supabase/admin'

async function getCount(serviceClient: ReturnType<typeof createServiceClient>, table: string) {
  const { count, error } = await serviceClient
    .from(table)
    .select('id', { count: 'exact', head: true })

  if (error) throw error
  return count || 0
}

export async function GET() {
  const currentAdmin = await getCurrentAdmin()

  if (!isAdminRole(currentAdmin.role)) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  try {
    const [
      profileCount,
      adminCount,
      propertyCount,
      unitCount,
      tenantCount,
      leaseCount,
      invoiceCount,
      paymentCount,
      invoiceData,
      paymentData,
    ] = await Promise.all([
      getCount(serviceClient, 'profiles'),
      serviceClient.from('profiles').select('id', { count: 'exact', head: true }).in('admin_role', ['admin', 'super_admin']).then(({ count, error }) => {
        if (error) throw error
        return count || 0
      }),
      getCount(serviceClient, 'properties'),
      getCount(serviceClient, 'units'),
      getCount(serviceClient, 'tenants'),
      getCount(serviceClient, 'leases'),
      getCount(serviceClient, 'rent_invoices'),
      getCount(serviceClient, 'payments'),
      serviceClient.from('rent_invoices').select('subtotal, amount_paid, balance, status').neq('status', 'cancelled'),
      serviceClient.from('payments').select('amount'),
    ])

    if (invoiceData.error) throw invoiceData.error
    if (paymentData.error) throw paymentData.error

    const invoices = invoiceData.data || []
    const payments = paymentData.data || []
    const outstanding = invoices
      .filter((invoice) => invoice.status !== 'transferred')
      .reduce((sum, invoice) => sum + Math.max(Number(invoice.balance || 0), 0), 0)
    const invoiceValue = invoices
      .filter((invoice) => invoice.status !== 'transferred')
      .reduce((sum, invoice) => sum + Number(invoice.subtotal || 0), 0)
    const collected = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

    return NextResponse.json({
      currentRole: currentAdmin.role,
      stats: {
        profiles: profileCount,
        admins: adminCount,
        properties: propertyCount,
        units: unitCount,
        tenants: tenantCount,
        leases: leaseCount,
        invoices: invoiceCount,
        payments: paymentCount,
        invoiceValue,
        collected,
        outstanding,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load platform overview' },
      { status: 500 }
    )
  }
}
