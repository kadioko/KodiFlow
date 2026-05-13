'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Eye, EyeOff } from 'lucide-react'
import { formatCurrency } from '@/utils/currency'

type DashboardProperty = {
  id: string
  name: string
  property_type: string
  total_units: number
  occupied_units: number
  vacant_units: number
  monthly_rent: number
}

type DashboardPropertyVisibilityProps = {
  properties: DashboardProperty[]
}

const storageKey = 'kodiflow-dashboard-hidden-properties'

export default function DashboardPropertyVisibility({ properties }: DashboardPropertyVisibilityProps) {
  const [hiddenIds, setHiddenIds] = useState<string[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey)
    if (saved) {
      setHiddenIds(JSON.parse(saved))
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify(hiddenIds))
    }
  }, [hiddenIds, loaded])

  const visibleProperties = useMemo(
    () => properties.filter((property) => !hiddenIds.includes(property.id)),
    [properties, hiddenIds]
  )

  const hiddenProperties = useMemo(
    () => properties.filter((property) => hiddenIds.includes(property.id)),
    [properties, hiddenIds]
  )

  const toggleProperty = (propertyId: string) => {
    setHiddenIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId]
    )
  }

  if (properties.length === 0) {
    return null
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Dashboard Properties</h3>
          <p className="text-sm text-gray-500">Show or hide properties from this dashboard view</p>
        </div>
        {hiddenProperties.length > 0 && (
          <button
            type="button"
            onClick={() => setHiddenIds([])}
            className="btn-secondary text-sm"
          >
            Show All
          </button>
        )}
      </div>
      <div className="card-body space-y-4">
        {visibleProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {visibleProperties.map((property) => {
              const occupancyRate = property.total_units > 0
                ? Math.round((property.occupied_units / property.total_units) * 100)
                : 0

              return (
                <div key={property.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/properties/${property.id}`} className="font-semibold text-gray-900 hover:text-primary-600">
                        {property.name}
                      </Link>
                      <p className="text-sm text-gray-500 capitalize">{property.property_type.replace('_', ' ')}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleProperty(property.id)}
                      className="text-gray-400 hover:text-gray-700"
                      aria-label={`Hide ${property.name}`}
                    >
                      <EyeOff className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Units</p>
                      <p className="font-semibold">{property.total_units}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Occupied</p>
                      <p className="font-semibold text-primary-600">{property.occupied_units}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Vacant</p>
                      <p className="font-semibold text-success-600">{property.vacant_units}</p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">Occupancy</span>
                      <span className="font-medium">{occupancyRate}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-primary-500 rounded-full" style={{ width: `${occupancyRate}%` }} />
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-gray-500">
                    Expected rent: <span className="font-semibold text-gray-900">{formatCurrency(property.monthly_rent)}</span>
                  </p>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
            All properties are hidden from this dashboard view.
          </div>
        )}

        {hiddenProperties.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-2">Hidden properties</p>
            <div className="flex flex-wrap gap-2">
              {hiddenProperties.map((property) => (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => toggleProperty(property.id)}
                  className="inline-flex items-center rounded-full border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {property.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
