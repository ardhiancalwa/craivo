'use client'

import * as React from 'react'
import Link from 'next/link'
import { formatIDR } from '@/lib/utils'
import { formatWibDateTime, type ThermalPaperWidth } from '@/lib/receipt-formatter'

interface OrderReceiptClientProps {
  order: {
    id: string
    orderNumber: string
    table: {
      tableNumber: string
    }
    paymentMethod: string
    paymentStatus: string
    createdAt: Date | string
    paidAt?: Date | string | null
    customerNotes?: string | null
    subtotalAmount: number
    taxAmount: number
    serviceAmount: number
    totalAmount: number
    items: Array<{
      id: string
      nameSnapshot: string
      priceSnapshot: number
      quantity: number
      notes: string | null
      subtotal: number
      modifiers: Array<{
        id: string
        nameSnapshot: string
        priceSnapshot: number
      }>
    }>
  }
  initialReprintCount?: number
}

export function OrderReceiptClientView({
  order,
  initialReprintCount = 0,
}: OrderReceiptClientProps) {
  const [paper, setPaper] = React.useState<ThermalPaperWidth>('58mm')
  const [reprintCount, setReprintCount] = React.useState(initialReprintCount)
  const [isLoggingPrint, setIsLoggingPrint] = React.useState(false)

  const isPaid = order.paymentStatus === 'PAID'
  const isWaitingCashier = order.paymentStatus === 'WAITING_CASHIER'
  const isUnpaidQris = order.paymentStatus === 'UNPAID'
  const isCancelled = order.paymentStatus === 'CANCELLED'
  const isRefundReview = isCancelled && isPaid

  // Trigger print with atomic print log recording
  const handlePrint = async () => {
    if (isLoggingPrint) return
    setIsLoggingPrint(true)

    try {
      const res = await fetch(`/api/orders/${order.id}/print-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType: 'CUSTOMER_RECEIPT',
          format: paper === '80mm' ? 'THERMAL_80MM' : 'THERMAL_58MM',
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.data?.reprintCount !== undefined) {
          setReprintCount(data.data.reprintCount)
        }
      }
    } catch (err) {
      console.warn('Could not record print attempt to server:', err)
    } finally {
      setIsLoggingPrint(false)
      if (typeof window !== 'undefined') {
        window.print()
      }
    }
  }

  const isReprint = reprintCount > 0

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col justify-between pb-12 font-sans">
      {/* Top Controls (Hidden on Print) */}
      <div className="no-print space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <Link
            href={`/order/${order.id}/track`}
            className="text-xs text-brand/70 hover:text-brand font-medium flex items-center gap-1"
          >
            ← Kembali ke Status
          </Link>
          <span className="text-xs text-brand/50">Struk Transaksi SELA</span>
        </div>

        {/* Paper Width Selector */}
        <div className="flex items-center justify-between bg-surface p-2 rounded-xl border border-border text-xs">
          <span className="font-semibold text-brand/70 pl-1">Format Lebar Kertas:</span>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setPaper('58mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                paper === '58mm'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-cream-darker text-brand/70 hover:text-brand'
              }`}
            >
              58 mm (Standar)
            </button>
            <button
              type="button"
              onClick={() => setPaper('80mm')}
              className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                paper === '80mm'
                  ? 'bg-brand text-white shadow-xs'
                  : 'bg-cream-darker text-brand/70 hover:text-brand'
              }`}
            >
              80 mm (Lebar)
            </button>
          </div>
        </div>

        {/* Financial Status Alert Banner */}
        {isWaitingCashier && (
          <div className="bg-amber-50 border-2 border-amber-300 p-3 rounded-xl text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800">
              <span>⚠️</span>
              <span>BELUM DIBAYAR — MENUNGGU KASIR</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Silakan sebutkan <strong>Meja {order.table.tableNumber}</strong> di meja kasir untuk membayar tunai.
              Dokumen ini <strong>bukan</strong> merupakan bukti pelunasan yang sah.
            </p>
          </div>
        )}

        {isUnpaidQris && (
          <div className="bg-orange-50 border border-orange-300 p-3 rounded-xl text-xs text-orange-900 flex items-center justify-between">
            <div>
              <p className="font-bold">Belum Dibayar (QRIS)</p>
              <p className="text-[11px] text-orange-800">Selesaikan pembayaran QRIS Anda.</p>
            </div>
            <Link
              href={`/order/${order.id}/pay`}
              className="px-3 py-1.5 bg-accent text-white font-bold rounded-lg text-xs hover:bg-accent/90"
            >
              Bayar Sekarang
            </Link>
          </div>
        )}

        {isRefundReview && (
          <div className="bg-blue-50 border border-blue-300 p-3 rounded-xl text-xs text-blue-900 space-y-1">
            <p className="font-bold">Pesanan Dibatalkan (Dana Masuk Tercatat)</p>
            <p className="text-[11px]">
              Silakan temui staf kasir untuk penyerahan pengembalian uang tunai fisik.
            </p>
          </div>
        )}
      </div>

      {/* Printable Receipt Container */}
      <div
        className={`bg-white text-black p-5 sm:p-6 rounded-2xl border border-black/20 shadow-xs text-left mx-auto print:shadow-none print:border-none print:p-0 print:m-0 print:w-full ${
          paper === '80mm' ? 'max-w-[80mm] w-full text-[12px]' : 'max-w-[58mm] w-full text-[11px]'
        }`}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
          lineHeight: '1.25',
        }}
      >
        {/* Reprint Header Watermark */}
        {isReprint && (
          <div className="text-center font-bold pb-2 mb-2 border-b-2 border-dashed border-black">
            <p className="text-[11px] uppercase tracking-wider">*** CETAK ULANG (REPRINT) ***</p>
            <p className="text-[9px] font-normal">Dicetak ulang ke-{reprintCount + 1}</p>
          </div>
        )}

        {/* Store Header */}
        <div className="text-center space-y-0.5">
          <h1 className="font-bold text-base tracking-widest">SELA</h1>
          <p className="text-[10px] uppercase tracking-wider font-semibold">Artisanal Coffee &amp; Bake</p>
          <p className="text-[9px]">Jl. Senopati No. 42, Jakarta</p>
        </div>

        {/* Divider */}
        <div className="my-2.5 border-b border-black border-dashed" />

        {/* Metadata */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>No. Order:</span>
            <span className="font-bold">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Nomor Meja:</span>
            <span className="font-bold">MEJA {order.table.tableNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Waktu:</span>
            <span className="text-[10px]">{formatWibDateTime(order.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Metode:</span>
            <span>{order.paymentMethod === 'QRIS' ? 'QRIS DINAMIS' : 'TUNAI (CASH)'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Status:</span>
            <span className={`font-bold ${isPaid ? 'text-black' : 'text-black underline'}`}>
              {isPaid
                ? 'LUNAS (PAID)'
                : isWaitingCashier
                  ? 'BELUM LUNAS'
                  : order.paymentStatus}
            </span>
          </div>
          {isPaid && order.paidAt && (
            <div className="flex justify-between text-[10px]">
              <span>Lunas pada:</span>
              <span>{formatWibDateTime(order.paidAt)}</span>
            </div>
          )}
        </div>

        {/* Customer Global Notes */}
        {order.customerNotes && (
          <div className="my-2 p-1.5 border border-dashed border-black text-[10px] italic">
            Catatan: &ldquo;{order.customerNotes}&rdquo;
          </div>
        )}

        {/* Divider */}
        <div className="my-2.5 border-b border-black border-dashed" />

        {/* Items List */}
        <div className="space-y-2">
          <div className="flex justify-between font-bold text-[10px] border-b border-black/40 pb-1">
            <span>QTY  ITEM</span>
            <span>TOTAL</span>
          </div>

          {order.items.map((it) => (
            <div key={it.id} className="space-y-0.5">
              <div className="flex justify-between items-start gap-1">
                <span className="font-medium break-words flex-1">
                  {it.quantity}x {it.nameSnapshot}
                </span>
                <span className="whitespace-nowrap tabular-nums font-semibold shrink-0">
                  {formatIDR(it.subtotal).replace('Rp', '')}
                </span>
              </div>

              {it.modifiers && it.modifiers.length > 0 && (
                <div className="pl-4 text-[10px] space-y-0.5">
                  {it.modifiers.map((m) => (
                    <div key={m.id}>+ {m.nameSnapshot}</div>
                  ))}
                </div>
              )}

              {it.notes && (
                <div className="pl-4 text-[10px] italic">
                  * &ldquo;{it.notes}&rdquo;
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="my-2.5 border-b border-black border-dashed" />

        {/* Totals */}
        <div className="space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="tabular-nums">{formatIDR(order.subtotalAmount).replace('Rp', '')}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Pajak (PB1 0%)</span>
            <span className="tabular-nums">{formatIDR(order.taxAmount).replace('Rp', '')}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Biaya Layanan (0%)</span>
            <span className="tabular-nums">{formatIDR(order.serviceAmount).replace('Rp', '')}</span>
          </div>
          <div className="border-t border-dashed border-black pt-1.5 flex justify-between font-bold text-[13px]">
            <span>TOTAL AKHIR</span>
            <span className="tabular-nums">{formatIDR(order.totalAmount).replace('Rp', '')}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="my-3 border-b-2 border-black border-dashed" />

        {/* Footer */}
        <div className="text-center text-[10px] space-y-1">
          {isWaitingCashier ? (
            <div className="font-bold leading-tight">
              <p>*** BUKAN BUKTI LUNAS ***</p>
              <p className="font-normal mt-0.5">Harap lakukan pembayaran di kasir</p>
            </div>
          ) : isPaid ? (
            <div>
              <p className="font-bold">*** SIMPAN SEBAGAI BUKTI BAYAR ***</p>
              <p className="mt-0.5">Terima kasih atas kunjungan Anda!</p>
            </div>
          ) : (
            <p>Terima kasih atas kunjungan Anda!</p>
          )}
        </div>
      </div>

      {/* Action Buttons (Hidden on Print) */}
      <div className="no-print pt-6 space-y-2.5">
        <button
          type="button"
          onClick={handlePrint}
          disabled={isLoggingPrint}
          className="touch-target w-full py-3 rounded-xl bg-accent text-white text-xs font-bold hover:bg-accent/90 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
        >
          <span>🖨️</span>
          <span>{isLoggingPrint ? 'Menyiapkan Cetak...' : 'Cetak / Simpan PDF'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={`/api/orders/${order.id}/receipt/download?format=txt&paper=${paper}&type=customer`}
            download
            className="touch-target py-2 rounded-xl border border-border bg-surface text-brand text-xs font-semibold hover:bg-cream transition-colors flex items-center justify-center gap-1.5 shadow-xs text-center"
          >
            <span>📄</span>
            <span>Unduh (.txt)</span>
          </a>

          <a
            href={`/api/orders/${order.id}/receipt/download?format=html&paper=${paper}&type=customer`}
            download
            className="touch-target py-2 rounded-xl border border-border bg-surface text-brand text-xs font-semibold hover:bg-cream transition-colors flex items-center justify-center gap-1.5 shadow-xs text-center"
          >
            <span>🌐</span>
            <span>Unduh (.html)</span>
          </a>
        </div>

        <Link
          href={`/order/${order.id}/track`}
          className="touch-target w-full inline-flex items-center justify-center py-2 text-xs text-brand/70 hover:text-brand font-medium"
        >
          ← Kembali ke Status Pesanan
        </Link>
      </div>
    </main>
  )
}
