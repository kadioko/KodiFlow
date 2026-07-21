'use client'

import { useEffect, useState } from 'react'
import { BarChart3, Building2, CreditCard, KeyRound, Receipt, Save, Shield, UserPlus, Users } from 'lucide-react'
import { formatCurrency, formatDate } from '@/utils/currency'

type AdminRole = 'viewer' | 'property_manager' | 'accountant' | 'maintenance_manager' | 'admin' | 'super_admin'
type ManagedRole = 'none' | AdminRole

const roleOptions: { value: AdminRole; label: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access for oversight.' },
  { value: 'property_manager', label: 'Property Manager', description: 'Daily property, tenant, unit, and lease work.' },
  { value: 'accountant', label: 'Accountant', description: 'Invoices, payments, expenses, and reports.' },
  { value: 'maintenance_manager', label: 'Maintenance Manager', description: 'Maintenance requests, vendors, and costs.' },
  { value: 'admin', label: 'Admin', description: 'Operational administration and support.' },
  { value: 'super_admin', label: 'Super Admin', description: 'Full platform, users, roles, and recovery control.' },
]

const roleLabel = (role: ManagedRole) => roleOptions.find((option) => option.value === role)?.label || 'User'

type ManagedUser = {
  id: string
  email: string | null
  full_name: string | null
  admin_role: ManagedRole
  created_at?: string
  updated_at?: string
  last_sign_in_at?: string | null
  confirmed_at?: string | null
}

type AdminStats = {
  profiles: number
  admins: number
  properties: number
  units: number
  tenants: number
  leases: number
  invoices: number
  payments: number
  invoiceValue: number
  collected: number
  outstanding: number
}

export default function AdminPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [currentRole, setCurrentRole] = useState<'none' | AdminRole>('none')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [passwordUserId, setPasswordUserId] = useState('')
  const [temporaryPassword, setTemporaryPassword] = useState('')
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    adminRole: 'property_manager' as AdminRole,
  })

  const canManageAdmins = currentRole === 'super_admin'
  const adminUsers = users.filter((user) => user.admin_role !== 'none')

  const fetchAdminData = async () => {
    setLoading(true)
    setError('')

    const [usersResponse, overviewResponse] = await Promise.all([
      fetch('/api/admin/users'),
      fetch('/api/admin/overview'),
    ])
    const usersData = await usersResponse.json()
    const overviewData = await overviewResponse.json()

    if (!usersResponse.ok) {
      setError(usersData.error || 'Could not load admin users')
      setLoading(false)
      return
    }

    if (!overviewResponse.ok) {
      setError(overviewData.error || 'Could not load platform overview')
      setLoading(false)
      return
    }

    setUsers(usersData.users || usersData.admins || [])
    setCurrentRole(usersData.currentRole || overviewData.currentRole || 'none')
    setStats(overviewData.stats || null)
    setLoading(false)
  }

  useEffect(() => {
    fetchAdminData()
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
      setFormData({ fullName: '', email: '', password: '', adminRole: 'property_manager' })
      await fetchAdminData()
    }

    setSaving(false)
  }

  const changeRole = async (id: string, adminRole: ManagedRole) => {
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
      await fetchAdminData()
    }
  }

  const resetPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passwordUserId) return

    setSaving(true)
    setMessage('')
    setError('')

    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: passwordUserId, password: temporaryPassword }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error || 'Password was not updated')
    } else {
      setMessage('Temporary password updated')
      setPasswordUserId('')
      setTemporaryPassword('')
    }

    setSaving(false)
  }

  const statCards = stats ? [
    { label: 'Users', value: stats.profiles.toLocaleString(), icon: Users, tone: 'bg-primary-100 text-primary-700' },
    { label: 'Admins', value: stats.admins.toLocaleString(), icon: Shield, tone: 'bg-purple-100 text-purple-700' },
    { label: 'Properties', value: stats.properties.toLocaleString(), icon: Building2, tone: 'bg-success-100 text-success-700' },
    { label: 'Invoices', value: stats.invoices.toLocaleString(), icon: Receipt, tone: 'bg-warning-100 text-warning-700' },
    { label: 'Invoice Value', value: formatCurrency(stats.invoiceValue), icon: BarChart3, tone: 'bg-blue-100 text-blue-700' },
    { label: 'Outstanding', value: formatCurrency(stats.outstanding), icon: CreditCard, tone: 'bg-danger-100 text-danger-700' },
  ] : []

  return (
    <div className="max-w-7xl space-y-6">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-primary-700">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <h1 className="page-title">Admin</h1>
            <p className="text-gray-500">Manage users, admins, support access, and platform-wide health</p>
          </div>
        </div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">{error}</div>}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {loading && !stats ? (
          <div className="card p-6 text-sm text-slate-500 md:col-span-2 xl:col-span-6">Loading platform overview...</div>
        ) : statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className={`inline-flex rounded-xl p-3 ${card.tone}`}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="stat-label mt-4">{card.label}</p>
            <p className="stat-value text-xl">{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_24rem]">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="text-lg font-semibold">{canManageAdmins ? 'Platform Users' : 'Admin Accounts'}</h2>
              <p className="text-sm text-slate-500">
                {canManageAdmins ? 'Promote users, remove admin rights, and inspect login state.' : 'Admins can view other admin accounts.'}
              </p>
            </div>
          </div>
          <div className="card-body">
            {loading ? (
              <p className="text-sm text-slate-500">Loading users...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500">No users found.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead className="table-header">
                    <tr>
                      <th className="table-header-cell">User</th>
                      <th className="table-header-cell">Role</th>
                      <th className="table-header-cell">Last Sign In</th>
                      <th className="table-header-cell">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {users.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="table-cell">
                          <p className="font-medium text-slate-900">{user.full_name || user.email || 'Unknown user'}</p>
                          <p className="text-xs text-slate-500">{user.email || user.id}</p>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${
                            user.admin_role === 'super_admin'
                              ? 'bg-purple-100 text-purple-800'
                              : user.admin_role === 'admin'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-primary-100 text-primary-800'
                          }`}>
                            {roleLabel(user.admin_role)}
                          </span>
                        </td>
                        <td className="table-cell">
                          {user.last_sign_in_at ? formatDate(user.last_sign_in_at) : <span className="text-slate-400">Never</span>}
                        </td>
                        <td className="table-cell">
                          {canManageAdmins ? (
                            <div className="flex flex-wrap gap-2">
                              <select aria-label={`Change role for ${user.email || user.id}`} value={user.admin_role} onChange={(event) => changeRole(user.id, event.target.value as ManagedRole)} className="input max-w-44 py-2 text-xs">
                                <option value="none">No operational role</option>
                                {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                              </select>
                              <button type="button" onClick={() => setPasswordUserId(user.id)} className="btn-secondary text-xs">
                                Password
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

        <div className="space-y-6">
          <section className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-primary-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Add Team User</h2>
                <p className="text-sm text-slate-500">Create a confirmed operational account.</p>
              </div>
            </div>

            <form onSubmit={addAdmin} className="space-y-4">
              <div className="form-group">
                <label htmlFor="admin_full_name" className="label">Name</label>
                <input id="admin_full_name" className="input" value={formData.fullName} onChange={(event) => setFormData({ ...formData, fullName: event.target.value })} disabled={!canManageAdmins} />
              </div>
              <div className="form-group">
                <label htmlFor="admin_email" className="label">Email</label>
                <input id="admin_email" type="email" required className="input" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} disabled={!canManageAdmins} />
              </div>
              <div className="form-group">
                <label htmlFor="admin_password" className="label">Temporary Password</label>
                <input id="admin_password" type="password" required minLength={8} className="input" value={formData.password} onChange={(event) => setFormData({ ...formData, password: event.target.value })} disabled={!canManageAdmins} />
              </div>
              <div className="form-group">
                <label htmlFor="admin_role" className="label">Role</label>
                <select id="admin_role" className="input" value={formData.adminRole} onChange={(event) => setFormData({ ...formData, adminRole: event.target.value as AdminRole })} disabled={!canManageAdmins}>
                  {roleOptions.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                </select>
                <p className="mt-1 text-xs text-slate-500">{roleOptions.find((role) => role.value === formData.adminRole)?.description}</p>
              </div>
              <button type="submit" disabled={!canManageAdmins || saving} className="btn-primary w-full">
                <Save className="mr-2 h-5 w-5" />
                {saving ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </section>

          <section className="card p-6">
            <div className="mb-5 flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary-600" />
              <div>
                <h2 className="font-semibold text-slate-900">Reset Password</h2>
                <p className="text-sm text-slate-500">Set a temporary password for support recovery.</p>
              </div>
            </div>

            <form onSubmit={resetPassword} className="space-y-4">
              <div className="form-group">
                <label htmlFor="password_user" className="label">User</label>
                <select id="password_user" required className="input" value={passwordUserId} onChange={(event) => setPasswordUserId(event.target.value)} disabled={!canManageAdmins}>
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.email || user.full_name || user.id}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="temporary_password" className="label">Temporary Password</label>
                <input id="temporary_password" type="password" required minLength={8} className="input" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} disabled={!canManageAdmins} />
              </div>
              <button type="submit" disabled={!canManageAdmins || saving} className="btn-secondary w-full">
                <KeyRound className="mr-2 h-5 w-5" />
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </section>

          <section className="card p-6">
            <h2 className="font-semibold text-slate-900">Access Summary</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <div className="flex justify-between"><span>Admin accounts</span><span className="font-semibold">{adminUsers.length}</span></div>
              <div className="flex justify-between"><span>Super admins</span><span className="font-semibold">{adminUsers.filter((user) => user.admin_role === 'super_admin').length}</span></div>
              <div className="flex justify-between"><span>Your role</span><span className="font-semibold">{currentRole.replace('_', ' ')}</span></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
