import * as React from 'react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'kds'
  size?: 'sm' | 'md' | 'lg' | 'kds'
  isLoading?: boolean
  loadingText?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      loadingText,
      iconLeft,
      iconRight,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-DEFAULT select-none transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-45 disabled:pointer-events-none disabled:cursor-not-allowed active:scale-[0.98]'

    const variantStyles = {
      primary: 'bg-primary text-white hover:bg-primary-container shadow-sm',
      secondary: 'bg-surface-container text-on-surface hover:bg-surface-high',
      outline: 'border border-outline-variant bg-surface-lowest text-on-surface hover:bg-surface-low',
      ghost: 'bg-transparent text-on-surface hover:bg-surface-container',
      danger: 'bg-status-error text-white hover:bg-red-700 shadow-sm',
      kds: 'bg-surface-container text-on-surface border-2 border-outline-variant hover:border-primary font-bold shadow-sm',
    }

    const sizeStyles = {
      sm: 'min-h-[36px] px-3.5 py-1.5 text-xs rounded-xl',
      md: 'min-h-touch px-4 py-2 text-sm rounded-xl',
      lg: 'min-h-touch px-6 py-3 text-base rounded-xl',
      kds: 'min-h-touch-kds min-w-touch-kds px-6 py-4 text-lg font-bold rounded-2xl',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="mr-2 h-4 w-4 animate-spin text-current"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>{loadingText || children}</span>
          </>
        ) : (
          <>
            {iconLeft && <span className="mr-2 inline-flex items-center">{iconLeft}</span>}
            {children}
            {iconRight && <span className="ml-2 inline-flex items-center">{iconRight}</span>}
          </>
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

