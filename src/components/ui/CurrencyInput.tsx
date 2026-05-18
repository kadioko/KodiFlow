'use client'

import { formatNumber, parseCurrencyInput } from '@/utils/currency'

interface CurrencyInputProps {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  required?: boolean
  helperText?: string
}

export function CurrencyInput({ id, label, value, onChange, required = false, helperText }: CurrencyInputProps) {
  return (
    <div className="form-group">
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        required={required}
        value={value > 0 ? formatNumber(value) : ''}
        onChange={(event) => onChange(parseCurrencyInput(event.target.value))}
        className="input"
        placeholder="0"
      />
      {helperText && <p className="mt-1 text-xs text-gray-500">{helperText}</p>}
    </div>
  )
}
