'use client'

import * as React from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Spinner } from '@/components/ui/spinner'
import { PosOrderSkeleton } from '@/components/ui/skeleton'
import { useToast } from '@/components/ui/toast'
import { useRealtimeStream, type StreamConnectionStatus } from '@/lib/hooks/use-realtime-stream'
import { formatIDR, cn } from '@/lib/utils'
import { Check, Printer, Clock, AlertTriangle } from 'lucide-react'

export type PosTab = 'cash_queue' | 'paid_history' | 'cancelled_history'

export interface OrderItemModifier {
  id: string
  name: string
  price: number
}

export interface OrderItem {
  id: string
  name: string
  price: number
  quantity: number
  notes: string | null
  subtotal: number
  modifiers: OrderItemModifier[]
}

export interface ManualRefund {
  id: string
  amount: number
  reason: string
  refundMethod: string
  approvedAt: string
  notes: string | null
  staffUsername: string
}

export interface AuditLogItem {
  id: string
  action: string
  createdAt: string
  details: string | null
}

export interface PosOrder {
  id: string
  orderNumber: string
  tableNumber: string
  tableLabel: string | null
  customerNotes: string | null
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  createdAt: string
  paidAt: string | null
  updatedAt: string
  items: OrderItem[]
  manualRefunds: ManualRefund[]
  totalRefunded: number
  remainingRefundable: number
  auditLogs: AuditLogItem[]
}

interface PosCounts {
  cashQueue: number
  paidHistory: number
  cancelledHistory: number
}

function calculateAge(createdAtIso: string, currentTimeMs: number): { text: string; severity: 'normal' | 'warning' | 'danger' } {
  const createdMs = new Date(createdAtIso).getTime()
  const diffSec = Math.max(0, Math.floor((currentTimeMs - createdMs) / 1000))
  const minutes = Math.floor(diffSec / 60)
  const seconds = diffSec % 60

  let text = ''
  if (minutes < 1) {
    text = `${seconds}d lalu`
  } else if (minutes < 60) {
    text = `${minutes}m ${seconds}d lalu`
  } else {
    const hours = Math.floor(minutes / 60)
    const remMin = minutes % 60
    text = `${hours}j ${remMin}m lalu`
  }

  let severity: 'normal' | 'warning' | 'danger' = 'normal'
  if (minutes >= 20) {
    severity = 'danger'
  } else if (minutes >= 10) {
    severity = 'warning'
  }

  return { text, severity }
}

export function PosClientView() {
  const { showToast } = useToast()
  const [activeTab, setActiveTab] = React.useState<PosTab>('cash_queue')
  const [orders, setOrders] = React.useState<PosOrder[]>([])
  const [counts, setCounts] = React.useState<PosCounts>({
    cashQueue: 0,
    paidHistory: 0,
    cancelledHistory: 0,
  })
  const [isLoading, setIsLoading] = React.useState(true)
  const [isRefreshing, setIsRefreshing] = React.useState(false)
  const [nowMs, setNowMs] = React.useState<number>(() => Date.now())

  // Modal States
  const [confirmOrder, setConfirmOrder] = React.useState<PosOrder | null>(null)
  const [isConfirming, setIsConfirming] = React.useState(false)

  const [cancelOrder, setCancelOrder] = React.useState<PosOrder | null>(null)
  const [cancelReason, setCancelReason] = React.useState('')
  const [isCancelling, setIsCancelling] = React.useState(false)

  const [refundOrder, setRefundOrder] = React.useState<PosOrder | null>(null)
  const [refundAmount, setRefundAmount] = React.useState<number>(0)
  const [refundReason, setRefundReason] = React.useState('')
  const [refundNotes, setRefundNotes] = React.useState('')
  const [isRefunding, setIsRefunding] = React.useState(false)

  const handleCloseConfirmModal = React.useCallback(() => {
    if (!isConfirming) setConfirmOrder(null)
  }, [isConfirming])

  const handleCloseCancelModal = React.useCallback(() => {
    if (!isCancelling) {
      setCancelOrder(null)
      setCancelReason('')
    }
  }, [isCancelling])

  const handleCloseRefundModal = React.useCallback(() => {
    if (!isRefunding) {
      setRefundOrder(null)
      setRefundReason('')
      setRefundNotes('')
    }
  }, [isRefunding])

  // Live Timer for Order Age
  React.useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now())
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  // Fetch orders from server
  const fetchOrders = React.useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true)
      try {
        const res = await fetch(`/api/staff/orders?tab=${activeTab}`, {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`)
        }
        const data = await res.json()
        if (data.success) {
          setOrders(data.orders || [])
          if (data.counts) {
            setCounts(data.counts)
          }
        }
      } catch (err) {
        console.error('Failed to load orders:', err)
        if (!silent) {
          showToast('Gagal memuat pesanan. Periksa koneksi jaringan Anda.', 'error')
        }
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [activeTab, showToast]
  )

  // Initial fetch and on tab change
  React.useEffect(() => {
    setIsLoading(true)
    fetchOrders(false)
  }, [fetchOrders])

  // Handle Realtime SSE Events
  const handleRealtimeEvent = React.useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      if (eventType === 'NEW_CASH_ORDER') {
        const orderNumber = String(data.orderNumber || '')
        const tableNumber = String(data.tableNumber || '')
        showToast(`Pesanan Tunai Baru #${orderNumber} (Meja ${tableNumber}) masuk!`, 'info')
        fetchOrders(true)
      } else if (eventType === 'ORDER_PAID' || eventType === 'ORDER_CANCELLED') {
        fetchOrders(true)
      }
    },
    [fetchOrders, showToast]
  )

  // Realtime stream with fallback polling
  const { connectionStatus } = useRealtimeStream({
    url: '/api/staff/pos/events',
    onEvent: handleRealtimeEvent,
    onReconnectSync: () => fetchOrders(true),
    fallbackPollIntervalMs: 10000,
  })

  // Handle Confirm Cash Payment
  const handleConfirmCash = async () => {
    if (!confirmOrder || isConfirming) return
    setIsConfirming(true)
    try {
      const res = await fetch(`/api/staff/orders/${confirmOrder.id}/confirm-cash`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(
          `Pesanan ${confirmOrder.orderNumber} berhasil ditandai LUNAS dan diteruskan ke KDS Dapur.`,
          'success'
        )
        setConfirmOrder(null)
        fetchOrders(false)
      } else {
        showToast(data.message || 'Pembayaran gagal dikonfirmasi.', 'error')
      }
    } catch (err) {
      console.error('Error confirming cash:', err)
      showToast('Terjadi gangguan jaringan saat konfirmasi pembayaran.', 'error')
    } finally {
      setIsConfirming(false)
    }
  }

  // Handle Cancel Order
  const handleCancelOrder = async () => {
    if (!cancelOrder || isCancelling) return
    if (!cancelReason.trim() || cancelReason.trim().length < 3) {
      showToast('Mohon masukkan alasan pembatalan minimal 3 karakter.', 'error')
      return
    }

    setIsCancelling(true)
    try {
      const res = await fetch(`/api/staff/orders/${cancelOrder.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(data.message || `Pesanan ${cancelOrder.orderNumber} telah dibatalkan.`, 'success')
        setCancelOrder(null)
        setCancelReason('')
        fetchOrders(false)
      } else {
        showToast(data.message || 'Pesanan gagal dibatalkan.', 'error')
      }
    } catch (err) {
      console.error('Error cancelling order:', err)
      showToast('Terjadi gangguan saat membatalkan pesanan.', 'error')
    } finally {
      setIsCancelling(false)
    }
  }

  // Handle Record Manual Refund
  const handleRecordRefund = async () => {
    if (!refundOrder || isRefunding) return
    if (refundAmount <= 0 || !Number.isInteger(refundAmount)) {
      showToast('Nominal refund harus berupa bilangan bulat positif dalam Rupiah.', 'error')
      return
    }

    if (!refundReason.trim() || refundReason.trim().length < 3) {
      showToast('Mohon isi alasan pengembalian uang fisik minimal 3 karakter.', 'error')
      return
    }

    setIsRefunding(true)
    try {
      const res = await fetch(`/api/staff/orders/${refundOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: refundAmount,
          reason: refundReason.trim(),
          notes: refundNotes.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        showToast(
          `Pengembalian fisik senilai ${formatIDR(refundAmount)} untuk pesanan ${refundOrder.orderNumber} berhasil dicatat.`,
          'success'
        )
        setRefundOrder(null)
        setRefundAmount(0)
        setRefundReason('')
        setRefundNotes('')
        fetchOrders(false)
      } else {
        showToast(data.message || 'Refund gagal dicatat.', 'error')
      }
    } catch (err) {
      console.error('Error recording refund:', err)
      showToast('Terjadi kendala jaringan saat mencatat refund.', 'error')
    } finally {
      setIsRefunding(false)
    }
  }

  const renderStatusBadge = (status: StreamConnectionStatus) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Live SSE (&le; 2s)</span>
          </span>
        )
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>Menyambungkan...</span>
          </span>
        )
      case 'DEGRADED_POLLING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-900 border border-orange-300">
            <span>⚠️ Polling Terdegradasi</span>
          </span>
        )
      case 'STALE':
      case 'OFFLINE':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-300">
            <span>Terputus (Offline)</span>
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface p-4 md:p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs uppercase tracking-wider font-semibold text-olive">
              Kasir Point of Sale
            </span>
            {renderStatusBadge(connectionStatus)}
          </div>
          <h1 className="text-xl md:text-2xl font-sans font-bold text-brand mt-0.5">
            Terminal Kasir POS & Antrean Tunai
          </h1>
          <p className="text-xs md:text-sm text-brand/60 mt-1">
            Konfirmasi uang tunai fisik, pantau transaksi lunas, dan kelola pembatalan berizin.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrders(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            {isRefreshing ? <Spinner size="sm" /> : <span>↻</span>}
            <span>Segarkan</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-2 md:gap-4 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('cash_queue')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'cash_queue'
              ? 'border-accent text-accent'
              : 'border-transparent text-brand/60 hover:text-brand hover:border-border'
          )}
        >
          <span>Antrean Bayar Tunai</span>
          {counts.cashQueue > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold transition-colors',
                activeTab === 'cash_queue'
                  ? 'bg-accent text-white'
                  : 'bg-cream-darker text-brand/80'
              )}
            >
              {counts.cashQueue}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('paid_history')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'paid_history'
              ? 'border-accent text-accent'
              : 'border-transparent text-brand/60 hover:text-brand hover:border-border'
          )}
        >
          <span>Riwayat Transaksi Lunas</span>
          {counts.paidHistory > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold transition-colors',
                activeTab === 'paid_history'
                  ? 'bg-accent text-white'
                  : 'bg-cream-darker text-brand/80'
              )}
            >
              {counts.paidHistory}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('cancelled_history')}
          className={cn(
            'flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all whitespace-nowrap',
            activeTab === 'cancelled_history'
              ? 'border-accent text-accent'
              : 'border-transparent text-brand/60 hover:text-brand hover:border-border'
          )}
        >
          <span>Riwayat Batal & Refund</span>
          {counts.cancelledHistory > 0 && (
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-xs font-bold transition-colors',
                activeTab === 'cancelled_history'
                  ? 'bg-accent text-white'
                  : 'bg-cream-darker text-brand/80'
              )}
            >
              {counts.cancelledHistory}
            </span>
          )}
        </button>
      </div>

      {/* Orders List Container */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <PosOrderSkeleton key={i} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          title={
            activeTab === 'cash_queue'
              ? 'Tidak Ada Antrean Tunai'
              : activeTab === 'paid_history'
                ? 'Belum Ada Transaksi Lunas'
                : 'Belum Ada Pesanan Batal'
          }
          description={
            activeTab === 'cash_queue'
              ? 'Semua pelanggan telah melunasi pesanan mereka. Pesanan tunai baru akan otomatis muncul di sini.'
              : activeTab === 'paid_history'
                ? 'Daftar riwayat transaksi lunas akan terdata secara otomatis setelah konfirmasi.'
                : 'Tidak ada catatan pesanan dibatalkan saat ini.'
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => {
            const age = calculateAge(order.createdAt, nowMs)
            return (
              <div
                key={order.id}
                className={cn(
                  'bg-surface-lowest rounded-2xl border p-4 md:p-5 flex flex-col justify-between transition-all hover:shadow-level1 relative',
                  order.paymentStatus === 'WAITING_CASHIER'
                    ? 'border-outline-variant shadow-2xs hover:border-outline'
                    : order.orderStatus === 'CANCELLED'
                      ? 'border-red-200/80 bg-red-50/20'
                      : 'border-outline-variant/60 shadow-2xs'
                )}
              >
                {/* Header Card: Order Number & Table Badge */}
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-outline-variant/60 pb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold font-sans text-on-surface bg-surface-container px-2.5 py-1 rounded-lg">
                          Meja {order.tableNumber}
                        </span>
                        <span className="font-mono font-bold text-xs tracking-tight text-on-surface-variant">
                          #{order.orderNumber}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-sans font-bold px-2 py-0.5 rounded-full uppercase tracking-wider',
                            order.paymentMethod === 'CASH'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-blue-500/10 text-blue-700'
                          )}
                        >
                          {order.paymentMethod}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Clock className="w-3.5 h-3.5 text-on-surface-variant" />
                        <span
                          className={cn(
                            'text-xs font-sans font-medium',
                            age.severity === 'danger'
                              ? 'text-red-600 font-bold animate-pulse'
                              : age.severity === 'warning'
                                ? 'text-amber-700 font-semibold'
                                : 'text-on-surface-variant'
                          )}
                        >
                          {age.text}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-base md:text-lg font-black font-sans text-on-surface block tabular-nums">
                        {formatIDR(order.totalAmount)}
                      </span>
                      <span className="text-[11px] font-sans text-on-surface-variant">
                        {order.items.reduce((acc, i) => acc + i.quantity, 0)} item
                      </span>
                    </div>
                  </div>

                  {/* Customer Barista Notes */}
                  {order.customerNotes && (
                    <div className="mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 font-sans">
                      <span className="font-bold">Catatan Dapur:</span> &ldquo;{order.customerNotes}&rdquo;
                    </div>
                  )}

                  {/* Item List */}
                  <div className="mt-3 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {order.items.map((item) => (
                      <div key={item.id} className="text-xs">
                        <div className="flex items-start justify-between font-sans text-on-surface">
                          <span>
                            <span className="font-bold text-primary mr-1.5">{item.quantity}x</span>
                            <span className="font-semibold">{item.name}</span>
                          </span>
                          <span className="text-on-surface-variant font-medium tabular-nums">{formatIDR(item.subtotal)}</span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <div className="pl-5 text-[11px] font-sans text-on-surface-variant space-y-0.5 mt-0.5">
                            {item.modifiers.map((mod) => (
                              <div key={mod.id}>
                                + {mod.name} {mod.price > 0 && `(${formatIDR(mod.price)})`}
                              </div>
                            ))}
                          </div>
                        )}
                        {item.notes && (
                          <div className="pl-5 text-[11px] font-sans italic text-on-surface-variant">
                            &ldquo;{item.notes}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Manual Refunds History if Cancelled */}
                  {order.manualRefunds.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-200 text-xs space-y-1.5 font-sans">
                      <div className="font-bold text-red-900 flex justify-between">
                        <span>Riwayat Refund Fisik:</span>
                        <span className="tabular-nums">{formatIDR(order.totalRefunded)}</span>
                      </div>
                      {order.manualRefunds.map((ref) => (
                        <div key={ref.id} className="text-[11px] text-red-800 border-t border-red-200/60 pt-1">
                          <div className="flex justify-between font-semibold">
                            <span className="tabular-nums">{formatIDR(ref.amount)}</span>
                            <span className="text-red-700/80">Kasir: {ref.staffUsername}</span>
                          </div>
                          <div>Alasan: {ref.reason}</div>
                          {ref.notes && <div className="italic text-red-600">Catatan: {ref.notes}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons */}
                <div className="mt-4 pt-3 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                  {order.paymentStatus === 'WAITING_CASHIER' && order.orderStatus !== 'CANCELLED' ? (
                    <>
                      <button
                        type="button"
                        className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-sans font-bold text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                        onClick={() => setConfirmOrder(order)}
                      >
                        <Check className="w-4 h-4" />
                        <span>Konfirmasi Uang Masuk</span>
                      </button>
                      <Link
                        href={`/staff/orders/${order.id}/print?type=cashier`}
                        className="p-2.5 border border-outline-variant bg-surface-lowest rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all shadow-2xs active:scale-95 flex items-center justify-center"
                        title="Cetak Pra-Struk / Tagihan Meja"
                      >
                        <Printer className="w-4 h-4" />
                      </Link>
                      <button
                        type="button"
                        className="px-3 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-sans font-semibold transition-all active:scale-95"
                        onClick={() => {
                          setCancelOrder(order)
                          setCancelReason('')
                        }}
                      >
                        Batalkan
                      </button>
                    </>
                  ) : order.orderStatus === 'CANCELLED' ? (
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="error">DIBATALKAN</Badge>
                        <Link
                          href={`/staff/orders/${order.id}/print?type=cashier`}
                          className="p-2 border border-outline-variant rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors text-xs flex items-center justify-center"
                          title="Cetak Bukti Pembatalan"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                      {order.paymentStatus === 'PAID' && order.remainingRefundable > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-amber-800 border-amber-300 hover:bg-amber-50 text-xs font-semibold"
                          onClick={() => {
                            setRefundOrder(order)
                            setRefundAmount(order.remainingRefundable)
                            setRefundReason('')
                            setRefundNotes('')
                          }}
                        >
                          + Catat Refund ({formatIDR(order.remainingRefundable)})
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="paid">LUNAS</Badge>
                        <span className="text-[11px] text-on-surface-variant font-sans">
                          {order.paidAt ? new Date(order.paidAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'} WIB
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/staff/orders/${order.id}/print?type=cashier`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface bg-surface-lowest border border-outline-variant px-3 py-1.5 rounded-xl hover:bg-surface-container transition-colors shadow-2xs font-sans"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </Link>
                        {order.orderStatus !== 'COMPLETED' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 text-xs font-sans"
                            onClick={() => {
                              setCancelOrder(order)
                              setCancelReason('')
                            }}
                          >
                            Batalkan & Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal 1: Dialog Konfirmasi Uang Fisik */}
      <Dialog
        isOpen={!!confirmOrder}
        onClose={handleCloseConfirmModal}
        title="Konfirmasi Uang Fisik Tunai"
        maxWidth="md"
      >
        {confirmOrder && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-surface-container border border-outline-variant text-center">
              <span className="text-xs text-on-surface-variant font-semibold block uppercase tracking-wider font-sans">
                Total Tagihan Tunai
              </span>
              <span className="text-2xl md:text-3xl font-bold text-accent font-sans block mt-1">
                {formatIDR(confirmOrder.totalAmount)}
              </span>
              <div className="flex items-center justify-center gap-2 mt-2 text-xs text-amber-900/80">
                <span className="font-mono font-bold">#{confirmOrder.orderNumber}</span>
                <span>•</span>
                <span className="font-semibold">Meja {confirmOrder.tableNumber}</span>
              </div>
            </div>

            <p className="text-xs md:text-sm text-brand/80 leading-relaxed">
              Pastikan uang tunai fisik sebesar{' '}
              <strong className="text-brand font-bold">
                {formatIDR(confirmOrder.totalAmount)}
              </strong>{' '}
              telah Anda terima dan dihitung secara tepat sebelum mengonfirmasi. Pesanan akan langsung
              diteruskan ke layar antrean dapur (KDS).
            </p>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="md"
                onClick={() => setConfirmOrder(null)}
                disabled={isConfirming}
                className="rounded-xl px-5 font-sans font-bold"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleConfirmCash}
                disabled={isConfirming}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-sans font-bold min-w-[160px] rounded-xl shadow-sm active:scale-95"
              >
                {isConfirming ? <Spinner size="sm" className="mr-2" /> : <Check className="w-4 h-4 mr-1.5" />}
                {isConfirming ? 'Menyimpan...' : 'Konfirmasi Diterima'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal 2: Dialog Pembatalan Pesanan */}
      <Dialog
        isOpen={!!cancelOrder}
        onClose={handleCloseCancelModal}
        title="Batalkan Pesanan"
        maxWidth="md"
      >
        {cancelOrder && (
          <div className="space-y-4 pt-2">
            {cancelOrder.paymentStatus === 'PAID' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-950 space-y-1 font-sans">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Invarian Finansial: Pesanan Sudah Berstatus Lunas</span>
                </div>
                <p className="leading-relaxed">
                  Pesanan ini telah dibayar senilai{' '}
                  <strong>{formatIDR(cancelOrder.totalAmount)}</strong>. Pembatalan akan menghentikan
                  proses dapur, namun penerimaan kas tetap tercatat di sistem pembukuan. Pengembalian uang
                  fisik dapat dicatat melalui tombol Refund Manual.
                </p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-brand block mb-1">
                Alasan Pembatalan <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Pelanggan buru-buru pergi / salah input menu"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                disabled={isCancelling}
                className="rounded-2xl border-outline-variant bg-surface-lowest p-3 font-sans"
              />
              <span className="text-[11px] text-brand/60 mt-1 block">
                Alasan akan tercatat permanen pada Audit Log sistem.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="md"
                onClick={() => setCancelOrder(null)}
                disabled={isCancelling}
                className="rounded-xl px-5 font-sans font-bold"
              >
                Kembali
              </Button>
              <Button
                variant="danger"
                size="md"
                onClick={handleCancelOrder}
                disabled={isCancelling || cancelReason.trim().length < 3}
                className="min-w-[140px] rounded-xl font-sans font-bold shadow-sm active:scale-95"
              >
                {isCancelling ? <Spinner size="sm" className="mr-2" /> : null}
                {isCancelling ? 'Membatalkan...' : 'Batalkan Pesanan'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* Modal 3: Dialog Catat Refund Manual */}
      <Dialog
        isOpen={!!refundOrder}
        onClose={handleCloseRefundModal}
        title="Pencatatan Refund Manual (Uang Fisik Kasir)"
        maxWidth="md"
      >
        {refundOrder && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 p-3 bg-surface-low rounded-xl border border-border text-xs">
              <div>
                <span className="text-brand/60 block">Nomor Order:</span>
                <span className="font-mono font-bold text-brand block">#{refundOrder.orderNumber}</span>
              </div>
              <div>
                <span className="text-brand/60 block">Total Transaksi:</span>
                <span className="font-bold text-brand block">{formatIDR(refundOrder.totalAmount)}</span>
              </div>
              <div>
                <span className="text-brand/60 block">Sudah Direfund:</span>
                <span className="font-bold text-red-600 block">{formatIDR(refundOrder.totalRefunded)}</span>
              </div>
              <div>
                <span className="text-brand/60 block">Maksimal Refund:</span>
                <span className="font-bold text-emerald-700 block">
                  {formatIDR(refundOrder.remainingRefundable)}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-brand block mb-1">
                Nominal Pengembalian Uang Fisik (Rp) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min={1}
                max={refundOrder.remainingRefundable}
                value={refundAmount || ''}
                onChange={(e) => setRefundAmount(parseInt(e.target.value, 10) || 0)}
                disabled={isRefunding}
              />
              <span className="text-[11px] text-brand/60 mt-1 block">
                Maksimal nominal pengembalian: {formatIDR(refundOrder.remainingRefundable)}
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-brand block mb-1">
                Alasan Pengembalian Dana <span className="text-red-500">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Pengembalian uang tunai langsung di meja kasir karena pesanan batal"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={2}
                disabled={isRefunding}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-brand block mb-1">
                Catatan Tambahan (Opsional)
              </label>
              <Input
                placeholder="Nama penerima atau keterangan saksi kasir"
                value={refundNotes}
                onChange={(e) => setRefundNotes(e.target.value)}
                disabled={isRefunding}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="md"
                onClick={() => setRefundOrder(null)}
                disabled={isRefunding}
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleRecordRefund}
                disabled={
                  isRefunding ||
                  refundAmount <= 0 ||
                  refundAmount > refundOrder.remainingRefundable ||
                  refundReason.trim().length < 3
                }
                className="bg-accent hover:bg-accent-hover text-white font-bold min-w-[160px]"
              >
                {isRefunding ? <Spinner size="sm" className="mr-2" /> : null}
                {isRefunding ? 'Menyimpan...' : 'Simpan Catatan Refund'}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}
