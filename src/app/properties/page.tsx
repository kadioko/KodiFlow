import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, MapPin, ChevronRight } from 'lucide-react'
import { getLabelByValue, getColorByValue, PROPERTY_TYPES } from '@/utils/constants'
import OperationalListFilters from '@/components/ui/OperationalListFilters'

type PropertyWithRelations = {
  id: string
  name: string
  property_type: 'residential' | 'commercial' | 'mixed_use'
  location: string | null
  description: string | null
  created_at: string
  updated_at: string
  property_sections: { count: number }[] | null
  units: { id: string; status: string }[] | null
}

async function getProperties() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data: properties, error } = await supabase
    .from('properties')
    .select(`
      *,
      property_sections(count),
      units(id, status)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching properties:', error)
    return []
  }

  return ((properties || []) as unknown as PropertyWithRelations[]).map((property) => {
    const units = property.units || []
    return {
      ...property,
      total_units: units.length,
      occupied_units: units.filter((unit) => unit.status === 'occupied').length,
      vacant_units: units.filter((unit) => unit.status === 'vacant').length,
      sections_count: property.property_sections?.[0]?.count || 0,
    }
  })
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const allProperties = await getProperties()
  const query = (typeof params?.q === 'string' ? params.q : '').trim().toLowerCase()
  const type = typeof params?.type === 'string' ? params.type : 'all'
  const occupancy = typeof params?.occupancy === 'string' ? params.occupancy : 'all'
  const sort = typeof params?.sort === 'string' ? params.sort : 'newest'
  const properties = allProperties
    .filter((property) => {
      const searchable = [property.name, property.location, property.property_type].filter(Boolean).join(' ').toLowerCase()
      return (!query || searchable.includes(query))
        && (type === 'all' || property.property_type === type)
        && (occupancy === 'all' || (occupancy === 'vacant' ? property.vacant_units > 0 : property.total_units > 0 && property.occupied_units === property.total_units))
    })
    .sort((a, b) => {
      if (sort === 'name_asc') return a.name.localeCompare(b.name)
      if (sort === 'vacancy_desc') return b.vacant_units - a.vacant_units
      if (sort === 'occupancy_asc') return (a.occupied_units / Math.max(a.total_units, 1)) - (b.occupied_units / Math.max(b.total_units, 1))
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Properties</h1>
          <p className="text-gray-500">Manage your residential, commercial, and mixed-use properties</p>
        </div>
        <Link href="/properties/new" className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          Add Property
        </Link>
      </div>

      <OperationalListFilters
        searchPlaceholder="Search properties or locations"
        filters={[
          { key: 'type', label: 'Types', options: PROPERTY_TYPES },
          { key: 'occupancy', label: 'Occupancy', options: [{ value: 'vacant', label: 'Has vacant units' }, { value: 'full', label: 'Fully occupied' }] },
        ]}
        sortOptions={[{ value: 'newest', label: 'Newest property' }, { value: 'name_asc', label: 'Name A-Z' }, { value: 'vacancy_desc', label: 'Most vacant units' }, { value: 'occupancy_asc', label: 'Lowest occupancy' }]}
        savedViews={[{ label: 'All properties', params: {} }, { label: 'Vacant units', params: { occupancy: 'vacant', sort: 'vacancy_desc' } }, { label: 'Fully occupied', params: { occupancy: 'full' } }]}
      />

      {properties.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">{allProperties.length ? 'No matching properties' : 'No properties yet'}</h3>
          <p className="text-gray-500 mb-6">{allProperties.length ? 'Clear or change the filters to see more properties.' : 'Get started by adding your first property'}</p>
          <Link href="/properties/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Property
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="card hover:shadow-md transition-shadow group"
            >
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center">
                    <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${getColorByValue(PROPERTY_TYPES, property.property_type)}`}>
                      <Building2 className="h-6 w-6" />
                    </div>
                    <div className="ml-4">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
                        {property.name}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getColorByValue(PROPERTY_TYPES, property.property_type)}`}>
                        {getLabelByValue(PROPERTY_TYPES, property.property_type)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </div>

                {property.location && (
                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <MapPin className="h-4 w-4 mr-1" />
                    {property.location}
                  </div>
                )}

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{property.sections_count}</p>
                      <p className="text-xs text-gray-500">Sections</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{property.total_units}</p>
                      <p className="text-xs text-gray-500">Units</p>
                    </div>
                    <div>
                      <p className={`text-2xl font-bold ${property.vacant_units > 0 ? 'text-success-600' : 'text-gray-900'}`}>
                        {property.vacant_units}
                      </p>
                      <p className="text-xs text-gray-500">Vacant</p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Occupancy</span>
                    <span className="font-medium text-gray-900">
                      {property.total_units > 0 
                        ? Math.round((property.occupied_units / property.total_units) * 100) 
                        : 0}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary-600 h-2 rounded-full transition-all"
                      style={{ width: `${property.total_units > 0 ? (property.occupied_units / property.total_units) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

