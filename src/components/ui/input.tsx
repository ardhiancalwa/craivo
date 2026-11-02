import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  helperText?: string
  error?: string
  startIcon?: React.ReactNode
  endIcon?: React.ReactNode
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, helperText, error, startIcon, endIcon, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id || generatedId
    const errorId = `${inputId}-error`
    const helperId = `${inputId}-helper`

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-on-surface">
            {label}
            {props.required && <span className="ml-1 text-status-error">*</span>}
          </label>
        )}
        <div className="relative flex items-center">
          {startIcon && (
            <span className="pointer-events-none absolute left-3 flex items-center text-on-surface-variant">
              {startIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            className={cn(
              'flex w-full rounded-DEFAULT border bg-surface-lowest px-3 py-2 text-sm text-on-surface placeholder:text-outline transition-colors',
              'min-h-touch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary',
              'disabled:cursor-not-allowed disabled:bg-surface-high disabled:opacity-50',
              startIcon && 'pl-10',
              endIcon && 'pr-10',
              error ? 'border-status-error focus-visible:ring-status-error' : 'border-outline-variant hover:border-outline',
              className
            )}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : helperText ? helperId : undefined}
            {...props}
          />
          {endIcon && (
            <span className="pointer-events-none absolute right-3 flex items-center text-on-surface-variant">
              {endIcon}
            </span>
          )}
        </div>
        {error ? (
          <p id={errorId} className="text-xs font-medium text-status-error" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-on-surface-variant">
            {helperText}
          </p>
        ) : null}
      </div>
    )
  }
)

Input.displayName = 'Input'

