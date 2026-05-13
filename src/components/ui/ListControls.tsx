'use client'

import { useMemo, useState } from 'react'

type FilterOption = {
  label: string
  value: string
}

type ListControlsProps<T> = {
  items: T[]
  searchPlaceholder: string
  searchValue: (item: T) => string
  filterValue?: (item: T) => string
  filterOptions?: FilterOption[]
  children: (items: T[]) => React.ReactNode
  pageSize?: number
}

export default function ListControls<T>({
  items,
  searchPlaceholder,
  searchValue,
  filterValue,
  filterOptions = [],
  children,
  pageSize = 10,
}: ListControlsProps<T>) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return items.filter((item) => {
      const matchesSearch = !normalizedQuery || searchValue(item).toLowerCase().includes(normalizedQuery)
      const matchesFilter = filter === 'all' || !filterValue || filterValue(item) === filter
      return matchesSearch && matchesFilter
    })
  }, [items, query, filter, searchValue, filterValue])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const paginatedItems = filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const updateQuery = (value: string) => {
    setQuery(value)
    setPage(1)
  }

  const updateFilter = (value: string) => {
    setFilter(value)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            className="input md:col-span-2"
            placeholder={searchPlaceholder}
            type="search"
          />
          {filterOptions.length > 0 && (
            <select value={filter} onChange={(event) => updateFilter(event.target.value)} className="input">
              <option value="all">All</option>
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Showing {paginatedItems.length} of {filteredItems.length} result(s)
        </p>
      </div>

      {children(paginatedItems)}

      {pageCount > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={currentPage === 1}
            className="btn-secondary disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">Page {currentPage} of {pageCount}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            disabled={currentPage === pageCount}
            className="btn-secondary disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
