import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'paid' | 'cooking' | 'error' | 'soldout' | 'table'
  size?: 'sm' | 'md'
  icon?: React.ReactNode
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  icon,
  children,
  ...props
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full select-none transition-colors'

  const sizeStyles = {
    sm: 'text-[11px] leading-[14px] px-2 py-0.5 gap-1',
    md: 'text-xs leading-[16px] px-2.5 py-1 gap-1.5',
  }

  const variantStyles = {
    default: 'bg-surface-container text-on-surface border border-outline-variant',
    primary: 'bg-primary text-white',
    paid: 'bg-[#E8F5E9] text-status-paid border border-[#C8E6C9]',
    cooking: 'bg-[#FEF3C7] text-status-cooking border border-[#FDE68A]',
    error: 'bg-[#FEE2E2] text-status-error border border-[#FECACA]',
    soldout: 'bg-surface-high text-on-surface-variant line-through border border-outline-variant',
    table: 'bg-surface-container text-on-surface border border-outline-variant font-semibold tracking-wide',
  }

  return (
    <span
      className={cn(baseStyles, sizeStyles[size], variantStyles[variant], className)}
      {...props}
    >
      {variant === 'table' && !icon ? (
        <span className="h-2 w-2 rounded-full bg-status-paid animate-pulse" aria-hidden="true" />
      ) : icon ? (
        <span className="inline-flex shrink-0 items-center justify-center" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}

