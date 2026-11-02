import * as React from 'react'
import { ToastProvider } from '@/components/ui/toast'
import { ConnectionBanner } from '@/components/ui/connection-banner'
import { StaffSidebarLayout } from '@/components/shells/staff-sidebar-layout'
import { getAuthenticatedStaff } from '@/lib/server/auth-guard'

export const dynamic = 'force-dynamic'

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const staff = await getAuthenticatedStaff()

  const initialStaff = staff
    ? {
        id: staff.sub,
        name: staff.username,
        username: staff.username,
        role: staff.role,
      }
    : null

  return (
    <ToastProvider>
      <div className="min-h-screen bg-surface text-on-surface font-sans antialiased">
        <ConnectionBanner />
        <React.Suspense fallback={<div className="min-h-screen bg-surface" />}>
          <StaffSidebarLayout initialStaff={initialStaff}>{children}</StaffSidebarLayout>
        </React.Suspense>
      </div>
    </ToastProvider>
  )
}
