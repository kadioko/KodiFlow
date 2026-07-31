import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, DoorOpen } from 'lucide-react'
import { getLabelByValue, getColorByValue, UNIT_TYPES, UNIT_STATUSES } from '@/utils/constants'
import { formatCurrency, formatDate } from '@/utils/currency'

type UnitStatusFilter = 'all' | 'vacant' | 'occupied' | 'reserved' | 'under_maintenance' | 'inactive'
type UnitSort = 'property' | 'vacant_first' | 'rent_desc' | 'rent_asc' | 'lease_end_asc' | 'newest'

const floorSortOrder: Record<string, number> = {
  basement: 0,
  'ground floor': 1,
  'first floor': 2,
  'second floor': 3,
  'third floor': 4,
  'fourth floor': 5,
  'fifth floor': 6,
}

function getQueryValue(value: string | string[] | undefined, fallback: string) {
  return Array.isArray(value) ? value[0] || fallback : value || fallback
}

function getStatusFilter(value: string | string[] | undefined): UnitStatusFilter {
  const status = getQueryValue(value, 'all')
  return ['all', 'vacant', 'occupied', 'reserved', 'under_maintenance', 'inactive'].includes(status)
    ? status as UnitStatusFilter
    : 'all'
}

function getSort(value: string | string[] | undefined): UnitSort {
  const sort = getQueryValue(value, 'property')
  return ['property', 'vacant_first', 'rent_desc', 'rent_asc', 'lease_end_asc', 'newest'].includes(sort)
    ? sort as UnitSort
    : 'property'
}

function createUnitsHref(status: UnitStatusFilter, sort: UnitSort) {
  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (sort !== 'property') params.set('sort', sort)
  const query = params.toString()
  return query ? `/units?${query}` : '/units'
}

function unitStatusRank(status: string) {
  switch (status) {
    case 'vacant': return 0
    case 'occupied': return 1
    case 'reserved': return 2
    case 'under_maintenance': return 3
    case 'inactive': return 4
    default: return 5
  }
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

  const unitIds = (units || []).map((unit) => unit.id)
  const { data: activeLeases } = unitIds.length > 0
    ? await supabase
      .from('leases')
      .select('unit_id, tenant_id, end_date, tenants(full_name, business_name)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('unit_id', unitIds)
    : { data: [] }

  const leaseByUnit = new Map((activeLeases || []).map((lease) => [lease.unit_id, lease]))
  const unitsWithLeases = (units || []).map((unit) => {
    const lease = leaseByUnit.get(unit.id)
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

export default async function UnitsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const statusFilter = getStatusFilter(params?.status)
  const sort = getSort(params?.sort)
  const allUnits = await getUnits()
  const units = (statusFilter === 'all' ? allUnits : allUnits.filter((unit) => unit.status === statusFilter))
    .sort((a, b) => {
      switch (sort) {
        case 'vacant_first':
          return unitStatusRank(a.status) - unitStatusRank(b.status) || a.unit_name.localeCompare(b.unit_name)
        case 'rent_desc': return b.monthly_rent - a.monthly_rent
        case 'rent_asc': return a.monthly_rent - b.monthly_rent
        case 'lease_end_asc': return (a.lease_end_date || '9999-12-31').localeCompare(b.lease_end_date || '9999-12-31')
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'property':
        default:
          return (a.property_name || '').localeCompare(b.property_name || '')
            || ((floorSortOrder[(a.section_name || '').toLowerCase()] ?? 999) - (floorSortOrder[(b.section_name || '').toLowerCase()] ?? 999))
            || a.unit_name.localeCompare(b.unit_name)
      }
    })

  const vacantCount = allUnits.filter(u => u.status === 'vacant').length
  const occupiedCount = allUnits.filter(u => u.status === 'occupied').length
  const maintenanceCount = allUnits.filter(u => u.status === 'under_maintenance').length
  const statusOptions: { value: UnitStatusFilter; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: allUnits.length },
    { value: 'vacant', label: 'Vacant', count: vacantCount },
    { value: 'occupied', label: 'Occupied', count: occupiedCount },
    { value: 'reserved', label: 'Reserved', count: allUnits.filter((unit) => unit.status === 'reserved').length },
    { value: 'under_maintenance', label: 'Maintenance', count: maintenanceCount },
    { value: 'inactive', label: 'Inactive', count: allUnits.filter((unit) => unit.status === 'inactive').length },
  ]
  const sortOptions: { value: UnitSort; label: string }[] = [
    { value: 'property', label: 'Property and unit' },
    { value: 'vacant_first', label: 'Vacant first' },
    { value: 'rent_desc', label: 'Highest rent' },
    { value: 'rent_asc', label: 'Lowest rent' },
    { value: 'lease_end_asc', label: 'Lease ending soonest' },
    { value: 'newest', label: 'Newest unit' },
  ]

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

      <div className="card p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Unit View</h2>
            <p className="text-sm text-gray-500">Showing {units.length} of {allUnits.length} unit{allUnits.length === 1 ? '' : 's'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {statusOptions.map((option) => (
              <Link key={option.value} href={createUnitsHref(option.value, sort)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${statusFilter === option.value ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>
                {option.label} ({option.count})
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {sortOptions.map((option) => (
            <Link key={option.value} href={createUnitsHref(statusFilter, option.value)} className={`min-h-11 rounded-lg px-3 py-2 text-sm font-semibold ${sort === option.value ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
              {option.label}
            </Link>
          ))}
        </div>
      </div>

      {allUnits.length === 0 ? (
        <div className="card p-12 text-center">
          <DoorOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No units yet</h3>
          <p className="text-gray-500 mb-6">Add units to your properties</p>
          <Link href="/units/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Unit
          </Link>
        </div>
      ) : units.length === 0 ? (
        <div className="card p-12 text-center">
          <DoorOpen className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">No {statusOptions.find((option) => option.value === statusFilter)?.label.toLowerCase()} units</h3>
          <p className="mb-6 text-gray-500">Try another status view to see the rest of your units.</p>
          <Link href={createUnitsHref('all', sort)} className="btn-secondary">View all units</Link>
        </div>
      ) : (
        <div className="card">
          <div className="divide-y divide-slate-100 md:hidden">
            {units.map((unit) => (
              <article key={unit.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{unit.unit_name}</p><p className="mt-0.5 text-sm text-slate-500">{unit.property_name}{unit.section_name ? ` · ${unit.section_name}` : ''}</p></div><span className={`badge ${getColorByValue(UNIT_STATUSES, unit.status)}`}>{getLabelByValue(UNIT_STATUSES, unit.status)}</span></div><div className="mt-3 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current tenant</p>{unit.current_tenant_id ? <Link href={`/tenants/${unit.current_tenant_id}`} className="mt-1 block text-sm font-semibold text-primary-700">{unit.current_tenant_name}</Link> : <p className="mt-1 text-sm text-slate-500">Unassigned</p>}</div><p className="text-right text-lg font-bold text-slate-900">{formatCurrency(unit.monthly_rent)}<span className="mt-0.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Monthly rent</span></p></div><div className="mt-3 flex gap-4 border-t border-slate-100 pt-3 text-sm font-semibold"><Link href={`/units/${unit.id}`} className="text-primary-700">View</Link><Link href={`/units/${unit.id}/edit`} className="text-slate-700">Edit</Link></div></article>
            ))}
          </div>
          <div className="hidden md:block table-container">
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
