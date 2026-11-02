import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Terjadi Kendala',
  message,
  onRetry,
  retryLabel = 'Coba Lagi',
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-status-error/30 bg-[#FEE2E2]/30 p-6 text-center text-on-surface',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FEE2E2] text-status-error">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="mt-3 text-base font-semibold text-status-error font-display">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-on-surface-variant leading-relaxed">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={onRetry} className="border-status-error/40 text-status-error hover:bg-status-error/10">
            {retryLabel}
          </Button>
        </div>
      )}
    </div>
  )
}

