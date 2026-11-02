'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { CatalogCategory } from '@/lib/server/menu-service'

export interface CategoryNavProps {
  categories: CatalogCategory[]
  activeSlug: string
  onSelectCategory: (slug: string) => void
}

export function CategoryNav({
  categories,
  activeSlug,
  onSelectCategory,
}: CategoryNavProps) {
  return (
    <div className="sticky top-14 z-20 -mx-4 border-b border-outline-variant bg-surface/95 px-4 py-2.5 backdrop-blur-md select-none">
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-0.5">
        {categories.map((cat) => {
          const isActive = activeSlug === cat.slug
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className={cn(
                'inline-flex min-h-touch items-center whitespace-nowrap rounded-full px-4 text-xs font-semibold transition-all duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
              )}
            >
              {cat.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

