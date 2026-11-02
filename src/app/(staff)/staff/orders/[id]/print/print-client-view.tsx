'use client'

import * as React from 'react'
import Link from 'next/link'
import { formatIDR } from '@/lib/utils'
import {
  formatWibDateTime,
  type ThermalPaperWidth,
  type ReceiptDocumentType,
} from '@/lib/receipt-formatter'
import type { StaffJWTPayload } from '@/lib/server/auth'

interface StaffPrintClientProps {
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
  staffUser: StaffJWTPayload | null
  initialType?: ReceiptDocumentType
  initialPaper?: ThermalPaperWidth
  initialCashierReprintCount?: number
  initialKitchenReprintCount?: number
  autoPrint?: boolean
}

export function StaffPrintClientView({
  order,
  staffUser,
  initialType = 'cashier',
  initialPaper = '58mm',
  initialCashierReprintCount = 0,
  initialKitchenReprintCount = 0,
  autoPrint = false,
}: StaffPrintClientProps) {
  const [docType, setDocType] = React.useState<ReceiptDocumentType>(initialType)
  const [paper, setPaper] = React.useState<ThermalPaperWidth>(initialPaper)
  const [cashierReprintCount, setCashierReprintCount] = React.useState(initialCashierReprintCount)
  const [kitchenReprintCount, setKitchenReprintCount] = React.useState(initialKitchenReprintCount)
  const [isPrinting, setIsPrinting] = React.useState(false)

  const isKitchen = docType === 'kitchen'
  const isPaid = order.paymentStatus === 'PAID'
  const currentReprintCount = isKitchen ? kitchenReprintCount : cashierReprintCount
  const isReprint = currentReprintCount > 0

  // Trigger Print Handler
  const handlePrint = React.useCallback(async () => {
    if (isPrinting) return
    setIsPrinting(true)

    const documentTypeEnum = isKitchen ? 'KITCHEN_TICKET' : 'CASHIER_RECEIPT'
    const formatEnum = paper === '80mm' ? 'THERMAL_80MM' : 'THERMAL_58MM'

    try {
      const res = await fetch(`/api/orders/${order.id}/print-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentType: documentTypeEnum,
          format: formatEnum,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.data?.reprintCount !== undefined) {
          if (isKitchen) {
            setKitchenReprintCount(data.data.reprintCount)
          } else {
            setCashierReprintCount(data.data.reprintCount)
          }
        }
      }
    } catch (err) {
      console.warn('Could not record staff print attempt:', err)
    } finally {
      setIsPrinting(false)
      if (typeof window !== 'undefined') {
        window.print()
      }
    }
  }, [isPrinting, isKitchen, paper, order.id])

  // Auto-print effect on mount if requested
  const autoPrintedRef = React.useRef(false)
  React.useEffect(() => {
    if (autoPrint && !autoPrintedRef.current) {
      autoPrintedRef.current = true
      const timer = setTimeout(() => {
        handlePrint()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [autoPrint, handlePrint])

  const backUrl = staffUser?.role === 'BARISTA' ? '/kitchen' : '/staff/pos'

  return (
    <main className="min-h-screen bg-cream-darker p-4 md:p-8 font-sans">
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header Controls (Hidden on Print) */}
        <div className="no-print bg-surface p-4 rounded-2xl border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <Link
              href={backUrl}
              className="text-xs font-bold text-brand/70 hover:text-brand flex items-center gap-1"
            >
              ← Kembali ke Dashboard
            </Link>
            <span className="text-xs font-semibold px-2.5 py-1 bg-cream-darker rounded-lg text-brand">
              Staf: {staffUser?.displayName || staffUser?.username} ({staffUser?.role})
            </span>
          </div>

          {/* Document & Paper Switchers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border">
            {/* Document Type Switch */}
            <div>
              <label className="text-[11px] font-bold text-brand/70 block mb-1">Jenis Dokumen:</label>
              <div className="grid grid-cols-2 gap-1 bg-cream-darker p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDocType('cashier')}
                  disabled={staffUser?.role === 'BARISTA'}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-40 ${
                    docType === 'cashier' ? 'bg-brand text-white shadow-xs' : 'text-brand/70 hover:text-brand'
                  }`}
                >
                  🧾 Struk Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setDocType('kitchen')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    docType === 'kitchen' ? 'bg-brand text-white shadow-xs' : 'text-brand/70 hover:text-brand'
                  }`}
                >
                  🍳 Tiket Dapur
                </button>
              </div>
            </div>

            {/* Paper Width Switch */}
            <div>
              <label className="text-[11px] font-bold text-brand/70 block mb-1">Lebar Thermal:</label>
              <div className="grid grid-cols-2 gap-1 bg-cream-darker p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setPaper('58mm')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paper === '58mm' ? 'bg-brand text-white shadow-xs' : 'text-brand/70 hover:text-brand'
                  }`}
                >
                  58 mm
                </button>
                <button
                  type="button"
                  onClick={() => setPaper('80mm')}
                  className={`py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    paper === '80mm' ? 'bg-brand text-white shadow-xs' : 'text-brand/70 hover:text-brand'
                  }`}
                >
                  80 mm
                </button>
              </div>
            </div>
          </div>

          {/* Action Trigger Buttons */}
          <div className="pt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex-1 py-3 px-4 bg-accent hover:bg-accent/90 active:scale-98 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>🖨️</span>
              <span>{isPrinting ? 'Menyiapkan Cetak...' : 'Cetak Dokumen Sekarang'}</span>
            </button>

            <a
              href={`/api/orders/${order.id}/receipt/download?format=txt&paper=${paper}&type=${docType}`}
              download
              className="py-3 px-4 bg-surface border border-border text-brand text-xs font-bold rounded-xl hover:bg-cream transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <span>📄</span>
              <span>Unduh .txt</span>
            </a>
          </div>

          {/* Status Note */}
          <p className="text-[10px] text-brand/50 leading-tight">
            * Browser mencatat upaya cetak (print attempt). Dialog sistem operasi akan terbuka untuk memilih printer thermal atau Save as PDF.
          </p>
        </div>

        {/* Printable Preview Sheet */}
        <div className="flex justify-center">
          <div
            className={`bg-white text-black p-5 sm:p-6 rounded-2xl border border-black/20 shadow-md text-left print:shadow-none print:border-none print:p-0 print:m-0 print:w-full ${
              paper === '80mm' ? 'max-w-[80mm] w-full text-[12px]' : 'max-w-[58mm] w-full text-[11px]'
            }`}
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace',
              lineHeight: '1.25',
            }}
          >
            {/* Reprint Watermark */}
            {isReprint && (
              <div className="text-center font-bold pb-2 mb-2 border-b-2 border-dashed border-black">
                <p className="text-[11px] uppercase tracking-wider">
                  *** CETAK ULANG ({isKitchen ? 'TIKET DAPUR' : 'STRUK KASIR'}) ***
                </p>
                <p className="text-[9px] font-normal">Dicetak ulang ke-{currentReprintCount + 1}</p>
              </div>
            )}

            {/* Document Header */}
            {isKitchen ? (
              // KITCHEN TICKET HEADER
              <div className="text-center space-y-0.5">
                <p className="font-bold text-xs">[ TIKET DAPUR / BARISTA ]</p>
                <div className="my-2 border-b border-black border-dashed" />
                <h1 className="font-black text-xl tracking-wider py-1 bg-black text-white rounded-md">
                  MEJA {order.table.tableNumber}
                </h1>
                <div className="my-2 border-b border-black border-dashed" />
                <div className="text-left text-[11px] space-y-0.5">
                  <p><strong>No. Order :</strong> {order.orderNumber}</p>
                  <p><strong>Waktu     :</strong> {formatWibDateTime(order.createdAt)}</p>
                  {order.customerNotes && (
                    <div className="mt-1 p-1 border border-black border-dashed text-[10px] italic">
                      Catatan: &ldquo;{order.customerNotes}&rdquo;
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // CASHIER RECEIPT HEADER
              <div className="text-center space-y-0.5">
                <h1 className="font-bold text-base tracking-widest">SELA</h1>
                <p className="text-[10px] uppercase tracking-wider font-semibold">Artisanal Coffee &amp; Bake</p>
                <p className="text-[9px]">Jl. Senopati No. 42, Jakarta</p>
                <div className="my-2 border-b border-black border-dashed" />
                <div className="text-left text-[11px] space-y-0.5">
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
                    <span>Kasir:</span>
                    <span>{staffUser?.displayName || 'Kasir POS'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Metode:</span>
                    <span>{order.paymentMethod === 'QRIS' ? 'QRIS DINAMIS' : 'TUNAI (CASH)'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Status:</span>
                    <span className="font-bold">{isPaid ? 'LUNAS (PAID)' : order.paymentStatus}</span>
                  </div>
                  {isPaid && order.paidAt && (
                    <div className="flex justify-between text-[10px]">
                      <span>Lunas pada:</span>
                      <span>{formatWibDateTime(order.paidAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Divider */}
            <div className="my-2.5 border-b border-black border-dashed" />

            {/* Items Listing */}
            {isKitchen ? (
              // KITCHEN ITEMS: MUTLAK TANPA HARGA/RUPIAH
              <div className="space-y-3">
                <div className="font-bold text-[10px] border-b border-black/40 pb-0.5">
                  QTY  PESANAN
                </div>

                {order.items.map((it) => (
                  <div key={it.id} className="space-y-0.5 border-b border-black/20 pb-1.5 last:border-0">
                    <div className="font-bold text-sm leading-tight flex items-start gap-1">
                      <span className="underline shrink-0">{it.quantity}x</span>
                      <span className="break-words">{it.nameSnapshot}</span>
                    </div>

                    {it.modifiers && it.modifiers.length > 0 && (
                      <div className="pl-4 text-[11px] font-semibold space-y-0.5">
                        {it.modifiers.map((m) => (
                          <div key={m.id}>[+] {m.nameSnapshot}</div>
                        ))}
                      </div>
                    )}

                    {it.notes && (
                      <div className="pl-4 text-[10px] italic font-medium">
                        * &ldquo;{it.notes}&rdquo;
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              // CASHIER ITEMS: SNAPSHOT LENGKAP HARGA
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
            )}

            {/* Divider */}
            <div className="my-2.5 border-b border-black border-dashed" />

            {/* Totals Section: HANYA untuk CASHIER RECEIPT */}
            {!isKitchen && (
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
                <div className="my-3 border-b-2 border-black border-dashed" />
              </div>
            )}

            {/* Footer */}
            <div className="text-center text-[10px]">
              {isKitchen ? (
                <p className="font-bold">SELA KITCHEN ORDER SLIP</p>
              ) : (
                <p>Terima kasih atas kunjungan Anda!</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

