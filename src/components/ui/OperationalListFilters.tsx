'use client'

import { Filter, Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export type ListFilterOption = { label: string; value: string }

export type ListFilterDefinition = {
  key: string
  label: string
  options: readonly ListFilterOption[]
}

export type SavedListView = {
  label: string
  params: Record<string, string>
}

type OperationalListFiltersProps = {
  searchPlaceholder: string
  filters?: readonly ListFilterDefinition[]
  sortOptions?: readonly ListFilterOption[]
  savedViews?: readonly SavedListView[]
}

export default function OperationalListFilters({
  searchPlaceholder,
  filters = [],
  sortOptions = [],
  savedViews = [],
}: OperationalListFiltersProps) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('q') || '')

  useEffect(() => setQuery(searchParams.get('q') || ''), [searchParams])

  const navigate = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === 'all') params.delete(key)
      else params.set(key, value)
    })
    router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`)
  }

  const applySearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    navigate({ q: query.trim() || null })
  }

  return (
    <section className="border-b border-slate-200 pb-5" aria-label="List filters">
      {savedViews.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {savedViews.map((view) => (
            <button
              key={view.label}
              type="button"
              onClick={() => {
                const params = new URLSearchParams(view.params)
                setQuery(params.get('q') || '')
                router.push(`${pathname}${params.size ? `?${params.toString()}` : ''}`)
              }}
              className="shrink-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-primary-300 hover:text-primary-700"
            >
              {view.label}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={applySearch} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="relative block md:col-span-2 xl:col-span-1">
          <span className="sr-only">Search</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="input min-h-11 pl-9" placeholder={searchPlaceholder} type="search" />
        </label>
        {filters.map((filter) => (
          <label key={filter.key} className="relative block">
            <span className="sr-only">{filter.label}</span>
            <select className="input min-h-11 w-full" value={searchParams.get(filter.key) || 'all'} onChange={(event) => navigate({ [filter.key]: event.target.value })}>
              <option value="all">All {filter.label}</option>
              {filter.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        ))}
        {sortOptions.length > 0 && (
          <label className="relative block">
            <span className="sr-only">Sort</span>
            <select className="input min-h-11 w-full" value={searchParams.get('sort') || ''} onChange={(event) => navigate({ sort: event.target.value })}>
              <option value="">Sort by</option>
              {sortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        )}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary min-h-11 flex-1"><Filter className="h-4 w-4" />Apply</button>
          <button type="button" onClick={() => { setQuery(''); router.push(pathname) }} className="btn-secondary min-h-11 px-3" title="Clear filters" aria-label="Clear filters"><X className="h-4 w-4" /></button>
        </div>
      </form>
    </section>
  )
}
