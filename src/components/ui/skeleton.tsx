import * as React from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-DEFAULT bg-surface-container', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col rounded-md border border-outline-variant bg-surface-lowest p-3 shadow-level1',
        className
      )}
      aria-hidden="true"
    >
      {/* 1:1 Aspect Ratio Thumbnail */}
      <div className="aspect-square w-full rounded-DEFAULT bg-surface-container animate-pulse" />
      <div className="mt-2.5 space-y-1.5">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <div className="mt-3 flex items-center justify-between pt-1">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    </div>
  )
}

export function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton className={cn('h-11 min-h-touch w-full rounded-DEFAULT', className)} />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={cn('h-3.5', idx === lines - 1 ? 'w-2/3' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function KdsTicketSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant/80 bg-surface-lowest p-5 space-y-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-3.5 w-16 rounded" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-7 w-28 rounded-md" />
        <Skeleton className="h-3.5 w-24 rounded" />
      </div>
      <div className="space-y-2.5 pt-2">
        <div className="space-y-1">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-1/2 rounded" />
        </div>
        <div className="space-y-1">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-3 w-1/3 rounded" />
        </div>
      </div>
      <Skeleton className="h-14 w-full rounded-xl mt-4" />
    </div>
  )
}

export function PosOrderSkeleton() {
  return (
    <div className="rounded-2xl border border-outline-variant/80 bg-surface-lowest p-5 space-y-4 shadow-sm animate-pulse">
      <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
        <Skeleton className="h-6 w-28 rounded-md" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-4 w-20 rounded" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton className="h-4 w-28 rounded" />
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      </div>
      <div className="pt-3 border-t border-outline-variant/60 flex items-center justify-between">
        <Skeleton className="h-5 w-24 rounded" />
        <Skeleton className="h-10 w-36 rounded-xl" />
      </div>
    </div>
  )
}

export function AdminTableRowSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/80 bg-surface-lowest animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-36 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
    </div>
  )
}

