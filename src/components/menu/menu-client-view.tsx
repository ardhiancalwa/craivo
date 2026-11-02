'use client'

import * as React from 'react'
import Link from 'next/link'
import { TableStatusBanner } from './table-status-banner'
import { MenuSearchBar } from './menu-search-bar'
import { CategoryNav } from './category-nav'
import { MenuCard } from './menu-card'
import { ProductModifierSheet } from './product-modifier-sheet'
import { FloatingOrderTray } from './floating-order-tray'
import { EmptyState } from '@/components/ui/empty-state'
import { useCart } from '@/lib/cart-context'
import type { CatalogCategory, CatalogMenuItem } from '@/lib/server/menu-service'

export interface MenuClientViewProps {
  initialCategories: CatalogCategory[]
  initialItems: CatalogMenuItem[]
  tableNumber: string | null
  isTableValid: boolean
}

export function MenuClientView({
  initialCategories,
  initialItems,
  tableNumber,
  isTableValid,
}: MenuClientViewProps) {
  const { setTableNumber, setIsTableValid } = useCart()

  // Sync table info into cart context
  React.useEffect(() => {
    setTableNumber(tableNumber)
    setIsTableValid(isTableValid)
  }, [tableNumber, isTableValid, setTableNumber, setIsTableValid])

  // Interactive filtering states
  const [activeCategorySlug, setActiveCategorySlug] = React.useState<string>('semua')
  const [searchQuery, setSearchQuery] = React.useState<string>('')
  const [selectedItemForModifier, setSelectedItemForModifier] = React.useState<CatalogMenuItem | null>(null)
  const [isModifierOpen, setIsModifierOpen] = React.useState(false)

  // Dynamic Filtering (Instant client-side filter over server-provided catalog)
  const filteredItems = React.useMemo(() => {
    return initialItems.filter((item) => {
      // 1. Category filter
      if (activeCategorySlug !== 'semua' && item.categorySlug !== activeCategorySlug) {
        return false
      }

      // 2. Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim()
        const matchesName = item.name.toLowerCase().includes(query)
        const matchesDesc = item.description.toLowerCase().includes(query)
        if (!matchesName && !matchesDesc) {
          return false
        }
      }

      return true
    })
  }, [initialItems, activeCategorySlug, searchQuery])

  const handleOpenModifier = (item: CatalogMenuItem) => {
    setSelectedItemForModifier(item)
    setIsModifierOpen(true)
  }

  const handleCloseModifier = () => {
    setIsModifierOpen(false)
    setSelectedItemForModifier(null)
  }

  const quizHref = `/quiz${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`

  return (
    <div className="space-y-4">
      {/* 1. Table Status Warning Banner (if unverified / read-only) */}
      <TableStatusBanner tableNumber={tableNumber} isTableValid={isTableValid} />

      {/* 2. Curation Quiz Hero Prompt */}
      <section className="rounded-xl border border-outline-variant bg-surface-lowest p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
              Kurasi 30 Detik
            </span>
            <h2 className="text-sm font-bold text-on-surface font-sans leading-tight">
              Bingung tentukan pesanan Anda?
            </h2>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Jawab 3 pertanyaan rasa untuk mendapatkan racikan yang paling cocok hari ini.
            </p>
          </div>
          <Link
            href={quizHref}
            className="shrink-0 flex min-h-touch items-center justify-center rounded-DEFAULT bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-container active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Mulai Kuis
          </Link>
        </div>
      </section>

      {/* 3. Search Bar */}
      <MenuSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Cari kopi, hidangan manis, atau makanan..."
      />

      {/* 4. Sticky Category Nav */}
      <CategoryNav
        categories={initialCategories}
        activeSlug={activeCategorySlug}
        onSelectCategory={setActiveCategorySlug}
      />

      {/* 5. Menu Items Grid (2 Kolom Mobile) */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 pt-1">
          {filteredItems.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              onOpenModifier={handleOpenModifier}
            />
          ))}
        </div>
      ) : (
        <div className="pt-6">
          <EmptyState
            title="Menu Tidak Ditemukan"
            description={`Tidak ada sajian yang cocok dengan kata kunci "${searchQuery}". Silakan coba kata kunci lain atau pilih kategori Semua.`}
            actionLabel="Reset Pencarian"
            onAction={() => {
              setSearchQuery('')
              setActiveCategorySlug('semua')
            }}
          />
        </div>
      )}

      {/* 6. Product Modifier Customization Drawer */}
      <ProductModifierSheet
        item={selectedItemForModifier}
        isOpen={isModifierOpen}
        onClose={handleCloseModifier}
      />

      {/* 7. Floating Order Tray (docked at bottom when cart has items) */}
      <FloatingOrderTray tableNumber={tableNumber} />
    </div>
  )
}
