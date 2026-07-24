'use client'

import { CheckCircle, Loader2 } from 'lucide-react'

type MobileFormSubmitBarProps = {
  formId: string
  label: string
  pendingLabel: string
  disabled?: boolean
  pending?: boolean
  amountLabel?: string
}

export function MobileFormSubmitBar({ formId, label, pendingLabel, disabled = false, pending = false, amountLabel }: MobileFormSubmitBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-20 z-30 border-t border-slate-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.10)] backdrop-blur md:hidden">
      <button type="submit" form={formId} disabled={disabled || pending} className="btn-success min-h-14 w-full justify-between px-5 text-base">
        <span className="flex items-center">{pending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <CheckCircle className="mr-2 h-5 w-5" />}{pending ? pendingLabel : label}</span>
        {amountLabel && <span className="text-sm font-bold">{amountLabel}</span>}
      </button>
    </div>
  )
}
