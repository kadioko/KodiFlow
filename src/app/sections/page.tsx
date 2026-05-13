import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Building2, Layers, Plus } from 'lucide-react'
import { SECTION_TYPES, getLabelByValue } from '@/utils/constants'

async function getSections() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: sections, error } = await supabase
    .from('property_sections')
    .select(`
      *,
      properties(name),
      units(count)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sections:', error)
    return []
  }

  return (sections || []).map((section) => ({
    ...section,
    property_name: Array.isArray(section.properties) ? section.properties[0]?.name : section.properties?.name,
    units_count: Array.isArray(section.units) ? section.units[0]?.count || 0 : 0,
  }))
}

export default async function SectionsPage() {
  const sections = await getSections()

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sections</h1>
          <p className="text-gray-500">Manage floors, blocks, wings, and zones across your properties</p>
        </div>
        <Link href="/sections/new" className="btn-primary">
          <Plus className="h-5 w-5 mr-2" />
          Add Section
        </Link>
      </div>

      {sections.length === 0 ? (
        <div className="card p-12 text-center">
          <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sections yet</h3>
          <p className="text-gray-500 mb-6">Create sections to organize units by floor, block, wing, or zone.</p>
          <Link href="/sections/new" className="btn-primary">
            <Plus className="h-5 w-5 mr-2" />
            Add Section
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Section</th>
                  <th className="table-header-cell">Property</th>
                  <th className="table-header-cell">Type</th>
                  <th className="table-header-cell">Units</th>
                  <th className="table-header-cell">Actions</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {sections.map((section) => (
                  <tr key={section.id} className="hover:bg-slate-50">
                    <td className="table-cell">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-xl bg-primary-100 flex items-center justify-center">
                          <Layers className="h-5 w-5 text-primary-600" />
                        </div>
                        <div className="ml-4">
                          <p className="font-semibold text-slate-900">{section.name}</p>
                          {section.description && <p className="text-sm text-slate-500">{section.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center text-slate-700">
                        <Building2 className="h-4 w-4 mr-2 text-slate-400" />
                        {section.property_name || 'Unknown property'}
                      </div>
                    </td>
                    <td className="table-cell">
                      <span className="badge bg-slate-100 text-slate-800">
                        {getLabelByValue(SECTION_TYPES, section.section_type)}
                      </span>
                    </td>
                    <td className="table-cell">{section.units_count}</td>
                    <td className="table-cell">
                      <Link href={`/sections/${section.id}/edit`} className="text-primary-600 hover:text-primary-900 font-medium">
                        Edit
                      </Link>
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
