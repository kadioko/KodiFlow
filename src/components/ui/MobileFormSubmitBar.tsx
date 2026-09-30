'use client'

import { CheckCircle, Loader2 } from 'lucide-react'
import { MobileActionBar } from './MobileActionBar'

type MobileFormSubmitBarProps = {
  formId: string
  label: string
  pendingLabel: string
  disabled?: boolean
  pending?: boolean
  amountLabel?: string
  error?: string
  message?: string
}

export function MobileFormSubmitBar({ formId, label, pendingLabel, disabled = false, pending = false, amountLabel, error, message }: MobileFormSubmitBarProps) {
  return (
    <MobileActionBar error={error} message={message}>
      <button type="submit" form={formId} disabled={disabled || pending} aria-busy={pending} className="btn-success mobile-submit-button min-h-14 w-full gap-3 px-4 text-base">
        {pending ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <CheckCircle className="h-5 w-5 shrink-0" />}
        <span className="min-w-0 break-words">{pending ? pendingLabel : label}{amountLabel && <span className="block text-sm font-medium">{amountLabel}</span>}</span>
      </button>
    </MobileActionBar>
  )
}
