import * as React from 'react'

export default function PosLoading() {
  return (
    <div className="space-y-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-lowest border border-outline-variant">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-surface-container rounded-md" />
          <div className="h-7 w-64 bg-surface-container rounded-lg" />
          <div className="h-3 w-80 bg-surface-container rounded-md" />
        </div>
        <div className="h-9 w-28 bg-surface-container rounded-xl" />
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-2">
        <div className="h-9 w-36 bg-surface-container rounded-xl" />
        <div className="h-9 w-36 bg-surface-container rounded-xl" />
        <div className="h-9 w-36 bg-surface-container rounded-xl" />
      </div>

      {/* Cards Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant space-y-4">
            <div className="flex justify-between">
              <div className="h-5 w-24 bg-surface-container rounded-md" />
              <div className="h-6 w-20 bg-surface-container rounded-md" />
            </div>
            <div className="space-y-2 py-2">
              <div className="h-4 w-full bg-surface-container rounded-md" />
              <div className="h-4 w-3/4 bg-surface-container rounded-md" />
            </div>
            <div className="h-10 w-full bg-surface-container rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

