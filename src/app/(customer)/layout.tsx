import * as React from 'react'
import prisma from '@/lib/server/db'
import { ToastProvider } from '@/components/ui/toast'
import { CartProvider } from '@/lib/cart-context'
import { ConnectionBanner } from '@/components/ui/connection-banner'
import { CustomerHeader } from '@/components/shells/customer-header'
import { CustomerBottomNav } from '@/components/shells/customer-bottom-nav'

export const dynamic = 'force-dynamic'

async function getCafeConfig() {
  try {
    const config = await prisma.cravioConfig.findUnique({
      where: { id: 'cravio-main-config' },
      select: { name: true },
    })
    return config?.name || 'Cravio'
  } catch {
    return 'Cravio'
  }
}

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cafeName = await getCafeConfig()

  return (
    <ToastProvider>
      <CartProvider>
        <div className="min-h-screen bg-surface flex flex-col justify-between font-sans">
          <ConnectionBanner />
          <React.Suspense fallback={<div className="h-14 w-full bg-surface" />}>
            <CustomerHeader cafeName={cafeName} />
          </React.Suspense>

          {/* Main Viewport Container: Mobile Centered (Max Width 430px) */}
          <main className="mx-auto w-full max-w-md flex-1 px-4 pt-3 pb-28 pb-safe overflow-x-hidden">
            {children}
          </main>

          <React.Suspense fallback={null}>
            <CustomerBottomNav />
          </React.Suspense>
        </div>
      </CartProvider>
    </ToastProvider>
  )
}
