'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { KdsTicketSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { audioAlert } from '@/lib/audio-alert'
import { useRealtimeStream, type StreamConnectionStatus } from '@/lib/hooks/use-realtime-stream'
import { cn } from '@/lib/utils'
import { Bell, RefreshCw, ArrowRight } from 'lucide-react'

export interface KdsOrderItem {
  id: string
  name: string
  quantity: number
  notes: string | null
  modifiers: { id: string; name: string }[]
}

export interface KdsOrder {
  id: string
  orderNumber: string
  tableNumber: string
  customerNotes: string | null
  orderStatus: 'QUEUED' | 'COOKING' | 'READY' | 'COMPLETED'
  paymentStatus: string
  paidAt: string | null
  createdAt: string
  updatedAt: string
  items: KdsOrderItem[]
}

interface WaitDuration {
  minutes: number
  severity: 'normal' | 'warning' | 'priority'
  label: string
}

function calculateWaitDuration(paidAtIso: string | null, createdAtIso: string, nowMs: number): WaitDuration {
  const refTime = paidAtIso ? new Date(paidAtIso).getTime() : new Date(createdAtIso).getTime()
  const minutes = Math.max(0, Math.floor((nowMs - refTime) / 60000))

  if (minutes > 20) {
    return { minutes, severity: 'priority', label: `🚨 >20m Prioritas` }
  }
  if (minutes >= 10) {
    return { minutes, severity: 'warning', label: `⚠️ 10-20m Perhatian` }
  }
  return { minutes, severity: 'normal', label: `⏱ ${minutes}m Normal` }
}

export function KdsClientView() {
  const { showToast } = useToast()
  const [orders, setOrders] = React.useState<KdsOrder[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [updatingOrderId, setUpdatingOrderId] = React.useState<string | null>(null)
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now())
  const [currentUserRole, setCurrentUserRole] = React.useState<string | null>(null)

  // Fetch staff role for role-based action buttons
  React.useEffect(() => {
    async function loadRole() {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const json = await res.json()
          const staffObj = json.staff || json.user
          if (staffObj?.role) {
            setCurrentUserRole(staffObj.role)
          }
        }
      } catch {
        // silent
      }
    }
    loadRole()
  }, [])

  // Audio Control States
  const [isAudioUnlocked, setIsAudioUnlocked] = React.useState<boolean>(false)
  const [isMuted, setIsMuted] = React.useState<boolean>(false)
  const [volume, setVolume] = React.useState<number>(0.8)

  // Dedup and Flash Alert References
  const initialLoadedIdsRef = React.useRef<Set<string>>(new Set())
  const isInitialLoadedRef = React.useRef<boolean>(false)
  const [newlyArrivedOrderIds, setNewlyArrivedOrderIds] = React.useState<string[]>([])

  // Initialize audio config on mount
  React.useEffect(() => {
    setIsAudioUnlocked(audioAlert.isAudioUnlocked())
    setIsMuted(audioAlert.isAudioMuted())
    setVolume(audioAlert.getVolume())
  }, [])

  // Timer for wait time counters (updates every 5 seconds)
  React.useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now())
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  // Fetch full active kitchen orders snapshot
  const fetchKdsOrders = React.useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true)
      try {
        const res = await fetch('/api/staff/kds/orders', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (data.success && Array.isArray(data.orders)) {
          // On first snapshot, populate initial known set without sounding alerts
          if (!isInitialLoadedRef.current) {
            data.orders.forEach((o: KdsOrder) => initialLoadedIdsRef.current.add(o.id))
            isInitialLoadedRef.current = true
          }
          setOrders(data.orders)
        }
      } catch (err) {
        console.error('Failed to load KDS orders:', err)
        if (!silent) {
          showToast('Gagal memuat antrean dapur. Periksa koneksi jaringan.', 'error')
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [showToast]
  )

  // Initial load
  React.useEffect(() => {
    fetchKdsOrders(false)
  }, [fetchKdsOrders])

  // Handle SSE Realtime Events
  const handleRealtimeEvent = React.useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      if (eventType === 'ORDER_PAID') {
        const orderId = String(data.orderId || data.aggregateId || '')
        const orderNumber = String(data.orderNumber || '')
        const tableNumber = String(data.tableNumber || '')

        // Dedup: only play chime if this order was NOT in the initial snapshot or already sounded
        if (!orderId || !initialLoadedIdsRef.current.has(orderId)) {
          if (orderId) initialLoadedIdsRef.current.add(orderId)

          // Play audio chime
          audioAlert.playChime()

          // Trigger visual flash border for 2.5s
          if (orderId) {
            setNewlyArrivedOrderIds((prev) => [...prev, orderId])
            setTimeout(() => {
              setNewlyArrivedOrderIds((prev) => prev.filter((id) => id !== orderId))
            }, 2500)
          }

          showToast(`Pesanan Baru #${orderNumber} (Meja ${tableNumber}) masuk antrean!`, 'success')
        }

        // Refresh snapshot to guarantee full modifier and items data
        fetchKdsOrders(true)
      } else if (eventType === 'ORDER_STATUS_CHANGED') {
        const orderId = String(data.orderId || '')
        const newStatus = data.newStatus as 'QUEUED' | 'COOKING' | 'READY' | 'COMPLETED'
        if (newStatus === 'COMPLETED') {
          // Remove from active KDS columns
          setOrders((prev) => prev.filter((o) => o.id !== orderId))
        } else if (newStatus) {
          // Update order status in place
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, orderStatus: newStatus } : o))
          )
        }
      } else if (eventType === 'ORDER_CANCELLED') {
        const orderId = String(data.orderId || '')
        const orderNumber = String(data.orderNumber || '')
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
        showToast(`Pesanan #${orderNumber} telah dibatalkan kasir.`, 'warning')
      }
    },
    [fetchKdsOrders, showToast]
  )

  // Realtime stream hook
  const { connectionStatus } = useRealtimeStream({
    url: '/api/staff/kds/events',
    onEvent: handleRealtimeEvent,
    onReconnectSync: () => fetchKdsOrders(true),
    fallbackPollIntervalMs: 8000,
  })

  // Handle Kitchen Status Transition with Optimistic Concurrency
  const handleTransitionStatus = async (orderId: string, nextStatus: 'COOKING' | 'READY' | 'COMPLETED') => {
    if (updatingOrderId) return
    setUpdatingOrderId(orderId)

    try {
      const res = await fetch(`/api/staff/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        if (nextStatus === 'COMPLETED') {
          setOrders((prev) => prev.filter((o) => o.id !== orderId))
          showToast('Pesanan disajikan dan dipindahkan ke riwayat selesai.', 'success')
        } else {
          setOrders((prev) =>
            prev.map((o) => (o.id === orderId ? { ...o, orderStatus: nextStatus } : o))
          )
          showToast(`Status pesanan berhasil diubah menjadi ${nextStatus}.`, 'success')
        }
      } else if (res.status === 409) {
        // Concurrency Conflict
        showToast(data.message || 'Status pesanan telah diperbarui oleh staf lain.', 'warning')
        fetchKdsOrders(true)
      } else {
        showToast(data.message || 'Gagal mengubah status pesanan.', 'error')
      }
    } catch (err) {
      console.error('Failed to transition order status:', err)
      showToast('Terjadi gangguan jaringan saat memperbarui status.', 'error')
    } finally {
      setUpdatingOrderId(null)
    }
  }

  // Handle Unlock Audio Gesture
  const handleUnlockAudio = async () => {
    const success = await audioAlert.unlockAudio()
    if (success) {
      setIsAudioUnlocked(true)
      audioAlert.playChime()
      showToast('Audio lonceng pesanan dapur aktif!', 'success')
    } else {
      showToast('Gagal mengaktifkan audio. Pastikan speaker tidak diblokir browser.', 'error')
    }
  }

  // Handle Toggle Mute
  const handleToggleMute = () => {
    const next = !isMuted
    audioAlert.setMuted(next)
    setIsMuted(next)
    if (!next) {
      audioAlert.playChime()
    }
  }

  // Handle Change Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value) / 100
    audioAlert.setVolume(val)
    setVolume(val)
  }

  // Filter columns
  const queuedOrders = orders.filter((o) => o.orderStatus === 'QUEUED')
  const cookingOrders = orders.filter((o) => o.orderStatus === 'COOKING')
  const readyOrders = orders.filter((o) => o.orderStatus === 'READY')

  const renderStatusBadge = (status: StreamConnectionStatus) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span>Live SSE (&le; 2s)</span>
          </span>
        )
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
            <span>Menyambungkan...</span>
          </span>
        )
      case 'DEGRADED_POLLING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-900 border border-orange-300">
            <span>⚠️ Polling Terdegradasi</span>
          </span>
        )
      case 'STALE':
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <span>Terputus (Offline)</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* KDS Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 md:p-6 bg-surface rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-wider font-semibold text-olive">
              Kitchen Display System
            </span>
            {renderStatusBadge(connectionStatus)}
          </div>
          <h1 className="text-xl md:text-2xl font-sans font-bold text-brand mt-1">
            KDS Layar Dapur & Barista
          </h1>
          <p className="text-xs text-brand/60 mt-0.5">
            Gerbang KDS Terbuka Khusus Pesanan Lunas (PAID-Only FIFO). Terbaca dari jarak 2 meter.
          </p>
        </div>

        {/* Audio Controls and Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Audio Unlock or Audio Toolbar */}
          {!isAudioUnlocked ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleUnlockAudio}
              className="bg-accent text-white font-bold text-xs flex items-center gap-1.5 shadow-sm hover:bg-accent/90 cursor-pointer"
            >
              <span>🔔 Aktifkan Audio Dapur</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 bg-cream-darker px-3 py-1.5 rounded-xl border border-border text-xs">
              <button
                onClick={handleToggleMute}
                className="font-bold text-brand hover:text-accent cursor-pointer flex items-center gap-1"
                title={isMuted ? 'Nyalakan Suara' : 'Bisukan Suara'}
              >
                <span>{isMuted ? '🔇 Mute' : '🔊 Aktif'}</span>
              </button>
              <span className="text-brand/30">|</span>
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={handleVolumeChange}
                disabled={isMuted}
                className="w-16 accent-accent cursor-pointer disabled:opacity-40"
                title={`Volume: ${Math.round(volume * 100)}%`}
              />
              <span className="font-mono text-[11px] text-brand/70 w-7">
                {Math.round(volume * 100)}%
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => audioAlert.playChime()}
            className="touch-target px-4 py-1.5 rounded-full border border-outline-variant bg-surface-lowest text-xs font-sans font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-2xs active:scale-95"
            title="Uji suara lonceng pesanan"
          >
            <Bell className="w-3.5 h-3.5 text-amber-600" />
            <span>Tes</span>
          </button>

          <button
            type="button"
            onClick={() => fetchKdsOrders(false)}
            disabled={isRefreshing}
            className="touch-target px-4 py-1.5 rounded-full border border-outline-variant bg-surface-lowest text-xs font-sans font-semibold text-on-surface hover:bg-surface-container transition-all flex items-center gap-1.5 shadow-2xs active:scale-95 disabled:opacity-50"
            title="Segarkan antrean pesanan"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>Segarkan</span>
          </button>

          {currentUserRole !== 'BARISTA' && (
            <Link
              href="/staff/pos"
              className="touch-target px-4 py-1.5 rounded-full border border-outline-variant bg-surface-lowest text-xs font-sans font-bold text-on-surface hover:bg-surface-container transition-all inline-flex items-center gap-1.5 shadow-2xs active:scale-95"
            >
              <span>Buka POS Kasir</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </header>

      {/* 3 Columns Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kolom 1 Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-amber-400/40">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400/50 animate-pulse" />
                <h2 className="font-sans font-bold text-brand/60 text-lg">Antrean Masak</h2>
              </div>
              <span className="w-8 h-5 rounded-full bg-surface-container animate-pulse" />
            </div>
            <KdsTicketSkeleton />
            <KdsTicketSkeleton />
          </div>

          {/* Kolom 2 Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-primary/40">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-primary/50 animate-pulse" />
                <h2 className="font-sans font-bold text-brand/60 text-lg">Sedang Diracik</h2>
              </div>
              <span className="w-8 h-5 rounded-full bg-surface-container animate-pulse" />
            </div>
            <KdsTicketSkeleton />
          </div>

          {/* Kolom 3 Skeleton */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500/40">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/50 animate-pulse" />
                <h2 className="font-sans font-bold text-brand/60 text-lg">Siap Saji</h2>
              </div>
              <span className="w-8 h-5 rounded-full bg-surface-container animate-pulse" />
            </div>
            <KdsTicketSkeleton />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Kolom 1: Antrean Masak (QUEUED) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-amber-400">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-amber-400" />
                <h2 className="font-sans font-bold text-brand text-lg">Antrean Masak</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 font-mono">
                {queuedOrders.length}
              </span>
            </div>

            {queuedOrders.length === 0 ? (
              <div className="p-8 text-center bg-surface-low rounded-2xl border border-border/60 text-xs text-brand/50">
                Tidak ada pesanan menunggu masak
              </div>
            ) : (
              <div className="space-y-4">
                {queuedOrders.map((order) => {
                  const wait = calculateWaitDuration(order.paidAt, order.createdAt, nowMs)
                  const isBusy = updatingOrderId === order.id
                  const isFlashing = newlyArrivedOrderIds.includes(order.id)

                  const borderClass =
                    wait.severity === 'priority'
                      ? 'border-red-600 bg-red-50/25 ring-2 ring-red-400 motion-safe:animate-pulse motion-reduce:animate-none'
                      : wait.severity === 'warning'
                        ? 'border-amber-500 bg-amber-50/20'
                        : 'border-border/90 bg-surface'

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'rounded-2xl border-2 p-5 flex flex-col justify-between shadow-xs transition-all duration-300',
                        borderClass,
                        isFlashing && 'ring-4 ring-amber-500 shadow-xl'
                      )}
                    >
                      <div>
                        {/* Header: Meja >= 28px & Order Number */}
                        <div className="flex items-start justify-between border-b border-border/80 pb-3">
                          <div>
                            <span className="text-[28px] md:text-3xl font-sans font-black tracking-tight text-brand block">
                              Meja {order.tableNumber}
                            </span>
                            <span className="font-mono text-xs font-bold text-brand/70 block mt-0.5">
                              #{order.orderNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/staff/orders/${order.id}/print?type=kitchen`}
                              className="p-1.5 text-xs rounded-md bg-cream-darker border border-border text-brand/70 hover:text-brand hover:bg-cream transition-colors"
                              title="Cetak Tiket Dapur"
                            >
                              🖨️
                            </Link>
                            <span
                              className={cn(
                                'text-xs font-mono font-bold px-2.5 py-1 rounded-md border',
                                wait.severity === 'priority'
                                  ? 'bg-red-600 text-white border-red-700'
                                  : wait.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-cream-darker text-brand/80 border-border'
                              )}
                            >
                              {wait.label}
                            </span>
                          </div>
                        </div>

                        {/* Customer Barista Notes */}
                        {order.customerNotes && (
                          <div className="mt-3.5 p-3 rounded-xl bg-amber-100 border border-amber-300 text-xs text-amber-950 font-bold">
                            <span className="uppercase tracking-wider text-[11px] block text-amber-800">
                              Catatan Khusus:
                            </span>
                            <p className="mt-0.5 text-sm font-semibold">&ldquo;{order.customerNotes}&rdquo;</p>
                          </div>
                        )}

                        {/* Items List: Nama Item >= 18px */}
                        <div className="mt-4 space-y-3">
                          {order.items.map((it) => (
                            <div key={it.id} className="text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                              <div className="text-[18px] md:text-xl font-bold text-brand leading-snug flex items-start gap-2">
                                <span className="text-accent shrink-0">{it.quantity}x</span>
                                <span>{it.name}</span>
                              </div>
                              {it.modifiers.length > 0 && (
                                <div className="pl-6 text-xs text-brand/80 font-medium space-y-0.5 mt-1">
                                  {it.modifiers.map((m) => (
                                    <div key={m.id}>• {m.name}</div>
                                  ))}
                                </div>
                              )}
                              {it.notes && (
                                <div className="pl-6 text-xs italic text-brand/70 mt-0.5">
                                  &ldquo;{it.notes}&rdquo;
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button: Target Touch >= 56px */}
                      <button
                        onClick={() => handleTransitionStatus(order.id, 'COOKING')}
                        disabled={isBusy}
                        className="kds-touch min-h-[56px] w-full mt-6 py-4 rounded-xl bg-amber-500 hover:bg-amber-600 active:scale-98 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size="sm" /> : <span>▶</span>}
                        <span>{isBusy ? 'Memperbarui...' : 'Mulai Racik (COOKING)'}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kolom 2: Sedang Dimasak (COOKING) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-brand">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-brand" />
                <h2 className="font-sans font-bold text-brand text-lg">Sedang Dimasak</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-cream-darker text-brand font-mono">
                {cookingOrders.length}
              </span>
            </div>

            {cookingOrders.length === 0 ? (
              <div className="p-8 text-center bg-surface-low rounded-2xl border border-border/60 text-xs text-brand/50">
                Belum ada menu yang sedang diracik
              </div>
            ) : (
              <div className="space-y-4">
                {cookingOrders.map((order) => {
                  const wait = calculateWaitDuration(order.paidAt, order.createdAt, nowMs)
                  const isBusy = updatingOrderId === order.id

                  const borderClass =
                    wait.severity === 'priority'
                      ? 'border-red-600 bg-red-50/25 ring-2 ring-red-400 motion-safe:animate-pulse motion-reduce:animate-none'
                      : wait.severity === 'warning'
                        ? 'border-amber-500 bg-amber-50/20'
                        : 'border-brand/50 bg-surface'

                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'rounded-2xl border-2 p-5 flex flex-col justify-between shadow-xs transition-all duration-300',
                        borderClass
                      )}
                    >
                      <div>
                        {/* Header: Meja >= 28px & Order Number */}
                        <div className="flex items-start justify-between border-b border-border/80 pb-3">
                          <div>
                            <span className="text-[28px] md:text-3xl font-sans font-black tracking-tight text-brand block">
                              Meja {order.tableNumber}
                            </span>
                            <span className="font-mono text-xs font-bold text-brand/70 block mt-0.5">
                              #{order.orderNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/staff/orders/${order.id}/print?type=kitchen`}
                              className="p-1.5 text-xs rounded-md bg-cream-darker border border-border text-brand/70 hover:text-brand hover:bg-cream transition-colors"
                              title="Cetak Tiket Dapur"
                            >
                              🖨️
                            </Link>
                            <span
                              className={cn(
                                'text-xs font-mono font-bold px-2.5 py-1 rounded-md border',
                                wait.severity === 'priority'
                                  ? 'bg-red-600 text-white border-red-700'
                                  : wait.severity === 'warning'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-amber-100 text-amber-900 border-amber-300'
                              )}
                            >
                              {wait.label}
                            </span>
                          </div>
                        </div>

                        {/* Customer Barista Notes */}
                        {order.customerNotes && (
                          <div className="mt-3.5 p-3 rounded-xl bg-amber-100 border border-amber-300 text-xs text-amber-950 font-bold">
                            <span className="uppercase tracking-wider text-[11px] block text-amber-800">
                              Catatan Khusus:
                            </span>
                            <p className="mt-0.5 text-sm font-semibold">&ldquo;{order.customerNotes}&rdquo;</p>
                          </div>
                        )}

                        {/* Items List: Nama Item >= 18px */}
                        <div className="mt-4 space-y-3">
                          {order.items.map((it) => (
                            <div key={it.id} className="text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                              <div className="text-[18px] md:text-xl font-bold text-brand leading-snug flex items-start gap-2">
                                <span className="text-accent shrink-0">{it.quantity}x</span>
                                <span>{it.name}</span>
                              </div>
                              {it.modifiers.length > 0 && (
                                <div className="pl-6 text-xs text-brand/80 font-medium space-y-0.5 mt-1">
                                  {it.modifiers.map((m) => (
                                    <div key={m.id}>• {m.name}</div>
                                  ))}
                                </div>
                              )}
                              {it.notes && (
                                <div className="pl-6 text-xs italic text-brand/70 mt-0.5">
                                  &ldquo;{it.notes}&rdquo;
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button: Target Touch >= 56px */}
                      <button
                        onClick={() => handleTransitionStatus(order.id, 'READY')}
                        disabled={isBusy}
                        className="kds-touch min-h-[56px] w-full mt-6 py-4 rounded-xl bg-brand hover:bg-brand/90 active:scale-98 text-cream font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size="sm" /> : <span>✓</span>}
                        <span>{isBusy ? 'Memperbarui...' : 'Tandai Siap Saji (READY)'}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Kolom 3: Siap Saji (READY) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b-2 border-emerald-500">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
                <h2 className="font-sans font-bold text-brand text-lg">Siap Saji</h2>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 font-mono">
                {readyOrders.length}
              </span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="p-8 text-center bg-surface-low rounded-2xl border border-border/60 text-xs text-brand/50">
                Tidak ada pesanan menunggu diantar ke meja
              </div>
            ) : (
              <div className="space-y-4">
                {readyOrders.map((order) => {
                  const wait = calculateWaitDuration(order.paidAt, order.createdAt, nowMs)
                  const isBusy = updatingOrderId === order.id

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl border-2 border-emerald-400 bg-emerald-50/15 p-5 flex flex-col justify-between shadow-xs"
                    >
                      <div>
                        {/* Header: Meja >= 28px & Order Number */}
                        <div className="flex items-start justify-between border-b border-border/80 pb-3">
                          <div>
                            <span className="text-[28px] md:text-3xl font-sans font-black tracking-tight text-emerald-950 block">
                              Meja {order.tableNumber}
                            </span>
                            <span className="font-mono text-xs font-bold text-brand/70 block mt-0.5">
                              #{order.orderNumber}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/staff/orders/${order.id}/print?type=kitchen`}
                              className="p-1.5 text-xs rounded-md bg-emerald-100 border border-emerald-300 text-emerald-900 hover:bg-emerald-200 transition-colors"
                              title="Cetak Tiket Dapur"
                            >
                              🖨️
                            </Link>
                            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300">
                              {wait.label}
                            </span>
                          </div>
                        </div>

                        {/* Items List: Nama Item >= 18px */}
                        <div className="mt-4 space-y-2.5">
                          {order.items.map((it) => (
                            <div key={it.id} className="text-xs">
                              <div className="text-[18px] md:text-xl font-bold text-brand leading-snug flex items-start gap-2">
                                <span className="text-emerald-700 shrink-0">{it.quantity}x</span>
                                <span>{it.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Button: Target Touch >= 56px */}
                      <button
                        onClick={() => handleTransitionStatus(order.id, 'COMPLETED')}
                        disabled={isBusy}
                        className="kds-touch min-h-[56px] w-full mt-6 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size="sm" /> : <span>✓</span>}
                        <span>{isBusy ? 'Menyimpan...' : 'Selesai Disajikan (COMPLETED)'}</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
