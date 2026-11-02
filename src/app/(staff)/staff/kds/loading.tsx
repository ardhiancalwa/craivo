import * as React from 'react'

export default function KdsLoading() {
  return (
    <div className="space-y-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface-lowest border border-outline-variant">
        <div className="space-y-2">
          <div className="h-4 w-32 bg-surface-container rounded-md" />
          <div className="h-7 w-64 bg-surface-container rounded-lg" />
          <div className="h-3 w-72 bg-surface-container rounded-md" />
        </div>
        <div className="h-9 w-36 bg-surface-container rounded-xl" />
      </div>

      {/* Grid of Kitchen Tickets */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-2xl bg-surface-lowest border border-outline-variant space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 w-20 bg-surface-container rounded-md" />
              <div className="h-5 w-16 bg-surface-container rounded-md" />
            </div>
            <div className="space-y-3 py-4">
              <div className="h-5 w-40 bg-surface-container rounded-md" />
              <div className="h-4 w-32 bg-surface-container rounded-md" />
              <div className="h-5 w-36 bg-surface-container rounded-md" />
            </div>
            <div className="h-12 w-full bg-surface-container rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

