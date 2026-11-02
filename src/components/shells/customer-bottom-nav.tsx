'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Compass } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StaffHelpModal } from './staff-help-modal'

export function CustomerBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tableParam = searchParams.get('table')
  const [isHelpOpen, setIsHelpOpen] = React.useState(false)

  // Sembunyikan bottom navigation bar di halaman checkout keranjang dan alur pembayaran
  // agar tombol pembayaran Midtrans QRIS/Tunai tidak tertutup
  if (
    pathname.startsWith('/cart') ||
    pathname.includes('/pay') ||
    pathname.includes('/receipt') ||
    pathname.includes('/track')
  ) {
    return null
  }

  const tableQuery = tableParam ? `?table=${tableParam}` : ''

  const navItems = [
    {
      label: 'Menu',
      href: `/menu${tableQuery}`,
      isActive: pathname.startsWith('/menu'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M4 6h16M4 12h16M4 18h7"
          />
        </svg>
      ),
    },
    {
      label: 'Kurasi',
      href: `/quiz${tableQuery}`,
      isActive: pathname.startsWith('/quiz'),
      icon: <Compass className="h-5 w-5" />,
    },
    {
      label: 'Pesanan',
      href: `/cart${tableQuery}`,
      isActive: pathname.startsWith('/cart') || pathname.startsWith('/order'),
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
  ]

  return (
    <>
      <nav
        aria-label="Navigasi Utama Pelanggan"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-outline-variant bg-surface/95 backdrop-blur-md pb-safe select-none"
      >
        <div className="mx-auto flex max-w-md items-center justify-around px-2">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex min-h-touch flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm',
                item.isActive
                  ? 'text-primary font-semibold'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <span className={cn('transition-transform duration-120', item.isActive && 'scale-110')}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          ))}

          {/* 4th Tab: Bantuan Modal Trigger */}
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="Bantuan dan Info Kafe"
            className="flex min-h-touch flex-1 flex-col items-center justify-center gap-1 py-1 text-[11px] font-medium text-on-surface-variant hover:text-on-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            <span>Bantuan</span>
          </button>
        </div>
      </nav>

      <StaffHelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        tableNumber={tableParam}
      />
    </>
  )
}

