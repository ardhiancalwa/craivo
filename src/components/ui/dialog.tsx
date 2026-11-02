'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DialogProps {
  isOpen: boolean
  onClose: () => void
  title?: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  showCloseButton?: boolean
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
  showCloseButton = true,
}: DialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<HTMLElement | null>(null)
  const hasFocusedRef = React.useRef(false)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  const titleId = React.useId()
  const descId = React.useId()

  // 1. Scroll Lock & Focus Restoration
  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      hasFocusedRef.current = false

      return () => {
        document.body.style.overflow = originalOverflow
        if (previousActiveElement.current && typeof previousActiveElement.current.focus === 'function') {
          previousActiveElement.current.focus()
        }
      }
    }
  }, [isOpen])

  // 2. Escape Listener & Focus Trap
  React.useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key === 'Tab' && dialogRef.current) {
        const focusableElements = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        if (focusableElements.length === 0) return

        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]
        if (!firstElement || !lastElement) return

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    // Initial focus into modal: only run once on open
    if (!hasFocusedRef.current) {
      const timer = setTimeout(() => {
        if (dialogRef.current && !hasFocusedRef.current) {
          hasFocusedRef.current = true
          // Prioritas: field input/textarea atau [autofocus], jangan tombol close header
          const inputFocusable = dialogRef.current.querySelector<HTMLElement>(
            'textarea:not([disabled]), input:not([disabled]), [autofocus]'
          )
          if (inputFocusable) {
            inputFocusable.focus()
          } else {
            const anyFocusable = dialogRef.current.querySelector<HTMLElement>(
              'button:not([disabled]), [href], select:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (anyFocusable) {
              anyFocusable.focus()
            } else {
              dialogRef.current.focus()
            }
          }
        }
      }, 50)

      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        clearTimeout(timer)
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm animate-in fade-in duration-180"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'w-full rounded-xl bg-surface-lowest p-6 shadow-level3 border border-outline-variant outline-none transition-all duration-280',
          maxWidthStyles[maxWidth],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            {title && (
              <h2 id={titleId} className="text-lg font-bold text-on-surface font-sans">
                {title}
              </h2>
            )}
            {description && (
              <p id={descId} className="mt-1 text-sm text-on-surface-variant">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup dialog"
              className="inline-flex h-8 w-8 items-center justify-center rounded-DEFAULT text-on-surface-variant hover:bg-surface-container hover:text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}
