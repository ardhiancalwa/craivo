'use client'

import * as React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  Layers,
  Info,
  RotateCcw,
  ArrowRight,
  Coffee,
  Sparkles,
  Droplets,
  Snowflake,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { formatIDR } from '@/lib/utils'
import { useCart } from '@/lib/cart-context'
import { useToast } from '@/components/ui/toast'
import { ProductModifierSheet } from '@/components/menu/product-modifier-sheet'
import { FloatingOrderTray } from '@/components/menu/floating-order-tray'
import type { CatalogMenuItem } from '@/lib/server/menu-service'
import type {
  RecommendationResponse,
  RecommendationResultItem,
  CandidateMenuItem,
} from '@/lib/recommendation-engine'
import type { SelectedPreferenceItem } from '@/components/quiz/curation-analyzing-view'

interface RecommendationResultsProps {
  data: RecommendationResponse
  tableNumber: string
  onResetQuiz: () => void
  selectedPreferences?: SelectedPreferenceItem[]
}

function candidateToCatalogItem(item: CandidateMenuItem): CatalogMenuItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    image: item.image,
    categoryId: item.categoryId,
    categoryName: item.categoryName,
    categorySlug: item.categorySlug,
    isAvailable: item.isAvailable,
    isPopular: item.isPopular,
    soldCount: item.soldCount,
    tags: item.tags.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      dimension: t.dimension,
    })),
    modifierGroups: (item.modifierGroups || []).map((mg) => ({
      id: mg.id,
      name: mg.name,
      isRequired: mg.isRequired,
      minSelect: mg.minSelect,
      maxSelect: mg.maxSelect,
      options: mg.options.map((opt) => ({
        id: opt.id,
        groupId: opt.groupId,
        name: opt.name,
        price: opt.price,
        isAvailable: opt.isAvailable,
      })),
    })),
  }
}

export function RecommendationResults({
  data,
  tableNumber,
  onResetQuiz,
  selectedPreferences = [],
}: RecommendationResultsProps) {
  const { addItem } = useCart()
  const { showToast } = useToast()

  // State untuk modal konfigurasi modifier
  const [selectedItemForModifier, setSelectedItemForModifier] =
    React.useState<CatalogMenuItem | null>(null)
  const [isModifierSheetOpen, setIsModifierSheetOpen] = React.useState(false)

  const handleAddToCart = (candidate: CandidateMenuItem) => {
    const catalogItem = candidateToCatalogItem(candidate)
    if (catalogItem.modifierGroups && catalogItem.modifierGroups.length > 0) {
      setSelectedItemForModifier(catalogItem)
      setIsModifierSheetOpen(true)
    } else {
      addItem(
        {
          id: catalogItem.id,
          name: catalogItem.name,
          price: catalogItem.price,
          isAvailable: catalogItem.isAvailable,
        },
        [],
        ''
      )
      showToast(`${catalogItem.name} ditambahkan ke pesanan`, 'success')
    }
  }

  // Ambil daftar menu rekomendasi utama (default 3 menu)
  const topItems =
    data.topRecommendations && data.topRecommendations.length > 0
      ? data.topRecommendations
      : data.hero
      ? [data.hero]
      : []

  // Jika seluruh katalog kosong / habis
  if (topItems.length === 0 && data.alternatives.length === 0) {
    return (
      <div className="py-8">
        <EmptyState
          title="Belum Ada Menu Tersedia"
          description={
            data.fallbackReason ||
            'Seluruh racikan menu saat ini sedang habis atau dalam pembaruan. Silakan tanyakan kepada barista staf kami.'
          }
          actionLabel="Kembali ke Menu"
          onAction={() => {
            window.location.href = `/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`
          }}
        />
        <div className="mt-6 text-center">
          <Button variant="outline" size="sm" onClick={onResetQuiz} className="rounded-full">
            Ulangi Kuis
          </Button>
        </div>
      </div>
    )
  }

  // Build preference pill items from user selections or matched tags
  const preferencePills: Array<{ label: string; icon: React.ReactNode }> = []
  if (selectedPreferences.length > 0) {
    selectedPreferences.forEach((pref) => {
      const dim = pref.dimension.toUpperCase()
      let icon = <Sparkles className="w-3.5 h-3.5 text-primary" />
      if (dim === 'FLAVOR' || pref.questionTitle.toLowerCase().includes('rasa')) {
        icon = <Droplets className="w-3.5 h-3.5 text-primary" />
      } else if (dim === 'FORMAT' || pref.questionTitle.toLowerCase().includes('suhu') || pref.questionTitle.toLowerCase().includes('format')) {
        icon = <Snowflake className="w-3.5 h-3.5 text-primary" />
      }
      preferencePills.push({ label: pref.optionLabel, icon })
    })
  } else if (topItems[0] && topItems[0].matchedTags.length > 0) {
    topItems[0].matchedTags.forEach((tag) => {
      let icon = <Sparkles className="w-3.5 h-3.5 text-primary" />
      if (tag.dimension === 'FLAVOR') icon = <Droplets className="w-3.5 h-3.5 text-primary" />
      if (tag.dimension === 'FORMAT') icon = <Snowflake className="w-3.5 h-3.5 text-primary" />
      preferencePills.push({ label: tag.name, icon })
    })
  }

  // Build editorial headline based on selected preferences
  const moodLabel = selectedPreferences.find((p) => p.dimension === 'MOOD')?.optionLabel
  const formatLabel = selectedPreferences.find((p) => p.dimension === 'FORMAT')?.optionLabel
  const headlineTitle = moodLabel && formatLabel
    ? `Racikan ${moodLabel} & ${formatLabel}`
    : topItems.length > 0
    ? `Pilihan Selaras Meja ${tableNumber || 'Anda'}`
    : 'Rekomendasi Favorit'

  return (
    <div className="space-y-5 pb-24 animate-fade-in select-none">
      {/* 1. SUMMARY BAR PREFERENSI PELANGGAN (dari result-recommendation.html) */}
      <section className="bg-surface-low rounded-xl p-3.5 flex flex-col gap-2.5 border border-outline-variant/60 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-sans font-bold text-on-surface uppercase tracking-wider">
              Kurasi Selaras
            </span>
          </div>
          <button
            type="button"
            onClick={onResetQuiz}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-container transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            <span>Ubah Preferensi</span>
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {preferencePills.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            {preferencePills.map((pill, idx) => (
              <span
                key={idx}
                className="bg-surface-container text-on-surface-variant text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-outline-variant/30"
              >
                {pill.icon}
                <span>{pill.label}</span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* Fallback Notice Banner (jika stok habis / kurasi parsial) */}
      {data.isFallback && data.fallbackReason && (
        <div className="p-3 bg-surface-low border border-primary/20 rounded-xl flex items-start gap-2.5 text-xs text-on-surface">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold text-on-surface block mb-0.5">Catatan Kurasi:</span>
            {data.fallbackReason}
          </div>
        </div>
      )}

      {/* 2. HIGHLIGHT REKOMENDASI TERPILIH (TOP 3 MENU UTAMA) */}
      {topItems.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="bg-surface-lowest rounded-2xl p-4 sm:p-5 shadow-sm border border-outline-variant/60 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-sans font-bold text-primary uppercase tracking-widest">
                  {tableNumber ? `Pilihan Barista Meja ${tableNumber}` : 'Pilihan Barista'}
                </span>
                <span className="bg-primary-fixed text-on-primary-fixed text-[11px] font-sans font-semibold px-2.5 py-0.5 rounded-full">
                  Top {topItems.length} Rekomendasi
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-sans font-bold text-on-surface tracking-tight">
                {headlineTitle}
              </h2>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                {topItems[0]?.matchReason ||
                  'Berdasarkan kombinasi preferensi yang Anda pilih, berikut 3 racikan terbaik yang paling pas untuk Anda:'}
              </p>
            </div>

            {/* List 3 Menu Rekomendasi Utama */}
            <div className="space-y-3">
              {topItems.map((recItem, idx) => {
                const matchPct = idx === 0 ? '98% Cocok' : idx === 1 ? '94% Cocok' : '90% Cocok'
                const rankLabel = idx === 0 ? 'Pilihan Utama #1' : `Rekomendasi #${idx + 1}`

                return (
                  <article
                    key={recItem.menuItem.id}
                    className="bg-surface-low rounded-xl p-3.5 sm:p-4 flex gap-3.5 sm:gap-4 items-center border border-outline-variant/40 hover:border-primary/40 transition-all"
                  >
                    {/* Thumbnail Produk */}
                    <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-surface-container border border-outline-variant/30 flex items-center justify-center">
                      {recItem.menuItem.image ? (
                        <Image
                          src={recItem.menuItem.image}
                          alt={recItem.menuItem.name}
                          fill
                          sizes="(max-width: 640px) 96px, 112px"
                          unoptimized={recItem.menuItem.image.startsWith('/api/images/')}
                          className="object-cover"
                        />
                      ) : (
                        <Coffee className="w-7 h-7 text-on-surface-variant/40" />
                      )}
                      {recItem.menuItem.isPopular && (
                        <span className="absolute bottom-1 left-1 bg-on-surface/85 backdrop-blur-xs text-surface text-[9.5px] font-semibold px-1.5 py-0.5 rounded">
                          Signature
                        </span>
                      )}
                    </div>

                    {/* Info Produk & Aksi Tambah */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-primary">
                          {rankLabel}
                        </span>
                        <span className="text-[10px] font-sans font-medium text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded">
                          {matchPct}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between gap-1">
                        <h3 className="text-sm sm:text-base font-sans font-bold text-on-surface truncate">
                          {recItem.menuItem.name}
                        </h3>
                        <span className="font-price-tabular text-sm sm:text-base font-bold text-primary shrink-0 tabular-nums">
                          {formatIDR(recItem.menuItem.price)}
                        </span>
                      </div>

                      <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5 leading-relaxed">
                        {recItem.menuItem.description}
                      </p>

                      <div className="flex items-center justify-between mt-2 pt-1">
                        <span className="text-[11px] font-sans font-medium text-on-surface-variant/80 truncate mr-2">
                          {recItem.menuItem.modifierGroups && recItem.menuItem.modifierGroups.length > 0
                            ? 'Kustomisasi: Gula / Es / Susu'
                            : recItem.matchedTags && recItem.matchedTags.length > 0
                            ? recItem.matchedTags.map((t) => t.name).join(' • ')
                            : 'Racikan Pilihan'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAddToCart(recItem.menuItem)}
                          aria-label={`Tambah ${recItem.menuItem.name} ke pesanan`}
                          className="w-8 h-8 rounded-full bg-primary hover:bg-primary-container text-on-primary flex items-center justify-center transition-all active:scale-95 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shrink-0"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* 3. OPSI ALTERNATIF SERUPA (Horizontal Card List) */}
      {data.alternatives.length > 0 && (
        <section className="space-y-3 pt-1">
          <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-primary" />
            <span>Opsi Alternatif Serupa</span>
          </h3>

          <div className="space-y-2.5">
            {data.alternatives.map((alt: RecommendationResultItem) => (
              <article
                key={alt.menuItem.id}
                className="bg-surface-low rounded-xl p-3 sm:p-3.5 flex gap-3 items-center border border-outline-variant/40 hover:border-primary/40 transition-all"
              >
                <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-container border border-outline-variant/30 flex items-center justify-center">
                  {alt.menuItem.image ? (
                    <Image
                      src={alt.menuItem.image}
                      alt={alt.menuItem.name}
                      fill
                      sizes="56px"
                      unoptimized={alt.menuItem.image.startsWith('/api/images/')}
                      className="object-cover"
                    />
                  ) : (
                    <Coffee className="w-5 h-5 text-on-surface-variant/40" />
                  )}
                </div>

                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-1">
                    <h4 className="text-sm font-sans font-bold text-on-surface truncate">
                      {alt.menuItem.name}
                    </h4>
                    <span className="font-price-tabular text-xs font-bold text-primary shrink-0 tabular-nums">
                      {formatIDR(alt.menuItem.price)}
                    </span>
                  </div>

                  <p className="text-[11px] text-on-surface-variant line-clamp-1 mt-0.5">
                    {alt.menuItem.description}
                  </p>

                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {alt.matchedTags.slice(0, 2).map((t) => (
                        <span
                          key={t.id}
                          className="text-[10px] text-on-surface-variant bg-surface-container px-1.5 py-0.5 rounded border border-outline-variant/30 truncate"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddToCart(alt.menuItem)}
                      aria-label={`Tambah ${alt.menuItem.name}`}
                      className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-primary hover:text-on-primary text-primary text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 border border-outline-variant/40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 4. CATATAN ALERGI MAKANAN (Non-medical disclaimer, elegan & anti-slop) */}
      <section className="p-3.5 bg-surface-low border border-outline-variant/60 rounded-xl flex items-start gap-2.5 text-xs text-on-surface-variant">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-on-surface block mb-0.5">
            Catatan Alergi Makanan
          </span>
          <p>{data.disclaimer}</p>
        </div>
      </section>

      {/* 5. AKSI & NAVIGASI BAWAH */}
      <div className="pt-2 flex flex-col sm:flex-row gap-2.5 items-center justify-between">
        <Button
          variant="outline"
          size="md"
          className="w-full sm:w-auto touch-target text-xs font-semibold rounded-full flex items-center justify-center gap-1.5 border-outline-variant hover:bg-surface-container"
          onClick={onResetQuiz}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ulangi Kurasi</span>
        </Button>

        <Link
          href={`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`}
          className="w-full sm:w-auto"
        >
          <Button
            variant="ghost"
            size="md"
            className="w-full touch-target text-xs font-semibold text-primary hover:text-primary-container rounded-full flex items-center justify-center gap-1"
          >
            <span>Lihat Semua Menu Lengkap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </div>

      {/* Product Modifier Drawer */}
      <ProductModifierSheet
        item={selectedItemForModifier}
        isOpen={isModifierSheetOpen}
        onClose={() => {
          setIsModifierSheetOpen(false)
          setSelectedItemForModifier(null)
        }}
      />

      {/* Floating Order Tray */}
      <FloatingOrderTray tableNumber={tableNumber} />
    </div>
  )
}
