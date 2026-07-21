'use client'

import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/utils/currency'

type Activity = { id: string; action: string; summary: string | null; created_at: string }

export function ActivityTimeline({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      const { data } = await supabase.from('activity_log').select('id, action, summary, created_at').eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false }).limit(12)
      setActivities((data || []) as Activity[])
      setLoaded(true)
    }
    load()
  }, [entityId, entityType])
  return <section className="card"><div className="card-header flex items-center gap-2"><History className="h-5 w-5 text-slate-500" /><div><h2 className="text-lg font-semibold text-slate-950">Activity</h2><p className="text-sm text-slate-500">Recorded changes and financial actions.</p></div></div><div className="divide-y divide-slate-100">{!loaded ? <p className="p-5 text-sm text-slate-500">Loading activity...</p> : activities.length === 0 ? <p className="p-5 text-sm text-slate-500">New activity will appear here as this record is updated.</p> : activities.map((activity) => <div key={activity.id} className="flex items-center justify-between gap-4 px-5 py-3"><div><p className="text-sm font-semibold capitalize text-slate-900">{activity.summary || activity.action}</p><p className="mt-0.5 text-xs text-slate-500">{formatDateTime(activity.created_at)}</p></div><span className="badge bg-slate-100 text-slate-700">{activity.action}</span></div>)}</div></section>
}
