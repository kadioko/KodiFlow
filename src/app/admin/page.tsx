'use client'

import { useEffect, useState } from 'react'
import { Shield, UserPlus, Save } from 'lucide-react'

type AdminRole = 'admin' | 'super_admin'

type AdminUser = {
  id: string
  email: string | null
  full_name: string | null
  admin_role: AdminRole
  created_at?: string
  updated_at?: string
}

export default function AdminPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [currentRole, setCurrentRole] = useState<'none' | AdminRole>('none')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    adminRole: 'admin' as AdminRole,
  })

  const canManageAdmins = currentRole === 'super_admin'

  const fetchAdmins = async () => {
    setLoading(true)
    setError('')

    const response = await fetch('/api/admin/users')
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Could not load admin users')
      setLoading(false)
      return
    }

    setAdmins(data.admins || [])
    setCurrentRole(data.currentRole || 'none')
    setLoading(false)
  }

  useEffect(() => {
    fetchAdmins()
  }, [])

  const addAdmin = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Admin user was not created')
    } else {
      setMessage('Admin user created')
      setFormData({ fullName: '', email: '', password: '', adminRole: 'admin' })
      await fetchAdmins()
    }

    setSaving(false)
  }

  const changeRole = async (id: string, adminRole: 'none' | AdminRole) => {
    setMessage('')
    setError('')

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, adminRole }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Admin role was not updated')
    } else {
      setMessage('Admin role updated')
      await fetchAdmins()
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="page-title">Admin</h1>
            <p className="text-gray-500">Manage KodiFlow administrators and protected platform settings</p>
          </div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="card">
          <div className="card-header">
            <h2 className="text-lg font-semibold">Admin Accounts</h2>
          </div>
          <div className="card-body">
            {loading ? (
              <p className="text-sm text-slate-500">Loading admins...</p>
            ) : admins.length === 0 ? (
              <p className="text-sm text-slate-500">No admin accounts found.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">User</th>
                      <th className="table-header-cell">Role</th>
                      <th className="table-header-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {admins.map((admin) => (
                      <tr key={admin.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <p className="font-medium text-slate-900">{admin.full_name || admin.email}</p>
                          <p className="text-xs text-slate-500">{admin.email}</p>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${admin.admin_role === 'super_admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                            {admin.admin_role === 'super_admin' ? 'Super Admin' : 'Admin'}
                          </span>
                        </td>
                        <td className="table-cell">
                          {canManageAdmins ? (
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => changeRole(admin.id, 'admin')} className="btn-secondary text-xs">
                                Make Admin
                              </button>
                              <button type="button" onClick={() => changeRole(admin.id, 'super_admin')} className="btn-secondary text-xs">
                                Make Super
                              </button>
                              <button type="button" onClick={() => changeRole(admin.id, 'none')} className="btn-danger text-xs">
                                Remove
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm text-slate-500">View only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <section className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <UserPlus className="h-5 w-5 text-primary-600" />
            <div>
              <h2 className="font-semibold text-slate-900">Add Admin</h2>
              <p className="text-sm text-slate-500">Super admins can create new admin accounts.</p>
            </div>
          </div>

          <form onSubmit={addAdmin} className="space-y-4">
            <div className="form-group">
              <label htmlFor="admin_full_name" className="label">Name</label>
              <input
                id="admin_full_name"
                className="input"
                value={formData.fullName}
                onChange={(event) => setFormData({ ...formData, fullName: event.target.value })}
                disabled={!canManageAdmins}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin_email" className="label">Email</label>
              <input
                id="admin_email"
                type="email"
                required
                className="input"
                value={formData.email}
                onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                disabled={!canManageAdmins}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin_password" className="label">Temporary Password</label>
              <input
                id="admin_password"
                type="password"
                required
                minLength={8}
                className="input"
                value={formData.password}
                onChange={(event) => setFormData({ ...formData, password: event.target.value })}
                disabled={!canManageAdmins}
              />
            </div>
            <div className="form-group">
              <label htmlFor="admin_role" className="label">Role</label>
              <select
                id="admin_role"
                className="input"
                value={formData.adminRole}
                onChange={(event) => setFormData({ ...formData, adminRole: event.target.value as AdminRole })}
                disabled={!canManageAdmins}
              >
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <button type="submit" disabled={!canManageAdmins || saving} className="btn-primary w-full">
              <Save className="mr-2 h-5 w-5" />
              {saving ? 'Creating...' : 'Create Admin'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
