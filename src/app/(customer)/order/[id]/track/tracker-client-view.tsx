'use client'

import * as React from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ui/toast'
import { audioAlert } from '@/lib/audio-alert'
import { useRealtimeStream, type StreamConnectionStatus } from '@/lib/hooks/use-realtime-stream'
import { formatIDR, cn } from '@/lib/utils'

export interface TrackerItemModifier {
  id: string
  nameSnapshot: string
  priceSnapshot: number
}

export interface TrackerOrderItem {
  id: string
  nameSnapshot: string
  priceSnapshot: number
  quantity: number
  subtotal: number
  notes: string | null
  modifiers: TrackerItemModifier[]
}

export interface TrackerOrder {
  id: string
  orderNumber: string
  table: {
    id: string
    tableNumber: string
  }
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  customerNotes: string | null
  items: TrackerOrderItem[]
}

interface TrackerClientViewProps {
  initialOrder: TrackerOrder
}

export function TrackerClientView({ initialOrder }: TrackerClientViewProps) {
  const { showToast } = useToast()
  const [order, setOrder] = React.useState<TrackerOrder>(initialOrder)
  const [isManualSyncing, setIsManualSyncing] = React.useState(false)

  // Re-sync snapshot ketika reconnect atau ditekan manual
  const syncLatestOrder = React.useCallback(async (silent = true) => {
    if (!silent) setIsManualSyncing(true)
    try {
      const res = await fetch(`/api/orders/${order.id}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.data) {
        setOrder((prev) => ({
          ...prev,
          orderStatus: json.data.orderStatus,
          paymentStatus: json.data.paymentStatus,
          items: json.data.items || prev.items,
        }))
        if (!silent) {
          showToast('Status pesanan berhasil disinkronkan.', 'info')
        }
      }
    } catch (err) {
      console.warn('Gagal sinkronisasi data pesanan:', err)
      if (!silent) {
        showToast('Gagal menyinkronkan status pesanan. Coba lagi sebentar.', 'error')
      }
    } finally {
      if (!silent) setIsManualSyncing(false)
    }
  }, [order.id, showToast])

  // Handle SSE Realtime Events
  const handleRealtimeEvent = React.useCallback(
    (eventType: string, data: Record<string, unknown>) => {
      if (eventType === 'PAYMENT_CONFIRMED') {
        setOrder((prev) => ({ ...prev, paymentStatus: 'PAID' }))
        audioAlert.playChime()
        showToast('Pembayaran berhasil dikonfirmasi! Pesanan Anda diteruskan ke dapur kafe.', 'success')
      } else if (eventType === 'ORDER_STATUS_CHANGED') {
        const newStatus = String(data.newStatus || data.orderStatus || '')
        setOrder((prev) => ({ ...prev, orderStatus: newStatus }))

        if (newStatus === 'COOKING') {
          showToast('Dapur & barista sedang menyiapkan pesanan Anda.', 'info')
        } else if (newStatus === 'READY') {
          audioAlert.playChime()
          showToast(`Pesanan #${order.orderNumber} telah siap disajikan ke Meja ${order.table.tableNumber}!`, 'success')
        } else if (newStatus === 'COMPLETED') {
          showToast('Pesanan telah selesai disajikan. Selamat menikmati!', 'success')
        }
      } else if (eventType === 'ORDER_CANCELLED') {
        const reason = String(data.reason || 'Dibatalkan oleh pihak restoran/kasir.')
        setOrder((prev) => ({ ...prev, orderStatus: 'CANCELLED' }))
        showToast(`Pesanan dibatalkan: ${reason}`, 'error')
      }
    },
    [order.orderNumber, order.table.tableNumber, showToast]
  )

  // Hook Realtime SSE
  const { connectionStatus } = useRealtimeStream({
    url: `/api/orders/${order.id}/stream`,
    onEvent: handleRealtimeEvent,
    onReconnectSync: () => syncLatestOrder(true),
    fallbackPollIntervalMs: 12000,
  })

  const isPaid = order.paymentStatus === 'PAID'
  const isWaitingCashier = order.paymentStatus === 'WAITING_CASHIER'
  const isExpired = order.paymentStatus === 'EXPIRED'
  const isUnpaid = order.paymentStatus === 'UNPAID'
  const isCancelled = order.orderStatus === 'CANCELLED'
  const isRefundReview = isCancelled && isPaid

  // Status Pembayaran Helpers
  const renderPaymentCard = () => {
    if (isPaid && !isCancelled) {
      return (
        <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-emerald-950 space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-emerald-800">
              Status Pembayaran
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
              ✓ Lunas (PAID)
            </span>
          </div>
          <div className="flex justify-between items-baseline pt-1">
            <span className="text-xs text-emerald-900/80">Metode: {order.paymentMethod === 'CASH' ? 'Tunai di Kasir' : 'QRIS Dinamis'}</span>
            <span className="font-price-tabular font-bold text-sm text-emerald-950">{formatIDR(order.totalAmount)}</span>
          </div>
        </div>
      )
    }

    if (isWaitingCashier) {
      return (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-amber-800">
              Status Pembayaran
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
              Menunggu Kasir
            </span>
          </div>
          <p className="text-xs leading-relaxed text-amber-900">
            Silakan menuju meja kasir dan tunjukkan nomor pesanan <strong>#{order.orderNumber}</strong> untuk menyelesaikan pembayaran tunai fisik sebesar <strong className="font-price-tabular">{formatIDR(order.totalAmount)}</strong>.
          </p>
        </div>
      )
    }

    if (isExpired) {
      return (
        <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-red-800">
              Status Pembayaran
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300">
              Kedaluwarsa
            </span>
          </div>
          <p className="text-xs leading-relaxed text-red-900">
            Batas waktu pembayaran QRIS (15 menit) telah habis. Pesanan ini tidak diproses oleh dapur. Silakan buat pesanan baru dari menu.
          </p>
        </div>
      )
    }

    if (isUnpaid && !isCancelled) {
      return (
        <div className="p-4 rounded-2xl bg-yellow-50 border border-yellow-200 text-yellow-950 space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-bold tracking-wider text-yellow-800">
              Status Pembayaran
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-900 border border-yellow-300">
              Belum Lunas
            </span>
          </div>
          <p className="text-xs leading-relaxed text-yellow-900">
            Menunggu penyelesaian pembayaran QRIS sebesar <strong className="font-price-tabular">{formatIDR(order.totalAmount)}</strong>. Pesanan akan otomatis masuk antrean dapur begitu pembayaran diverifikasi.
          </p>
          <Link
            href={`/order/${order.id}/pay`}
            className="touch-target inline-flex items-center justify-center w-full py-2.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors shadow-sm"
          >
            Buka Layar Pembayaran QRIS &rarr;
          </Link>
        </div>
      )
    }

    return null
  }

  const renderConnectionBadge = (status: StreamConnectionStatus) => {
    switch (status) {
      case 'CONNECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live SSE (&le; 2s)</span>
          </span>
        )
      case 'CONNECTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>Menyambungkan...</span>
          </span>
        )
      case 'DEGRADED_POLLING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-50 text-orange-800 border border-orange-200">
            <span>⚠️ Mode Polling</span>
          </span>
        )
      case 'STALE':
      case 'OFFLINE':
      default:
        return (
          <button
            onClick={() => syncLatestOrder(false)}
            disabled={isManualSyncing}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 cursor-pointer hover:bg-red-100"
            title="Klik untuk menyinkronkan status"
          >
            <span>Terputus (Cek Status)</span>
          </button>
        )
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col justify-between pb-12">
      <div className="space-y-5">
        {/* Header Meja & Koneksi */}
        <header className="py-3 border-b border-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs uppercase tracking-wider text-olive font-semibold">
                Pelacak Meja {order.table.tableNumber}
              </span>
              {renderConnectionBadge(connectionStatus)}
            </div>
            <h1 className="text-2xl font-sans font-bold text-brand">
              #{order.orderNumber}
            </h1>
          </div>
          <button
            onClick={() => syncLatestOrder(false)}
            disabled={isManualSyncing}
            className="text-xs text-brand/60 hover:text-brand px-2 py-1 rounded-md border border-border/80 cursor-pointer"
            title="Perbarui status secara manual"
          >
            {isManualSyncing ? '...' : '↻ Segarkan'}
          </button>
        </header>

        {/* Kartu 1: Status Pembayaran Terpisah */}
        {renderPaymentCard()}

        {/* Kartu 2: Status Dapur & Fulfillment */}
        {isRefundReview ? (
          /* Khusus Refund Review: Pesanan Lunas tapi Dibatalkan Kasir */
          <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 text-xs space-y-2 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-base">⚠️</span>
              <strong className="font-bold text-sm text-amber-900">
                Pesanan Dibatalkan — Menunggu Pengembalian Dana Kasir
              </strong>
            </div>
            <p className="leading-relaxed text-amber-900">
              Pesanan ini telah dibatalkan oleh kasir setelah pembayaran lunas diverifikasi.
            </p>
            <div className="p-2.5 rounded-xl bg-amber-100/80 border border-amber-300 text-amber-950 font-medium">
              Silakan temui kasir dan tunjukkan nomor pesanan <strong>#{order.orderNumber}</strong> untuk menerima pengembalian uang fisik (*manual cash refund*) sebesar <strong className="font-price-tabular">{formatIDR(order.totalAmount)}</strong>.
            </div>
          </div>
        ) : isCancelled ? (
          /* Pembatalan Pesanan Belum Lunas */
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 text-xs space-y-1.5 shadow-xs">
            <strong className="block font-semibold text-sm">Pesanan Dibatalkan</strong>
            <p className="leading-relaxed">
              Pesanan ini telah dibatalkan sebelum pembayaran selesai. Dapur tidak memproses menu ini.
            </p>
          </div>
        ) : (
          /* Alur Normal Progres Dapur (4 Langkah) */
          <div className="p-4 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
            <h2 className="text-xs uppercase font-bold tracking-wider text-brand/70 border-b border-border/60 pb-2">
              Progres Masak Dapur & Barista
            </h2>

            <div className="space-y-4">
              {/* Step 1: Pesanan Diterima di Dapur */}
              <div className={cn('flex items-center gap-3.5 transition-opacity', isPaid ? 'opacity-100' : 'opacity-40')}>
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-colors',
                    isPaid ? 'bg-accent text-white' : 'bg-border text-brand/50'
                  )}
                >
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand">Pesanan Diterima</h3>
                  <p className="text-xs text-brand/60">
                    {isPaid ? 'Pembayaran lunas & tiket terdaftar di KDS Dapur' : 'Menunggu verifikasi pembayaran'}
                  </p>
                </div>
              </div>

              {/* Step 2: Dapur Sedang Meracik */}
              <div
                className={cn(
                  'flex items-center gap-3.5 transition-opacity',
                  order.orderStatus === 'COOKING' ||
                    order.orderStatus === 'READY' ||
                    order.orderStatus === 'COMPLETED'
                    ? 'opacity-100'
                    : 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all',
                    order.orderStatus === 'COOKING'
                      ? 'bg-brand text-cream animate-pulse shadow-md ring-2 ring-brand/30'
                      : order.orderStatus === 'READY' || order.orderStatus === 'COMPLETED'
                        ? 'bg-accent text-white'
                        : 'bg-border text-brand/50'
                  )}
                >
                  2
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand">Sedang Disiapkan</h3>
                  <p className="text-xs text-brand/60">
                    {order.orderStatus === 'COOKING'
                      ? 'Barista & koki sedang meracik menu Anda sekarang'
                      : 'Menunggu giliran disiapkan di dapur'}
                  </p>
                </div>
              </div>

              {/* Step 3: Siap Disajikan */}
              <div
                className={cn(
                  'flex items-center gap-3.5 transition-opacity',
                  order.orderStatus === 'READY' || order.orderStatus === 'COMPLETED'
                    ? 'opacity-100'
                    : 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all',
                    order.orderStatus === 'READY'
                      ? 'bg-emerald-600 text-white animate-bounce shadow-md'
                      : order.orderStatus === 'COMPLETED'
                        ? 'bg-accent text-white'
                        : 'bg-border text-brand/50'
                  )}
                >
                  3
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand">Siap Disajikan</h3>
                  <p className="text-xs text-brand/60">
                    {order.orderStatus === 'READY'
                      ? `Pesanan siap! Staf sedang mengantar ke Meja ${order.table.tableNumber}`
                      : `Akan diantar ke Meja ${order.table.tableNumber}`}
                  </p>
                </div>
              </div>

              {/* Step 4: Selesai */}
              <div
                className={cn(
                  'flex items-center gap-3.5 transition-opacity',
                  order.orderStatus === 'COMPLETED' ? 'opacity-100' : 'opacity-40'
                )}
              >
                <span
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 transition-all',
                    order.orderStatus === 'COMPLETED'
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-border text-brand/50'
                  )}
                >
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-brand">Selesai</h3>
                  <p className="text-xs text-brand/60">
                    {order.orderStatus === 'COMPLETED'
                      ? 'Pesanan telah selesai disajikan. Selamat menikmati!'
                      : 'Menikmati sajian di meja'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Kartu 3: Ringkasan Snapshot Menu */}
        <section className="text-left border border-border rounded-2xl p-4 bg-surface space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-border/60 pb-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-brand/70">
              Rincian Menu Dipesan
            </h2>
            <span className="text-xs font-price-tabular font-bold text-accent">
              Total {formatIDR(order.totalAmount)}
            </span>
          </div>

          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="text-xs space-y-0.5 border-b border-border/30 pb-2 last:border-0 last:pb-0">
                <div className="flex justify-between font-medium text-brand">
                  <span>
                    {it.quantity}x {it.nameSnapshot}
                  </span>
                  <span className="font-price-tabular font-semibold">{formatIDR(it.subtotal)}</span>
                </div>
                {it.modifiers && it.modifiers.length > 0 && (
                  <p className="text-[11px] text-olive pl-3">
                    {it.modifiers.map((m) => m.nameSnapshot).join(', ')}
                  </p>
                )}
                {it.notes && (
                  <p className="text-[11px] italic text-brand/60 pl-3">
                    &ldquo;{it.notes}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Footer Navigasi */}
      <div className="pt-6 border-t border-border space-y-2.5 mt-8">
        {isUnpaid && !isCancelled && !isExpired && (
          <Link
            href={`/order/${order.id}/pay`}
            className="touch-target w-full inline-flex items-center justify-center py-3.5 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 transition-colors shadow-sm"
          >
            Lanjutkan Pembayaran QRIS &rarr;
          </Link>
        )}
        <Link
          href={`/order/${order.id}/receipt`}
          className="touch-target w-full inline-flex items-center justify-center py-2.5 rounded-xl border border-border text-xs font-semibold text-brand hover:bg-cream-darker transition-colors"
        >
          Lihat Struk Digital Pesanan
        </Link>
        <Link
          href="/order/menu"
          className="touch-target w-full inline-flex items-center justify-center py-2 text-xs text-brand/60 hover:text-brand transition-colors"
        >
          &larr; Kembali ke Daftar Menu
        </Link>
      </div>
    </main>
  )
}
