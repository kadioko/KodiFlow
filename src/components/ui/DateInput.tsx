'use client'

import { useEffect, useState } from 'react'
import { formatDateInputText, formatDateInputValue, parseDateInputToISO } from '@/utils/currency'

interface DateInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
  min?: string
  helperText?: string
}

export function DateInput({ id, label, value, onChange, required = false, min, helperText }: DateInputProps) {
  const [displayValue, setDisplayValue] = useState(formatDateInputValue(value))

  useEffect(() => {
    setDisplayValue(formatDateInputValue(value))
  }, [value])

  const handleChange = (nextValue: string) => {
    const formattedValue = formatDateInputText(nextValue)
    setDisplayValue(formattedValue)

    if (!formattedValue) {
      onChange('')
      return
    }

    const isoValue = parseDateInputToISO(formattedValue)
    if (isoValue) {
      onChange(isoValue)
    }
  }

  const handleBlur = () => {
    const isoValue = parseDateInputToISO(displayValue)
    if (!displayValue || isoValue) return
    setDisplayValue(formatDateInputValue(value))
  }

  return (
    <div className="form-group">
      <label htmlFor={id} className="label">
        {label} {required && <span className="text-danger-500">*</span>}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        required={required}
        value={displayValue}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        className="input"
        placeholder="DD/MM/YYYY"
        aria-describedby={`${id}-format`}
      />
      <p id={`${id}-format`} className="mt-1 text-xs text-gray-500">
        {helperText || 'Use DD/MM/YYYY'}
        {min ? `, from ${formatDateInputValue(min)}` : ''}
      </p>
    </div>
  )
}
