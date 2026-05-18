import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/utils/currency'
import { ReceiptText } from 'lucide-react'

async function getExpenses() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select(`
      *,
      properties(name),
      property_sections(name),
      units(unit_name)
    `)
    .eq('user_id', user.id)
    .order('expense_date', { ascending: false })

  if (error) {
    console.error('Error fetching expenses:', error)
    return []
  }

  return (expenses || []).map((expense) => ({
    ...expense,
    property_name: Array.isArray(expense.properties) ? expense.properties[0]?.name : expense.properties?.name,
    section_name: Array.isArray(expense.property_sections) ? expense.property_sections[0]?.name : expense.property_sections?.name,
    unit_name: Array.isArray(expense.units) ? expense.units[0]?.unit_name : expense.units?.unit_name,
  }))
}

export default async function ExpensesPage() {
  const expenses = await getExpenses()
  const totalExpenses = expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Expenses</h1>
          <p className="text-gray-500">View property maintenance, operations, and service costs</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="stat-label">Total Expenses</p>
          <p className="stat-value text-warning-600">{formatCurrency(totalExpenses)}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Records</p>
          <p className="stat-value">{expenses.length}</p>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="card p-12 text-center">
          <ReceiptText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses recorded yet</h3>
          <p className="text-gray-500">Expenses will appear here once they are added to your properties.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table className="table">
              <thead className="table-header">
                <tr>
                  <th className="table-header-cell">Date</th>
                  <th className="table-header-cell">Category</th>
                  <th className="table-header-cell">Property</th>
                  <th className="table-header-cell">Location</th>
                  <th className="table-header-cell">Vendor</th>
                  <th className="table-header-cell">Amount</th>
                </tr>
              </thead>
              <tbody className="table-body">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-slate-50">
                    <td className="table-cell">{formatDate(expense.expense_date)}</td>
                    <td className="table-cell">
                      <span className="badge bg-warning-100 text-warning-800">{expense.category}</span>
                      {expense.description && <p className="mt-1 text-xs text-slate-500">{expense.description}</p>}
                    </td>
                    <td className="table-cell">{expense.property_name || '-'}</td>
                    <td className="table-cell">{expense.unit_name || expense.section_name || '-'}</td>
                    <td className="table-cell">{expense.vendor || '-'}</td>
                    <td className="table-cell font-semibold text-warning-700">{formatCurrency(expense.amount)}</td>
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
