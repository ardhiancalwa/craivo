'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export function StaffHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { showToast } = useToast()

  const [timeStr, setTimeStr] = React.useState<string>('')
  const [staffInfo, setStaffInfo] = React.useState<{ name: string; role: string } | null>(null)
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)

  // Live Digital Clock in WIB (UTC+7)
  React.useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const wibHours = String(now.getHours()).padStart(2, '0')
      const wibMinutes = String(now.getMinutes()).padStart(2, '0')
      const wibSeconds = String(now.getSeconds()).padStart(2, '0')
      setTimeStr(`${wibHours}:${wibMinutes}:${wibSeconds} WIB`)
    }

    updateClock()
    const timer = setInterval(updateClock, 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch current authenticated staff profile from /api/auth/me
  React.useEffect(() => {
    let isMounted = true
    async function loadStaffProfile() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const data = await res.json()
          if (isMounted && data.staff) {
            setStaffInfo({ name: data.staff.name, role: data.staff.role })
          }
        }
      } catch {
        // Fallback or unauthenticated
      }
    }

    loadStaffProfile()
    return () => {
      isMounted = false
    }
  }, [])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        showToast('Berhasil logout.', 'info')
        router.push('/login')
        router.refresh()
      } else {
        showToast('Gagal logout. Silakan coba lagi.', 'error')
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat logout.', 'error')
    } finally {
      setIsLoggingOut(false)
    }
  }

  const staffNav = [
    { label: 'POS Kasir', href: '/staff/pos', isActive: pathname.startsWith('/staff/pos') },
    { label: 'KDS Dapur', href: '/staff/kds', isActive: pathname.startsWith('/staff/kds') },
    { label: 'Admin Katalog', href: '/staff/admin', isActive: pathname.startsWith('/staff/admin') },
  ]

  return (
    <header className="sticky top-0 z-30 border-b border-outline-variant bg-surface-lowest px-4 py-2.5 shadow-level1">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Left: Brand & Nav Tabs */}
        <div className="flex items-center gap-6">
          <Link href="/staff/pos" className="flex items-center gap-2">
            <span className="font-display text-lg font-bold text-on-surface">Cravio</span>
            <span className="rounded bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase">
              Staff
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {staffNav.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className={cn(
                  'rounded-DEFAULT px-3 py-1.5 text-xs font-medium transition-colors',
                  tab.isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: Clock, Profile, & Logout */}
        <div className="flex items-center gap-3">
          {timeStr && (
            <span className="hidden sm:inline font-mono text-xs font-semibold tabular-nums text-on-surface-variant">
              {timeStr}
            </span>
          )}

          {staffInfo ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-serif font-bold text-on-surface">
                {staffInfo.name}
              </span>
            </div>
          ) : (
            <span className="text-xs font-serif text-on-surface-variant">
              Staff Portal
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            isLoading={isLoggingOut}
            className="text-xs text-status-error hover:bg-status-error/10 hover:text-status-error"
          >
            Keluar
          </Button>
        </div>
      </div>

      {/* Mobile Nav Tabs for Tablet/Phone */}
      <nav className="mt-2.5 flex items-center justify-around border-t border-outline-variant pt-2 md:hidden">
        {staffNav.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className={cn(
              'rounded-DEFAULT px-2.5 py-1 text-xs font-medium transition-colors',
              tab.isActive
                ? 'bg-primary text-white'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </header>
  )
}

