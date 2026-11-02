'use client'

import * as React from 'react'
import Link from 'next/link'
import { formatIDR } from '@/lib/utils'
import { useCart } from '@/lib/cart-context'

export interface FloatingOrderTrayProps {
  tableNumber: string | null
}

export function FloatingOrderTray({ tableNumber }: FloatingOrderTrayProps) {
  const { totalItems, subtotal } = useCart()

  if (totalItems <= 0) {
    return null
  }

  const cartHref = `/cart${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`

  return (
    <div
      aria-label="Ringkasan Pesanan Sementara"
      className="fixed bottom-16 left-0 right-0 z-20 px-4 pointer-events-none select-none"
    >
      <div className="mx-auto max-w-md pointer-events-auto">
        <Link
          href={cartHref}
          className="flex min-h-touch items-center justify-between rounded-lg bg-inverse-surface px-4 py-3 text-inverse-on-surface shadow-level2 transition-transform duration-120 hover:scale-[1.01] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {/* Left Info: Item Count Badge + Subtotal */}
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-white">
              {totalItems}
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-on-surface-variant text-inverse-on-surface/80">
                Total Pesanan
              </span>
              <span className="text-sm font-bold tabular-nums font-price-tabular text-white">
                {formatIDR(subtotal)}
              </span>
            </div>
          </div>

          {/* Right Action: Lihat Keranjang */}
          <div className="flex items-center gap-1 text-sm font-semibold text-white">
            <span>Lihat Keranjang</span>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}

