import * as React from 'react'

export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse select-none">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-surface-container rounded-lg" />
          <div className="h-4 w-72 bg-surface-container rounded-md" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-28 bg-surface-container rounded-xl" />
          <div className="h-9 w-28 bg-surface-container rounded-xl" />
        </div>
      </div>

      {/* 4 KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 rounded-3xl bg-surface-lowest border border-outline-variant space-y-3">
            <div className="flex justify-between">
              <div className="h-4 w-28 bg-surface-container rounded-md" />
              <div className="h-6 w-6 rounded-full bg-surface-container" />
            </div>
            <div className="h-8 w-32 bg-surface-container rounded-lg" />
            <div className="h-3 w-40 bg-surface-container rounded-md" />
          </div>
        ))}
      </div>

      {/* Grid of Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-64 rounded-3xl bg-surface-lowest border border-outline-variant p-5 space-y-3">
            <div className="h-5 w-32 bg-surface-container rounded-md" />
            <div className="h-4 w-48 bg-surface-container rounded-md" />
            <div className="h-40 bg-surface-container/40 rounded-2xl" />
          </div>
        ))}
      </div>
    </div>
  )
}

