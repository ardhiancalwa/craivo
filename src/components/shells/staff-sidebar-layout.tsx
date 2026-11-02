'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard,
  CreditCard,
  Coffee,
  Layers,
  QrCode,
  FileSpreadsheet,
  Settings,
  ExternalLink,
  LogOut,
  Search,
  Bell,
  Menu as MenuIcon,
  X,
  Store,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

export interface StaffProfile {
  id: string
  name: string
  username: string
  role: string
}

export interface StaffSidebarLayoutProps {
  children: React.ReactNode
  initialStaff?: StaffProfile | null
}

export function StaffSidebarLayout({ children, initialStaff }: StaffSidebarLayoutProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { showToast } = useToast()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false)
  const [timeStr, setTimeStr] = React.useState<string>('')
  const [staffInfo, setStaffInfo] = React.useState<StaffProfile | null>(initialStaff || null)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [isLoggingOut, setIsLoggingOut] = React.useState(false)
  const [isNavigating, setIsNavigating] = React.useState(false)
  const [isNotifOpen, setIsNotifOpen] = React.useState(false)
  const [hasUnreadNotifs, setHasUnreadNotifs] = React.useState(true)

  const notifRef = React.useRef<HTMLDivElement>(null)

  // Don't render sidebar shell on print pages
  const isPrintPage = pathname.includes('/print')

  // Live WIB Digital Clock
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

  // Load authenticated staff profile from /api/auth/me
  React.useEffect(() => {
    let isMounted = true
    async function loadProfile() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const json = await res.json()
          const staffObj = json.staff || json.user
          if (isMounted && staffObj) {
            setStaffInfo({
              id: staffObj.id,
              name: staffObj.name || staffObj.displayName || staffObj.username || 'Staf Kafe',
              username: staffObj.username || 'staff',
              role: staffObj.role || 'ADMIN',
            })
          }
        }
      } catch {
        // Fallback silently
      }
    }
    loadProfile()
    return () => {
      isMounted = false
    }
  }, [])

  // Close mobile sidebar and navigation progress when route finishes changing
  React.useEffect(() => {
    setIsMobileMenuOpen(false)
    setIsNavigating(false)
  }, [pathname, searchParams])

  // Click outside listener for notification dropdown popover
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false)
      }
    }
    if (isNotifOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isNotifOpen])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' })
      if (res.ok) {
        showToast('Berhasil logout dari sistem.', 'info')
        router.push('/login')
        router.refresh()
      } else {
        showToast('Gagal logout. Silakan coba lagi.', 'error')
      }
    } catch {
      showToast('Terjadi kendala jaringan saat logout.', 'error')
    } finally {
      setIsLoggingOut(false)
    }
  }

  // Active navigation items check
  const currentTab = searchParams.get('tab') || ''
  const isAdminRoot = pathname === '/staff/admin' || pathname === '/staff'
  const effectiveRole = staffInfo?.role || initialStaff?.role || 'ADMIN'

  // Brand header landing destination per role
  const brandHref =
    effectiveRole === 'CASHIER'
      ? '/staff/pos'
      : effectiveRole === 'BARISTA'
      ? '/staff/kds'
      : '/staff/admin'

  const menuItems = React.useMemo(() => {
    const all = [
      {
        label: 'Dashboard',
        href: '/staff/admin',
        icon: LayoutDashboard,
        isActive: isAdminRoot && !currentTab,
        roles: ['ADMIN'],
      },
      {
        label: 'Kasir POS',
        href: '/staff/pos',
        icon: CreditCard,
        isActive: pathname.startsWith('/staff/pos'),
        roles: ['ADMIN', 'CASHIER'],
      },
      {
        label: 'KDS Dapur',
        href: '/staff/kds',
        icon: Coffee,
        isActive: pathname.startsWith('/staff/kds'),
        roles: ['ADMIN', 'BARISTA'],
      },
      {
        label: 'Katalog Menu',
        href: '/staff/admin?tab=catalog',
        icon: Layers,
        isActive: isAdminRoot && currentTab === 'catalog',
        roles: ['ADMIN'],
      },
      {
        label: 'Meja & QR Code',
        href: '/staff/admin?tab=tables',
        icon: QrCode,
        isActive: isAdminRoot && currentTab === 'tables',
        roles: ['ADMIN'],
      },
      {
        label: 'Laporan & Omzet',
        href: '/staff/admin?tab=reports',
        icon: FileSpreadsheet,
        isActive: isAdminRoot && currentTab === 'reports',
        roles: ['ADMIN'],
      },
    ]

    return all.filter((item) => item.roles.includes(effectiveRole))
  }, [effectiveRole, isAdminRoot, currentTab, pathname])

  const generalItems = React.useMemo(() => {
    const all = [
      {
        label: 'Pengaturan Kafe',
        href: '/staff/admin?tab=settings',
        icon: Settings,
        isActive: isAdminRoot && currentTab === 'settings',
        roles: ['ADMIN'],
      },
      {
        label: 'Buka Menu Tamu',
        href: '/menu?table=01',
        icon: ExternalLink,
        isExternal: true,
        roles: ['ADMIN', 'CASHIER', 'BARISTA'],
      },
    ]

    return all.filter((item) => item.roles.includes(effectiveRole))
  }, [effectiveRole, isAdminRoot, currentTab])

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4 sm:p-5 select-none font-sans">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/70 pb-4">
          <Link
            href={brandHref}
            onClick={() => setIsNavigating(true)}
            className="flex items-center gap-2.5 group"
          >
            <div className="relative h-9 w-9 overflow-hidden rounded-xl bg-surface-lowest border border-outline-variant shadow-xs flex items-center justify-center">
              <Image
                src="/logo/only-logo.jpeg"
                alt="Cravio Logo"
                width={36}
                height={36}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="font-sans text-lg font-bold tracking-tight text-on-surface leading-none group-hover:text-primary transition-colors">
                Cravio
              </div>
              <div className="text-[10px] tracking-wide text-on-surface-variant font-sans font-medium uppercase mt-0.5">
                Staff Workspace
              </div>
            </div>
          </Link>

          {/* Mobile Close Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
            aria-label="Tutup Menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* MENU Group */}
        <div className="space-y-1">
          <div className="px-3 text-[10px] font-sans font-bold uppercase tracking-wider text-on-surface-variant/70">
            MENU
          </div>
          <nav className="space-y-0.5 pt-1">
            {menuItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    if (!item.isActive) setIsNavigating(true)
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group min-h-touch',
                    item.isActive
                      ? 'bg-primary text-white shadow-[0_2px_8px_rgba(146,72,5,0.25)]'
                      : 'text-on-surface hover:bg-surface-container hover:text-on-surface'
                  )}
                >
                  <Icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                      item.isActive ? 'text-white' : 'text-primary'
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>
        </div>

        {/* GENERAL Group */}
        <div className="space-y-1 pt-2 border-t border-outline-variant/60">
          <div className="px-3 text-[10px] font-sans font-bold uppercase tracking-wider text-on-surface-variant/70">
            PENGATURAN & AKUN
          </div>
          <nav className="space-y-0.5 pt-1">
            {generalItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  target={item.isExternal ? '_blank' : undefined}
                  rel={item.isExternal ? 'noopener noreferrer' : undefined}
                  onClick={() => {
                    if (!item.isExternal && !item.isActive) setIsNavigating(true)
                  }}
                  className={cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group min-h-touch',
                    item.isActive
                      ? 'bg-primary text-white shadow-xs'
                      : 'text-on-surface hover:bg-surface-container hover:text-on-surface'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'h-4 w-4 shrink-0',
                        item.isActive ? 'text-white' : 'text-on-surface-variant'
                      )}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.isExternal && (
                    <ChevronRight className="h-3.5 w-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  )}
                </Link>
              )
            })}

            {/* Logout Action */}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-status-error hover:bg-status-error/10 transition-colors min-h-touch"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              <span>{isLoggingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Tactile Mini Widget at Bottom of Sidebar */}
      <div className="pt-4">
        <div className="relative overflow-hidden rounded-2xl bg-inverse-surface text-inverse-on-surface p-4 border border-white/10 shadow-level2">
          <div className="absolute -right-6 -bottom-6 h-24 w-24 rounded-full bg-primary/20 blur-xl pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <div className="h-6 w-6 rounded-lg bg-primary/30 border border-primary/40 flex items-center justify-center text-primary">
              <Store className="h-3.5 w-3.5 text-cream" />
            </div>
            <div className="text-xs font-bold font-sans text-white">Cravio POS & QR</div>
          </div>
          <p className="text-[11px] text-cream/70 font-sans leading-relaxed mb-3">
            Sistem QR Meja, Kasir, dan Dapur terhubung secara otomatis.
          </p>
          <Link
            href="/menu?table=07"
            target="_blank"
            className="block text-center w-full py-1.5 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-[11px] font-sans font-semibold text-white border border-white/15 transition-all active:scale-95"
          >
            Tes Buka Meja 07 ↗
          </Link>
        </div>
      </div>
    </div>
  )

  if (isPrintPage) {
    return <div className="font-sans bg-surface min-h-screen text-on-surface">{children}</div>
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-sans antialiased flex">
      {/* Top Instant Navigation Progress Bar */}
      {isNavigating && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-gradient-to-r from-primary via-amber-500 to-primary animate-pulse shadow-xs" />
      )}

      {/* Desktop Sidebar (Sticky, w-64, hidden on mobile/tablet) */}
      <aside className="hidden lg:flex w-64 xl:w-72 flex-col shrink-0 border-r border-outline-variant bg-surface-lowest min-h-screen sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile Slide-over Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Slide-over Drawer Menu */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-72 bg-surface-lowest shadow-level3 transform transition-transform duration-200 ease-in-out lg:hidden overflow-y-auto',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebarContent}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Donezo Style: Search ⌘K + Clock + Interactive Notif Popover + Avatar without role badge) */}
        <header className="sticky top-0 z-30 h-16 border-b border-outline-variant bg-surface-lowest/95 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 select-none">
          {/* Left: Mobile Hamburger & Search Input */}
          <div className="flex items-center gap-3 flex-1 max-w-lg">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-outline-variant hover:bg-surface-container text-on-surface min-h-touch flex items-center justify-center"
              aria-label="Buka Menu Navigasi"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            {/* Donezo-style Search Input */}
            <div className="relative w-full hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-on-surface-variant pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu, nomor meja, atau riwayat pesanan..."
                className="w-full pl-9 pr-12 py-2 rounded-xl bg-surface border border-outline-variant/80 text-xs font-sans text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:border-primary focus:bg-white transition-all shadow-2xs"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden md:flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-surface-container border border-outline-variant text-[10px] font-sans text-on-surface-variant font-semibold">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>
          </div>

          {/* Right: Digital Clock + Notification Modal Dropdown + User Profile (NO role: admin badge!) */}
          <div className="flex items-center gap-3 sm:gap-4">
            {timeStr && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container/70 border border-outline-variant/60 font-sans text-xs font-semibold tabular-nums text-on-surface-variant">
                <span className="h-2 w-2 rounded-full bg-status-paid animate-pulse" />
                <span>{timeStr}</span>
              </div>
            )}

            {/* Notification Popover Button & Floating Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                aria-label="Notifikasi Operasional"
                className={cn(
                  'relative p-2 rounded-xl border transition-all',
                  isNotifOpen
                    ? 'border-primary bg-primary/10 text-primary shadow-xs'
                    : 'border-outline-variant hover:bg-surface-container text-on-surface'
                )}
              >
                <Bell className="h-4 w-4" />
                {hasUnreadNotifs && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-white" />
                )}
              </button>

              {/* Floating Notification Popover Modal */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-surface-lowest border border-outline-variant shadow-level3 p-4 z-50 animate-in fade-in zoom-in-95 duration-100 space-y-3 font-sans">
                  <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-on-surface">Notifikasi Operasional</span>
                      {hasUnreadNotifs && (
                        <span className="px-1.5 py-0.2 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                          3 Baru
                        </span>
                      )}
                    </div>
                    {hasUnreadNotifs && (
                      <button
                        type="button"
                        onClick={() => {
                          setHasUnreadNotifs(false)
                          showToast('Semua notifikasi ditandai telah dibaca.')
                        }}
                        className="text-[10px] font-semibold text-primary hover:underline"
                      >
                        Tandai Dibaca
                      </button>
                    )}
                  </div>

                  {/* Notification List */}
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {(effectiveRole === 'ADMIN' || effectiveRole === 'CASHIER') && (
                      <Link
                        href="/staff/pos"
                        onClick={() => {
                          setIsNotifOpen(false)
                          setIsNavigating(true)
                        }}
                        className="block p-2.5 rounded-xl border border-amber-200/60 bg-amber-50/50 hover:bg-amber-50 transition-colors text-xs"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-amber-900">Pesanan Tunai Baru</span>
                          <span className="text-[10px] text-amber-700/80 font-mono">1m lalu</span>
                        </div>
                        <p className="text-[11px] text-amber-900/80 mt-0.5">
                          Meja 07 memesan Es Kopi Susu. Menunggu konfirmasi penerimaan uang di kasir.
                        </p>
                      </Link>
                    )}

                    {(effectiveRole === 'ADMIN' || effectiveRole === 'BARISTA') && (
                      <Link
                        href="/staff/kds"
                        onClick={() => {
                          setIsNotifOpen(false)
                          setIsNavigating(true)
                        }}
                        className="block p-2.5 rounded-xl border border-emerald-200/60 bg-emerald-50/50 hover:bg-emerald-50 transition-colors text-xs"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold text-emerald-900">KDS Dapur Sinkron</span>
                          <span className="text-[10px] text-emerald-700/80 font-mono">Aktif</span>
                        </div>
                        <p className="text-[11px] text-emerald-900/80 mt-0.5">
                          Layar KDS Dapur terhubung via SSE & audio chime aktif dalam mode stereo.
                        </p>
                      </Link>
                    )}

                    <div className="p-2.5 rounded-xl border border-outline-variant/60 bg-surface/50 text-xs">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-on-surface">Meja Kafe Siap Layanan</span>
                        <span className="text-[10px] text-on-surface-variant font-mono">Sistem</span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant mt-0.5">
                        Seluruh 11 meja kafe aktif terhubung dan siap melayani pesanan tamu.
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-outline-variant/60 flex items-center justify-between text-[11px]">
                    {(effectiveRole === 'ADMIN' || effectiveRole === 'CASHIER') && (
                      <Link
                        href="/staff/pos"
                        onClick={() => {
                          setIsNotifOpen(false)
                          setIsNavigating(true)
                        }}
                        className="font-bold text-primary hover:underline"
                      >
                        Buka Kasir POS ↗
                      </Link>
                    )}
                    {(effectiveRole === 'ADMIN' || effectiveRole === 'BARISTA') && (
                      <Link
                        href="/staff/kds"
                        onClick={() => {
                          setIsNotifOpen(false)
                          setIsNavigating(true)
                        }}
                        className="font-bold text-on-surface hover:underline"
                      >
                        Buka KDS Dapur ↗
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar (Without 'Role: admin' label) */}
            <div className="flex items-center gap-2.5 pl-1 sm:pl-2 border-l border-outline-variant/80">
              <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/20 text-primary font-bold text-sm flex items-center justify-center font-sans shadow-xs">
                {staffInfo?.name ? staffInfo.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="text-xs font-sans font-bold text-on-surface">
                  {staffInfo?.name || 'Admin Kafe'}
                </div>
                <div className="text-[10px] font-sans text-on-surface-variant/80 font-medium">
                  @{staffInfo?.username || 'admin'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  )
}
