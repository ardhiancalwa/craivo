import * as React from 'react'
import { cn } from '@/lib/utils'

export interface QuantityStepperProps {
  value: number
  onChange: (newValue: number) => void
  min?: number
  max?: number
  variant?: 'inline' | 'drawer'
  className?: string
  disabled?: boolean
}

export function QuantityStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  variant = 'drawer',
  className,
  disabled = false,
}: QuantityStepperProps) {
  const handleDecrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (value > min && !disabled) {
      onChange(value - 1)
    }
  }

  const handleIncrement = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (value < max && !disabled) {
      onChange(value + 1)
    }
  }

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'inline-flex items-center rounded-full bg-primary px-2 py-1 text-white shadow-xs select-none',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <button
          type="button"
          onClick={handleDecrement}
          disabled={disabled || value <= min}
          aria-label="Kurangi jumlah"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-transform duration-120"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
          </svg>
        </button>
        <span className="w-7 text-center text-xs font-bold tabular-nums font-price-tabular text-white">
          {value}
        </span>
        <button
          type="button"
          onClick={handleIncrement}
          disabled={disabled || value >= max}
          aria-label="Tambah jumlah"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white hover:bg-white/20 active:scale-95 disabled:opacity-30 disabled:pointer-events-none transition-transform duration-120"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 select-none',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        aria-label="Kurangi jumlah"
        className="flex min-h-touch min-w-touch items-center justify-center rounded-DEFAULT border border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-container active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-transform duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
        </svg>
      </button>
      <span className="min-w-[40px] text-center text-base font-semibold tabular-nums font-price-tabular text-on-surface">
        {value}
      </span>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        aria-label="Tambah jumlah"
        className="flex min-h-touch min-w-touch items-center justify-center rounded-DEFAULT border border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-container active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-transform duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>
  )
}

