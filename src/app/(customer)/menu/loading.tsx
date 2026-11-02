import * as React from 'react'
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton'

export default function MenuLoading() {
  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-150">
      {/* Search Bar Skeleton */}
      <Skeleton className="h-11 w-full rounded-full" />

      {/* Curation Hero Prompt Skeleton */}
      <div className="rounded-xl border border-outline-variant bg-surface-lowest p-4 space-y-2">
        <Skeleton className="h-3.5 w-24 rounded" />
        <Skeleton className="h-5 w-48 rounded" />
        <Skeleton className="h-3 w-64 rounded" />
      </div>

      {/* Category Pills Skeleton */}
      <div className="flex gap-2 overflow-x-hidden py-1">
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
        <Skeleton className="h-8 w-24 rounded-full shrink-0" />
        <Skeleton className="h-8 w-28 rounded-full shrink-0" />
        <Skeleton className="h-8 w-20 rounded-full shrink-0" />
      </div>

      {/* Menu Cards 2-Column Grid Skeletons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        {Array.from({ length: 6 }).map((_, idx) => (
          <SkeletonCard key={idx} />
        ))}
      </div>
    </div>
  )
}

