import type { Database } from './database.types'

export type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Relation<T> = T | T[] | null
export type TenantName = Pick<Row<'tenants'>, 'full_name' | 'business_name'>

export function firstRelation<T>(value: Relation<T> | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value ?? undefined
}

export function tenantName(value: Relation<TenantName> | undefined): string {
  const tenant = firstRelation(value)
  return tenant?.full_name || tenant?.business_name || 'Unnamed tenant'
}

export type PropertyWithUnitSummary = Pick<Row<'properties'>, 'id' | 'name' | 'property_type'> & {
  units: Pick<Row<'units'>, 'id' | 'status' | 'monthly_rent'>[] | null
}
export type UnitOptionRow = Pick<Row<'units'>, 'id' | 'unit_name' | 'unit_identifier' | 'property_id' | 'monthly_rent' | 'usage_type' | 'status'> & {
  properties: Relation<Pick<Row<'properties'>, 'name'>>
}
export type LeaseWithTenant = Row<'leases'> & { tenants: Relation<TenantName> }
export type LeaseWithLocation = LeaseWithTenant & {
  units: Relation<Pick<Row<'units'>, 'unit_name'>>
  properties?: Relation<Pick<Row<'properties'>, 'name'>>
}
export type InvoiceWithLocation = Row<'rent_invoices'> & {
  tenants: Relation<TenantName>
  units: Relation<Pick<Row<'units'>, 'unit_name'>>
}
export type PaymentWithTenant = Row<'payments'> & {
  tenants: Relation<TenantName>
  rent_invoices?: Relation<Pick<Row<'rent_invoices'>, 'invoice_number'>>
}
export type SectionWithUnitCount = Row<'property_sections'> & { units: { count: number }[] | null }
export type PropertyUnitRow = Row<'units'> & {
  property_sections: Relation<Pick<Row<'property_sections'>, 'name'>>
  leases: (Pick<Row<'leases'>, 'tenant_id' | 'status'> & { tenants: Relation<TenantName> })[] | null
}
