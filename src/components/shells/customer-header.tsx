'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { StaffHelpModal } from './staff-help-modal'

interface CustomerHeaderProps {
  cafeName?: string
}

export function CustomerHeader({ cafeName = 'Cravio' }: CustomerHeaderProps) {
  const searchParams = useSearchParams()
  const tableParam = searchParams.get('table')
  const [isHelpOpen, setIsHelpOpen] = React.useState(false)

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-outline-variant bg-surface/95 px-4 backdrop-blur-md select-none">
        {/* Brand Cafe Name + Subtle Cravio Micro-Ad */}
        <div className="flex items-center gap-2">
          <Link
            href={`/menu${tableParam ? `?table=${tableParam}` : ''}`}
            className="flex flex-col justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <span className="font-sans text-lg font-bold tracking-tight text-on-surface leading-tight">
              {cafeName}
            </span>
            <div className="flex items-center gap-1">
              <span className="inline-flex items-center gap-1 text-[9.5px] font-sans font-medium text-on-surface-variant/80">
                <Image
                  src="/logo/only-logo.jpeg"
                  alt="Cravio"
                  width={11}
                  height={11}
                  className="h-2.5 w-2.5 rounded-full object-contain"
                />
                <span>
                  powered by <span className="font-bold text-primary">cravio</span>
                </span>
              </span>
            </div>
          </Link>
        </div>

        {/* Right Action Bar: Table Badge & Help Button */}
        <div className="flex items-center gap-2.5">
          <Badge variant="table" size="md">
            {tableParam ? `Meja ${tableParam}` : 'Pilih Meja'}
          </Badge>

          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="Bantuan Staf"
            className="flex min-h-touch items-center gap-1.5 rounded-DEFAULT px-2.5 py-1 text-xs font-medium text-on-surface hover:bg-surface-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <svg className="h-4 w-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="hidden sm:inline">Bantuan</span>
          </button>
        </div>
      </header>

      <StaffHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        tableNumber={tableParam}
      />
    </>
  )
}

