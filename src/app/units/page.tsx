import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, DoorOpen } from 'lucide-react'
import { getLabelByValue, getColorByValue, UNIT_TYPES, UNIT_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

const floorSortOrder: Record<string, number> = {
  basement: 0,
  'ground floor': 1,
  'first floor': 2,
  'second floor': 3,
  'third floor': 4,
  'fourth floor': 5,
  'fifth floor': 6,
}

async function getUnits() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data: units, error } = await supabase
    .from('units')
    .select(`
      *,
      properties(name),
      property_sections(name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const getFirst = <T,>(value: T | T[] | null | undefined) => Array.isArray(value) ? value[0] : value

  if (error) {
    console.error('Error fetching units:', error)
    return []
  }

  // Get current lease info for each unit
  const unitsWithLeases = await Promise.all(
    (units || []).map(async (unit) => {
      const { data: lease } = await supabase
        .from('leases')
        .select('tenant_id, end_date, tenants(full_name, business_name)')
        .eq('unit_id', unit.id)
        .eq('status', 'active')
        .single()

      const property = getFirst(unit.properties)
      const section = getFirst(unit.property_sections)
      const tenant = getFirst(lease?.tenants)

      return {
        ...unit,
        property_name: property?.name,
        section_name: section?.name,
        current_tenant_id: lease?.tenant_id || null,
        current_tenant_name: tenant?.full_name || tenant?.business_name || null,
        lease_end_date: lease?.end_date || null,
      }
    })
  )

  return unitsWithLeases.sort((a, b) => {
    const propertyCompare = (a.property_name || '').localeCompare(b.property_name || '')
    if (propertyCompare !== 0) return propertyCompare

    const aFloorOrder = floorSortOrder[(a.section_name || '').toLowerCase()] ?? 999
    const bFloorOrder = floorSortOrder[(b.section_name || '').toLowerCase()] ?? 999
    if (aFloorOrder !== bFloorOrder) return aFloorOrder - bFloorOrder

    const tenantCompare = (a.current_tenant_name || '').localeCompare(b.current_tenant_name || '')
    if (tenantCompare !== 0) return tenantCompare

    return a.unit_name.localeCompare(b.unit_name)
  })
}

export default async function UnitsPage() {
  const units = await getUnits()

  const vacantCount = units.filter(u => u.status === 'vacant').length
  const occupiedCount = units.filter(u => u.status === 'occupied').length
  const maintenanceCount = units.filter(u => u.status === 'under_maintenance').length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Units</h1>
          <p className="text-gray-500">Manage your property units and spaces</p>
        </div>
        <Link href="/units/new" className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          Add Unit
        </Link>
      </div>

      {/* Status Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Units</p>
          <p className="stat-value">{units.length}</p>
        </div>
        <div className="stat-card border-l-4 border-success-500">
          <p className="stat-label">Vacant</p>
          <p className="stat-value text-success-600">{vacantCount}</p>
        </div>
        <div className="stat-card border-l-4 border-primary-500">
          <p className="stat-label">Occupied</p>
          <p className="stat-value">{occupiedCount}</p>
        </div>
        <div className="stat-card border-l-4 border-warning-500">
          <p className="stat-label">Maintenance</p>
          <p className="stat-value text-warning-600">{maintenanceCount}</p>
        </div>
      </div>

      {units.length === 0 ? (
        <div className="card p-12 text-center">
          <DoorOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No units yet</h3>
          <p className="text-gray-500 mb-6">Add units to your properties</p>
          <Link href="/units/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Unit
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Unit</th>
                  <th className="table-header-cell">Property</th>
                  <th className="table-header-cell">Type</th>
                  <th className="table-header-cell">Status</th>
                  <th className="table-header-cell">Monthly Rent</th>
                  <th className="table-header-cell">Current Tenant</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {units.map((unit) => (
                  <tr key={unit.id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                          <DoorOpen className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="ml-4">
                          <p className="font-medium text-gray-900">{unit.unit_name}</p>
                          {unit.unit_identifier && (
                            <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">ID: {unit.unit_identifier}</p>
                          )}
                          {unit.section_name && (
                            <p className="text-sm text-gray-500">{unit.section_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <p className="text-sm text-gray-900">{unit.property_name}</p>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-gray-100 text-gray-800">
                        {getLabelByValue(UNIT_TYPES, unit.unit_type)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getColorByValue(UNIT_STATUSES, unit.status)}`}>
                        {getLabelByValue(UNIT_STATUSES, unit.status)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <p className="font-medium text-gray-900">{formatCurrency(unit.monthly_rent)}</p>
                    </td>
                    <td className="table-cell">
                      {unit.current_tenant_name ? (
                        <div>
                          {unit.current_tenant_id ? (
                            <Link href={`/tenants/${unit.current_tenant_id}`} className="text-sm font-medium text-primary-600 hover:underline">
                              {unit.current_tenant_name}
                            </Link>
                          ) : (
                            <p className="text-sm text-gray-900">{unit.current_tenant_name}</p>
                          )}
                          {unit.lease_end_date && (
                            <p className="text-xs text-gray-500">
                              Until {formatDate(unit.lease_end_date)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-3">
                      <Link 
                        href={`/units/${unit.id}`}
                        className="text-primary-600 hover:text-primary-900 font-medium"
                      >
                        View
                      </Link>
                      <Link 
                        href={`/units/${unit.id}/edit`}
                        className="text-slate-600 hover:text-slate-900 font-medium"
                      >
                        Edit
                      </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
