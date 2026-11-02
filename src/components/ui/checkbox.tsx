import * as React from 'react'
import { cn, formatIDR } from '@/lib/utils'

export interface CheckboxOptionProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  description?: string
  priceDelta?: number
}

export const CheckboxOption = React.forwardRef<HTMLInputElement, CheckboxOptionProps>(
  ({ className, label, description, priceDelta, id, checked, disabled, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId

    return (
      <label
        htmlFor={inputId}
        className={cn(
          'flex min-h-touch w-full cursor-pointer items-center justify-between rounded-DEFAULT border p-3 transition-colors select-none',
          'focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
          checked
            ? 'border-primary bg-primary-fixed/20 text-on-surface'
            : 'border-outline-variant bg-surface-lowest hover:bg-surface-low text-on-surface',
          disabled && 'cursor-not-allowed opacity-45 hover:bg-surface-lowest',
          className
        )}
      >
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <input
              ref={ref}
              type="checkbox"
              id={inputId}
              checked={checked}
              disabled={disabled}
              className="peer sr-only"
              {...props}
            />
            <div
              className={cn(
                'h-5 w-5 rounded-sm border-2 transition-all flex items-center justify-center',
                checked ? 'border-primary bg-primary text-white' : 'border-outline bg-transparent',
                disabled && 'border-outline-variant'
              )}
            >
              {checked && (
                <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
          </div>
          <div>
            <span className="text-sm font-medium leading-none">{label}</span>
            {description && (
              <p className="mt-0.5 text-xs text-on-surface-variant">{description}</p>
            )}
          </div>
        </div>
        {priceDelta !== undefined && priceDelta > 0 && (
          <span className="text-xs font-semibold tabular-nums text-primary font-price-tabular">
            +{formatIDR(priceDelta)}
          </span>
        )}
      </label>
    )
  }
)

CheckboxOption.displayName = 'CheckboxOption'

