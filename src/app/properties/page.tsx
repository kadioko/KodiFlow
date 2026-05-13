import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Plus, Building2, MapPin, ChevronRight } from 'lucide-react'
import { getLabelByValue, getColorByValue, PROPERTY_TYPES } from '@/utils/constants'

async function getProperties() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return []

  const { data: properties, error } = await supabase
    .from('properties')
    .select(`
      *,
      property_sections(count),
      units(count)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching properties:', error)
    return []
  }

  // Get occupied units count for each property
  const propertiesWithStats = await Promise.all(
    (properties || []).map(async (property) => {
      const { data: units } = await supabase
        .from('units')
        .select('status')
        .eq('property_id', property.id)
      
      const occupied = units?.filter(u => u.status === 'occupied').length || 0
      const vacant = units?.filter(u => u.status === 'vacant').length || 0
      const total = units?.length || 0

      return {
        ...property,
        total_units: total,
        occupied_units: occupied,
        vacant_units: vacant,
        sections_count: property.property_sections?.[0]?.count || 0,
      }
    })
  )

  return propertiesWithStats
}

export default async function PropertiesPage() {
  const properties = await getProperties()

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

      {properties.length === 0 ? (
        <div className="card p-12 text-center">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No properties yet</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first property</p>
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
