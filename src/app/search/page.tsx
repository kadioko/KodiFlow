import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Search } from 'lucide-react'

type SearchPageProps = {
  searchParams: {
    q?: string
  }
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = (searchParams.q || '').trim()
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return <div>Loading...</div>
  }

  const pattern = `%${query}%`
  const hasQuery = query.length >= 2

  const [propertiesResult, tenantsResult, unitsResult, invoicesResult] = hasQuery
    ? await Promise.all([
        supabase
          .from('properties')
          .select('id, name, property_type, location')
          .eq('user_id', user.id)
          .or(`name.ilike.${pattern},location.ilike.${pattern},description.ilike.${pattern}`)
          .limit(10),
        supabase
          .from('tenants')
          .select('id, full_name, business_name, phone, email')
          .eq('user_id', user.id)
          .or(`full_name.ilike.${pattern},business_name.ilike.${pattern},phone.ilike.${pattern},email.ilike.${pattern}`)
          .limit(10),
        supabase
          .from('units')
          .select('id, unit_name, status, properties(name)')
          .eq('user_id', user.id)
          .ilike('unit_name', pattern)
          .limit(10),
        supabase
          .from('rent_invoices')
          .select('id, invoice_number, status, subtotal, tenants(full_name, business_name)')
          .eq('user_id', user.id)
          .ilike('invoice_number', pattern)
          .limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const properties = propertiesResult.data || []
  const tenants = tenantsResult.data || []
  const units = unitsResult.data || []
  const invoices = invoicesResult.data || []
  const totalResults = properties.length + tenants.length + units.length + invoices.length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Search</h1>
          <p className="text-gray-500">Find properties, tenants, units, and invoices</p>
        </div>
      </div>

      <div className="card p-6">
        <form action="/search" className="relative max-w-2xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            name="q"
            defaultValue={query}
            className="input pl-10"
            placeholder="Search by property, tenant, unit, or invoice..."
            type="search"
          />
        </form>
      </div>

      {!hasQuery ? (
        <div className="card p-12 text-center text-gray-500">Enter at least 2 characters to search.</div>
      ) : totalResults === 0 ? (
        <div className="card p-12 text-center text-gray-500">No results found for “{query}”.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SearchSection title="Properties" items={properties.map((property: any) => ({
            href: `/properties/${property.id}`,
            title: property.name,
            subtitle: `${property.property_type}${property.location ? ` • ${property.location}` : ''}`,
          }))} />
          <SearchSection title="Tenants" items={tenants.map((tenant: any) => ({
            href: `/tenants/${tenant.id}`,
            title: tenant.full_name || tenant.business_name || 'Unnamed tenant',
            subtitle: [tenant.phone, tenant.email].filter(Boolean).join(' • '),
          }))} />
          <SearchSection title="Units" items={units.map((unit: any) => ({
            href: `/units/${unit.id}`,
            title: unit.unit_name,
            subtitle: `${Array.isArray(unit.properties) ? unit.properties[0]?.name : unit.properties?.name || 'Property'} • ${unit.status}`,
          }))} />
          <SearchSection title="Invoices" items={invoices.map((invoice: any) => ({
            href: `/invoices/${invoice.id}`,
            title: invoice.invoice_number || 'Invoice',
            subtitle: `${invoice.status} • ${Array.isArray(invoice.tenants) ? invoice.tenants[0]?.full_name || invoice.tenants[0]?.business_name : invoice.tenants?.full_name || invoice.tenants?.business_name || 'Tenant'}`,
          }))} />
        </div>
      )}
    </div>
  )
}

function SearchSection({ title, items }: { title: string; items: { href: string; title: string; subtitle: string }[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="divide-y divide-gray-100">
        {items.length === 0 ? (
          <p className="p-4 text-sm text-gray-500">No matches</p>
        ) : items.map((item) => (
          <Link key={item.href} href={item.href} className="block p-4 hover:bg-gray-50">
            <p className="font-medium text-gray-900">{item.title}</p>
            <p className="text-sm text-gray-500">{item.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
