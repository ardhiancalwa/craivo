'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export function ConnectionBanner({ className }: { className?: string }) {
  const [isOnline, setIsOnline] = React.useState<boolean>(true)
  const [wasOffline, setWasOffline] = React.useState<boolean>(false)

  React.useEffect(() => {
    // Initial status check
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine)
    }

    const handleOnline = () => {
      setIsOnline(true)
      setWasOffline(true)
      const timer = setTimeout(() => {
        setWasOffline(false)
      }, 3000)
      return () => clearTimeout(timer)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (isOnline && !wasOffline) {
    return null
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'sticky top-0 z-40 flex w-full items-center justify-center gap-2 px-4 py-2 text-xs font-medium text-white shadow-sm transition-colors duration-280 select-none',
        isOnline ? 'bg-status-paid' : 'bg-status-cooking',
        className
      )}
    >
      {isOnline ? (
        <>
          <svg className="h-4 w-4 fill-current shrink-0" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>Koneksi kembali terhubung.</span>
        </>
      ) : (
        <>
          <svg className="h-4 w-4 shrink-0 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 4.243a9 9 0 01-12.728 0m0 0l2.829-2.829m-2.829 2.829L3 21m2.829-12.728a5 5 0 017.072 0"
            />
          </svg>
          <span>Koneksi internet terputus. Mencoba menghubungkan kembali...</span>
        </>
      )}
    </div>
  )
}

