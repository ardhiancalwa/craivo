'use client'

import * as React from 'react'
import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { QuantityStepper } from '@/components/ui/quantity-stepper'
import { formatIDR, cn } from '@/lib/utils'
import { useCart } from '@/lib/cart-context'
import type { CatalogMenuItem } from '@/lib/server/menu-service'

export interface MenuCardProps {
  item: CatalogMenuItem
  onOpenModifier: (item: CatalogMenuItem) => void
}

export function MenuCard({ item, onOpenModifier }: MenuCardProps) {
  const { addItem, getItemQuantity, items, updateQuantity } = useCart()
  const [imageError, setImageError] = React.useState(false)
  const isSoldOut = !item.isAvailable
  const hasModifiers = item.modifierGroups && item.modifierGroups.length > 0
  const cartQty = getItemQuantity(item.id)

  const handleCardClick = () => {
    if (isSoldOut) return
    if (hasModifiers) {
      onOpenModifier(item)
    } else {
      addItem(item)
    }
  }

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isSoldOut) return
    if (hasModifiers) {
      onOpenModifier(item)
    } else {
      addItem(item)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        'group flex flex-col justify-between rounded-md border border-outline-variant bg-surface-lowest p-2.5 shadow-level1 transition-all select-none',
        isSoldOut
          ? 'opacity-45 cursor-not-allowed'
          : 'cursor-pointer hover:border-outline hover:shadow-level2 active:scale-[0.99]'
      )}
    >
      {/* Top: Image & Badges */}
      <div>
        <div className="relative aspect-square w-full overflow-hidden rounded-DEFAULT bg-surface-container">
          {item.image && !imageError ? (
            <Image
              src={item.image}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 50vw, 200px"
              unoptimized={item.image.startsWith('/api/images/')}
              onError={() => setImageError(true)}
              className={cn(
                'object-cover transition-transform duration-280 group-hover:scale-105',
                isSoldOut && 'grayscale-[80%]'
              )}
            />
          ) : (
            <div
              className={cn(
                'flex h-full w-full items-center justify-center bg-surface-container text-outline',
                isSoldOut && 'grayscale'
              )}
            >
              <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
          )}

          {/* Badges on Thumbnail */}
          <div className="absolute left-1.5 top-1.5 flex flex-col gap-1">
            {isSoldOut ? (
              <Badge variant="soldout" size="sm">
                Habis
              </Badge>
            ) : item.isPopular ? (
              <Badge variant="primary" size="sm">
                Favorit
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Content: Title & Description */}
        <div className="mt-2 space-y-0.5">
          <h3 className="text-sm font-semibold text-on-surface line-clamp-1 font-sans">
            {item.name}
          </h3>
          <p className="text-[11px] leading-tight text-on-surface-variant line-clamp-2 min-h-[26px]">
            {item.description}
          </p>
        </div>
      </div>

      {/* Bottom: Price & Action */}
      <div className="mt-3 flex items-center justify-between pt-1">
        <span className="text-xs font-semibold tabular-nums text-primary font-price-tabular">
          {formatIDR(item.price)}
        </span>

        {isSoldOut ? (
          <button
            type="button"
            disabled
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-container text-on-surface-variant cursor-not-allowed"
            aria-label="Menu habis"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : hasModifiers ? (
          <button
            type="button"
            onClick={handleActionClick}
            aria-label={`Pilih varian untuk ${item.name}`}
            className="flex h-8 px-2.5 items-center justify-center gap-1 rounded-full border border-outline-variant bg-surface-lowest text-xs font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
          >
            <span>+</span>
            <span className="text-[10px]">Pilih</span>
          </button>
        ) : cartQty > 0 ? (
          <div onClick={(e) => e.stopPropagation()}>
            <QuantityStepper
              value={cartQty}
              onChange={(newQty) => {
                if (newQty > cartQty) {
                  addItem(item)
                } else if (newQty < cartQty) {
                  const targetItem = items.find((it) => it.menuItemId === item.id)
                  if (targetItem) {
                    updateQuantity(targetItem.cartItemId, newQty)
                  }
                }
              }}
              min={0}
              variant="inline"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleActionClick}
            aria-label={`Tambah ${item.name} ke keranjang`}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant bg-surface-lowest text-primary hover:bg-primary hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}

