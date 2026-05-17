import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  title?: string
  message?: string
  fullHeight?: boolean
}

export function LoadingState({
  title = 'Loading',
  message = 'Preparing the latest information...',
  fullHeight = false,
}: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center ${fullHeight ? 'min-h-[60vh]' : 'min-h-64'}`}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white/90 p-6 text-center shadow-sm ring-1 ring-slate-900/5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
        <p className="mt-4 text-sm font-bold text-slate-950">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{message}</p>
      </div>
    </div>
  )
}

export function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="h-4 w-40 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-4 h-9 w-72 max-w-full animate-pulse rounded-xl bg-slate-200" />
        <div className="mt-3 h-4 w-full max-w-2xl animate-pulse rounded-full bg-slate-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm">
            <div className="h-10 w-10 animate-pulse rounded-2xl bg-slate-200" />
            <div className="mt-5 h-3 w-28 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-3 h-8 w-36 animate-pulse rounded-xl bg-slate-200" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="h-5 w-44 animate-pulse rounded-full bg-slate-200" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  )
}
