import { createClient } from '@/lib/supabase/server'
import { firstRelation, tenantName, type Row, type Relation, type TenantName } from '@/lib/supabase/query-results'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { redirect } from 'next/navigation'

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = (Array.isArray(params.q) ? params.q[0] || '' : params.q || '').trim()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?next=/search')
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
          .select('id, unit_name, unit_identifier, status, properties(name)')
          .eq('user_id', user.id)
          .or(`unit_name.ilike.${pattern},unit_identifier.ilike.${pattern}`)
          .limit(10),
        supabase
          .from('rent_invoices')
          .select('id, invoice_number, status, subtotal, tenants(full_name, business_name)')
          .eq('user_id', user.id)
          .ilike('invoice_number', pattern)
          .limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }]

  const properties = (propertiesResult.data || []) as Pick<Row<'properties'>, 'id' | 'name' | 'property_type' | 'location'>[]
  const tenants = (tenantsResult.data || []) as Pick<Row<'tenants'>, 'id' | 'full_name' | 'business_name' | 'phone' | 'email'>[]
  const units = (unitsResult.data || []) as (Pick<Row<'units'>, 'id' | 'unit_name' | 'unit_identifier' | 'status'> & { properties: Relation<{ name: string }> })[]
  const invoices = (invoicesResult.data || []) as (Pick<Row<'rent_invoices'>, 'id' | 'invoice_number' | 'status' | 'subtotal'> & { tenants: Relation<TenantName> })[]
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
          <SearchSection title="Properties" items={properties.map((property) => ({
            href: `/properties/${property.id}`,
            title: property.name,
            subtitle: `${property.property_type}${property.location ? ` • ${property.location}` : ''}`,
          }))} />
          <SearchSection title="Tenants" items={tenants.map((tenant) => ({
            href: `/tenants/${tenant.id}`,
            title: tenant.full_name || tenant.business_name || 'Unnamed tenant',
            subtitle: [tenant.phone, tenant.email].filter(Boolean).join(' • '),
          }))} />
          <SearchSection title="Units" items={units.map((unit) => ({
            href: `/units/${unit.id}`,
            title: unit.unit_identifier ? `${unit.unit_identifier} / ${unit.unit_name}` : unit.unit_name,
            subtitle: `${firstRelation(unit.properties)?.name || 'Property'} • ${unit.status}`,
          }))} />
          <SearchSection title="Invoices" items={invoices.map((invoice) => ({
            href: `/invoices/${invoice.id}`,
            title: invoice.invoice_number || 'Invoice',
            subtitle: `${invoice.status} • ${tenantName(invoice.tenants)}`,
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

