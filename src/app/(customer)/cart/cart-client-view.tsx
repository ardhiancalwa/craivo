'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { formatIDR } from '@/lib/utils'
import { useCart, type CartItem } from '@/lib/cart-context'
import { useToast } from '@/components/ui/toast'
import { ProductModifierSheet } from '@/components/menu/product-modifier-sheet'
import type { CatalogMenuItem } from '@/lib/server/menu-service'
import {
  computeClientFingerprint,
  getOrCreateCheckoutIntent,
  clearCheckoutIntent,
  saveOrderCapabilityToken,
} from '@/lib/checkout-intent'

interface CartClientViewProps {
  tableNumber: string
}

export function CartClientView({ tableNumber }: CartClientViewProps) {
  const router = useRouter()
  const {
    items,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    activeQuote,
    setActiveQuote,
  } = useCart()
  const { showToast } = useToast()

  // State: Payment method & Catatan umum
  const [paymentMethod, setPaymentMethod] = React.useState<'QRIS' | 'CASH' | 'MANUAL_QRIS' | 'MANUAL_TRANSFER'>('QRIS')
  const [availableMethods, setAvailableMethods] = React.useState({
    enableMidtransQris: true,
    enableCash: true,
    enableManualQris: false,
    manualQrisName: 'QRIS Kafe',
    enableManualTransfer: false,
    manualTransferBank: 'BCA',
  })
  const [customerNotes, setCustomerNotes] = React.useState('')

  // State: Catalog items cache for editing modifier options
  const [catalogItems, setCatalogItems] = React.useState<CatalogMenuItem[]>([])
  const [editingItem, setEditingItem] = React.useState<CartItem | null>(null)
  const [editingCatalogItem, setEditingCatalogItem] = React.useState<CatalogMenuItem | null>(null)
  const [isModifierSheetOpen, setIsModifierSheetOpen] = React.useState(false)

  // State: Checkout submission
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [priceChangeInfo, setPriceChangeInfo] = React.useState<{
    previousTotal: number
    updatedTotal: number
    message: string
  } | null>(null)

  // Fetch public payment methods config on mount
  React.useEffect(() => {
    let isMounted = true
    async function loadPaymentMethods() {
      try {
        const res = await fetch('/api/config/payment-methods')
        const json = await res.json()
        if (isMounted && json.success && json.data) {
          setAvailableMethods(json.data)
          // Set default payment method based on available
          if (json.data.enableMidtransQris) {
            setPaymentMethod('QRIS')
          } else if (json.data.enableManualQris) {
            setPaymentMethod('MANUAL_QRIS')
          } else if (json.data.enableCash) {
            setPaymentMethod('CASH')
          } else if (json.data.enableManualTransfer) {
            setPaymentMethod('MANUAL_TRANSFER')
          }
        }
      } catch {
        // Fallback to default
      }
    }
    loadPaymentMethods()
    return () => {
      isMounted = false
    }
  }, [])

  // Fetch catalog on mount for modifier definitions
  React.useEffect(() => {
    let isMounted = true
    async function loadCatalog() {
      try {
        const res = await fetch('/api/menu')
        const data = await res.json()
        if (isMounted && data.success && data.data?.items) {
          setCatalogItems(data.data.items)
        }
      } catch {
        // Ignore background fetch failure
      }
    }
    loadCatalog()
    return () => {
      isMounted = false
    }
  }, [])

  // Handle open modifier edit sheet
  const handleEditModifiers = (cartItem: CartItem) => {
    const catalogItem = catalogItems.find((it) => it.id === cartItem.menuItemId)
    if (catalogItem) {
      setEditingCatalogItem(catalogItem)
      setEditingItem(cartItem)
      setIsModifierSheetOpen(true)
    } else {
      showToast('Sedang memuat data varian menu, silakan coba sesaat lagi.', 'info')
    }
  }

  // Handle Order Checkout (Quote validation -> Idempotent POST /api/orders)
  const handleCheckout = async (bypassPriceChange = false) => {
    if (!tableNumber || tableNumber.trim() === '') {
      showToast('Nomor meja belum terdeteksi. Silakan pindai ulang QR resmi di meja Anda.', 'error')
      return
    }

    if (items.length === 0) {
      showToast('Keranjang belanja Anda masih kosong.', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Ambil atau Perbarui Quote Resmi dari Server
      let quote = activeQuote
      if (!quote || bypassPriceChange) {
        const quoteRes = await fetch('/api/orders/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tableNumber,
            items: items.map((it) => ({
              menuItemId: it.menuItemId,
              selectedModifierOptionIds: it.selectedModifiers.map((m) => m.optionId),
              quantity: it.quantity,
              notes: it.notes,
            })),
            previousQuoteToken: bypassPriceChange ? undefined : activeQuote?.quoteToken,
          }),
        })

        const quoteData = await quoteRes.json()

        if (!quoteRes.ok || !quoteData.success) {
          if (quoteData.error?.code === 'PRICE_CHANGED') {
            setPriceChangeInfo({
              previousTotal: quoteData.error.details?.previousTotal || subtotal,
              updatedTotal: quoteData.error.details?.updatedTotal || 0,
              message: quoteData.error.message,
            })
            return
          }
          if (quoteData.error?.code === 'ITEM_STOCK_DEPLETED') {
            showToast(quoteData.error.message || 'Menu atau varian yang dipilih sedang habis.', 'error')
            return
          }
          throw new Error(quoteData.error?.message || 'Gagal menghitung quote pesanan.')
        }

        quote = quoteData.data
        setActiveQuote(quote)
      }

      if (!quote || !quote.quoteToken) {
        throw new Error('Quote resmi tidak tersedia.')
      }

      // 2. Siapkan Payload Checkout & Stabilkan Key Idempotensi
      const payloadItems = items.map((it) => ({
        menuItemId: it.menuItemId,
        selectedModifierOptionIds: it.selectedModifiers.map((m) => m.optionId),
        quantity: it.quantity,
        notes: it.notes || '',
      }))

      const checkoutPayload = {
        tableNumber,
        paymentMethod,
        customerNotes: customerNotes.trim() ? customerNotes.trim() : undefined,
        quoteToken: quote.quoteToken,
        items: payloadItems,
      }

      const clientFingerprint = computeClientFingerprint(checkoutPayload)
      const idempotencyKey = getOrCreateCheckoutIntent(clientFingerprint)

      // 3. Kirim Pembuatan Pesanan ke POST /api/orders dengan Retry Mechanism
      let attempts = 0
      const maxAttempts = 3
      let orderCreated = false

      while (attempts < maxAttempts && !orderCreated) {
        attempts++
        const orderRes = await fetch('/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify(checkoutPayload),
        })

        const orderData = await orderRes.json()

        if (orderRes.status === 409 && orderData.error?.code === 'REQUEST_IN_PROGRESS') {
          // Tunggu 2 detik dan retry dengan key yang sama
          await new Promise((resolve) => setTimeout(resolve, 2000))
          continue
        }

        if (orderRes.status === 409 && orderData.error?.code === 'PRICE_CHANGED') {
          setPriceChangeInfo({
            previousTotal: orderData.error.details?.previousTotal || quote.totalAmount,
            updatedTotal: orderData.error.details?.updatedTotal || 0,
            message: orderData.error.message,
          })
          return
        }

        if (!orderRes.ok || !orderData.success) {
          throw new Error(orderData.error?.message || 'Gagal membuat pesanan.')
        }

        // Sukses (201 Created atau 200 Replayed)
        orderCreated = true
        const order = orderData.data

        // Simpan capability token di localStorage
        if (order.orderSecretToken) {
          saveOrderCapabilityToken(order.orderId, order.orderNumber, order.orderSecretToken)
        }

        // Bersihkan state keranjang dan intent
        clearCheckoutIntent()
        clearCart()

        showToast('Pesanan berhasil dibuat!', 'success')
        router.push(order.nextAction?.url || `/order/${order.orderId}/pay`)
      }
    } catch (err: unknown) {
      console.error('Checkout error:', err)
      showToast(
        err instanceof Error ? err.message : 'Terjadi kendala saat memproses pesanan.',
        'error'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Accept Price Change
  const handleAcceptPriceChange = () => {
    setPriceChangeInfo(null)
    handleCheckout(true)
  }

  // 1. Tampilan Keranjang Kosong
  if (items.length === 0) {
    return (
      <main className="min-h-screen p-4 max-w-lg mx-auto flex flex-col justify-between">
        <div>
          <header className="flex items-center justify-between py-3 border-b border-border mb-8">
            <Link
              href={tableNumber ? `/menu?table=${encodeURIComponent(tableNumber)}` : '/menu'}
              className="text-xs text-brand/70 hover:text-brand font-medium touch-target py-2"
            >
              ← Kembali ke Menu
            </Link>
            {tableNumber && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface border border-border text-brand">
                Meja {tableNumber}
              </span>
            )}
          </header>

          <EmptyState
            title="Keranjang Belanja Masih Kosong"
            description="Anda belum menambahkan pesanan apa pun. Jelajahi katalog kafe SELA dan pilih menu favorit Anda."
            actionLabel="Jelajahi Katalog Menu"
            onAction={() => {
              window.location.href = tableNumber
                ? `/menu?table=${encodeURIComponent(tableNumber)}`
                : '/menu'
            }}
          />
        </div>
      </main>
    )
  }

  // 2. Tampilan Keranjang Berisi Item
  return (
    <main className="min-h-screen px-4 py-6 max-w-lg mx-auto flex flex-col justify-between pb-40">
      <div>
        {/* Top Header */}
        <header className="flex items-center justify-between py-2 border-b border-border mb-4">
          <Link
            href={tableNumber ? `/menu?table=${encodeURIComponent(tableNumber)}` : '/menu'}
            className="text-xs text-brand/70 hover:text-brand font-medium touch-target py-1 flex items-center gap-1"
          >
            ← Tambah Menu Lain
          </Link>
          <div className="flex items-center gap-2">
            {tableNumber ? (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">
                Meja {tableNumber}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-error/10 border border-error/20 text-error">
                Tanpa Meja
              </span>
            )}
            <button
              onClick={clearCart}
              className="text-[11px] text-brand/50 hover:text-error transition-colors px-1 py-1"
            >
              Kosongkan
            </button>
          </div>
        </header>

        {/* Warning Banner jika meja belum terdeteksi */}
        {!tableNumber && (
          <div className="p-3 mb-4 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] text-xs text-[#92400E] flex items-start gap-2">
            <span className="text-base select-none">⚠️</span>
            <div>
              <strong className="block font-semibold">Nomor Meja Tidak Terdeteksi</strong>
              Silakan pindai ulang stiker QR di meja Anda agar pesanan dapat diproses oleh staf kafe.
            </div>
          </div>
        )}

        <h1 className="text-xl font-sans font-bold text-brand mb-4">
          Detail Pesanan Anda
        </h1>

        {/* Item Cards List */}
        <div className="space-y-3.5">
          {items.map((it) => (
            <div
              key={it.cartItemId}
              className="p-4 rounded-2xl bg-surface border border-border space-y-3 transition-all hover:border-brand/30"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-brand truncate">
                    {it.name}
                  </h3>
                  <span className="text-xs font-price-tabular font-medium text-brand/60 block">
                    {formatIDR(it.basePrice)}
                  </span>
                </div>
                <span className="text-sm font-price-tabular font-bold text-accent shrink-0">
                  {formatIDR(it.itemSubtotal)}
                </span>
              </div>

              {/* Selected Modifiers Pills */}
              {it.selectedModifiers.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {it.selectedModifiers.map((mod) => (
                    <span
                      key={mod.optionId}
                      className="text-[11px] px-2 py-0.5 rounded-md bg-cream border border-border text-brand/80"
                    >
                      {mod.optionName}
                      {mod.price > 0 && ` (+${formatIDR(mod.price)})`}
                    </span>
                  ))}
                </div>
              )}

              {/* Safe Notes Rendering */}
              {it.notes && (
                <div className="p-2.5 bg-cream/80 border border-border/80 rounded-xl text-xs text-brand/80 flex items-start gap-2">
                  <span className="text-accent text-sm leading-none select-none">💬</span>
                  <p className="italic leading-snug break-words">
                    &ldquo;{it.notes}&rdquo;
                  </p>
                </div>
              )}

              {/* Line Item Actions */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleEditModifiers(it)}
                    className="text-xs font-semibold text-accent hover:underline touch-target py-1"
                  >
                    Ubah Racikan
                  </button>
                  <span className="text-brand/20">|</span>
                  <button
                    type="button"
                    onClick={() => removeItem(it.cartItemId)}
                    className="text-xs text-brand/60 hover:text-error touch-target py-1"
                  >
                    Hapus
                  </button>
                </div>

                {/* Quantity Stepper (1 to 50) */}
                <div className="flex items-center gap-2 bg-cream px-2 py-1 rounded-xl border border-border">
                  <button
                    type="button"
                    disabled={it.quantity <= 1}
                    onClick={() => updateQuantity(it.cartItemId, it.quantity - 1)}
                    className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center text-xs font-bold text-brand disabled:opacity-40 disabled:cursor-not-allowed touch-target"
                    aria-label="Kurangi kuantitas"
                  >
                    −
                  </button>
                  <span className="text-xs font-bold font-price-tabular min-w-5 text-center">
                    {it.quantity}
                  </span>
                  <button
                    type="button"
                    disabled={it.quantity >= 50}
                    onClick={() => updateQuantity(it.cartItemId, it.quantity + 1)}
                    className="w-6 h-6 rounded-lg bg-surface border border-border flex items-center justify-center text-xs font-bold text-brand disabled:opacity-40 disabled:cursor-not-allowed touch-target"
                    aria-label="Tambah kuantitas"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Customer Notes */}
        <section className="mt-5">
          <label
            htmlFor="customer-notes"
            className="block text-xs font-bold uppercase tracking-wider text-brand/70 mb-1.5"
          >
            Catatan untuk Barista / Dapur (Opsional)
          </label>
          <input
            id="customer-notes"
            type="text"
            maxLength={100}
            value={customerNotes}
            onChange={(e) => setCustomerNotes(e.target.value)}
            placeholder="Contoh: Pisahkan gula pasir, tolong antar bersamaan"
            className="w-full text-xs p-3 rounded-xl border border-border bg-surface text-brand placeholder:text-brand/40 focus:outline-hidden focus:ring-1 focus:ring-accent"
          />
          <span className="text-[10px] text-brand/50 mt-1 block text-right">
            {customerNotes.length}/100 karakter
          </span>
        </section>

        {/* Payment Method Selector */}
        <section className="mt-4 pt-4 border-t border-border">
          <span className="block text-xs font-bold uppercase tracking-wider text-brand/70 mb-2.5">
            Metode Pembayaran
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {availableMethods.enableMidtransQris && (
              <button
                type="button"
                onClick={() => setPaymentMethod('QRIS')}
                className={`touch-target p-3 rounded-2xl border text-left transition-all ${
                  paymentMethod === 'QRIS'
                    ? 'border-2 border-accent bg-surface shadow-xs'
                    : 'border-border bg-surface/70 hover:border-brand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-brand">QRIS Dinamis</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Otomatis</span>
                </div>
                <span className="text-[10px] text-brand/60 mt-0.5 block leading-tight">
                  Verifikasi instan via GoPay, BCA, Livin, dll
                </span>
              </button>
            )}

            {availableMethods.enableManualQris && (
              <button
                type="button"
                onClick={() => setPaymentMethod('MANUAL_QRIS')}
                className={`touch-target p-3 rounded-2xl border text-left transition-all ${
                  paymentMethod === 'MANUAL_QRIS'
                    ? 'border-2 border-accent bg-surface shadow-xs'
                    : 'border-border bg-surface/70 hover:border-brand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-brand">
                    {availableMethods.manualQrisName || 'QRIS Toko'}
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">Statis</span>
                </div>
                <span className="text-[10px] text-brand/60 mt-0.5 block leading-tight">
                  Scan barcode QRIS kafe & konfirmasi kasir
                </span>
              </button>
            )}

            {availableMethods.enableCash && (
              <button
                type="button"
                onClick={() => setPaymentMethod('CASH')}
                className={`touch-target p-3 rounded-2xl border text-left transition-all ${
                  paymentMethod === 'CASH'
                    ? 'border-2 border-accent bg-surface shadow-xs'
                    : 'border-border bg-surface/70 hover:border-brand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-brand">Bayar Tunai</span>
                  <span className="text-[10px] bg-surface-container text-brand/80 font-bold px-1.5 py-0.5 rounded">Kasir</span>
                </div>
                <span className="text-[10px] text-brand/60 mt-0.5 block leading-tight">
                  Bayar langsung ke kasir kafe
                </span>
              </button>
            )}

            {availableMethods.enableManualTransfer && (
              <button
                type="button"
                onClick={() => setPaymentMethod('MANUAL_TRANSFER')}
                className={`touch-target p-3 rounded-2xl border text-left transition-all ${
                  paymentMethod === 'MANUAL_TRANSFER'
                    ? 'border-2 border-accent bg-surface shadow-xs'
                    : 'border-border bg-surface/70 hover:border-brand/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="block text-xs font-bold text-brand">Transfer Bank</span>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded">{availableMethods.manualTransferBank || 'Bank'}</span>
                </div>
                <span className="text-[10px] text-brand/60 mt-0.5 block leading-tight">
                  Transfer manual & konfirmasi kasir
                </span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* Sticky Bottom Summary & Checkout */}
      <footer className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-border p-4 pb-safe z-20">
        <div className="max-w-lg mx-auto space-y-3">
          <div className="space-y-1.5 text-xs text-brand/70">
            <div className="flex items-center justify-between">
              <span>Subtotal Pesanan</span>
              <span className="font-price-tabular font-medium text-brand">
                {formatIDR(activeQuote ? activeQuote.subtotalAmount : subtotal)}
              </span>
            </div>
            {activeQuote?.serviceAmount !== undefined && activeQuote.serviceAmount > 0 && (
              <div className="flex items-center justify-between">
                <span>Biaya Layanan ({activeQuote.financialBreakdown?.servicePercentageFormatted || ''})</span>
                <span className="font-price-tabular">{formatIDR(activeQuote.serviceAmount)}</span>
              </div>
            )}
            {activeQuote?.taxAmount !== undefined && activeQuote.taxAmount > 0 && (
              <div className="flex items-center justify-between">
                <span>Pajak Restoran PB1 ({activeQuote.financialBreakdown?.taxPercentageFormatted || ''})</span>
                <span className="font-price-tabular">{formatIDR(activeQuote.taxAmount)}</span>
              </div>
            )}
            {activeQuote?.financialBreakdown?.isTaxInclusive && (
              <div className="flex items-center justify-between text-[11px] text-brand/60">
                <span>Status Pajak & Layanan</span>
                <span className="font-medium text-emerald-700">Sudah Termasuk (Nett)</span>
              </div>
            )}
            {(!activeQuote || (activeQuote.serviceAmount === 0 && activeQuote.taxAmount === 0 && !activeQuote.financialBreakdown?.isTaxInclusive)) && (
              <div className="flex items-center justify-between">
                <span>Pajak & Layanan</span>
                <span className="font-price-tabular">Rp0 (0%)</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm font-bold text-brand pt-1 border-t border-border/60">
              <span>Total Tagihan Resmi</span>
              <span className="text-base font-price-tabular text-accent font-bold">
                {formatIDR(activeQuote ? activeQuote.totalAmount : subtotal)}
              </span>
            </div>
          </div>

          <Button
            variant="primary"
            size="lg"
            disabled={isSubmitting || !tableNumber}
            onClick={() => handleCheckout(false)}
            className="w-full font-bold shadow-md touch-target flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Spinner size="sm" />
                <span>Memproses Pesanan...</span>
              </>
            ) : !tableNumber ? (
              <span>Pindai QR Meja untuk Memesan</span>
            ) : (
              <span>
                {paymentMethod === 'QRIS'
                  ? 'Bayar via QRIS Otomatis (Midtrans) →'
                  : paymentMethod === 'MANUAL_QRIS'
                  ? 'Pesan & Tampilkan QRIS Kafe →'
                  : paymentMethod === 'MANUAL_TRANSFER'
                  ? 'Pesan & Info Rekening Transfer →'
                  : 'Pesan & Bayar Tunai di Kasir →'}
              </span>
            )}
          </Button>
        </div>
      </footer>

      {/* Product Modifier Sheet (for Editing) */}
      <ProductModifierSheet
        item={editingCatalogItem}
        isOpen={isModifierSheetOpen}
        editingCartItem={editingItem}
        onClose={() => {
          setIsModifierSheetOpen(false)
          setEditingItem(null)
          setEditingCatalogItem(null)
        }}
      />

      {/* Price Change Confirmation Dialog */}
      {priceChangeInfo && (
        <Dialog
          isOpen={Boolean(priceChangeInfo)}
          onClose={() => setPriceChangeInfo(null)}
          title="Pembaruan Harga Menu"
          description="Kafe baru saja memperbarui nominal harga menu."
        >
          <div className="space-y-4 py-2">
            <p className="text-xs text-brand/80 leading-relaxed">
              {priceChangeInfo.message}
            </p>

            <div className="p-3 bg-cream rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-brand/60">
                <span>Total Sebelumnya:</span>
                <span className="line-through font-price-tabular">
                  {formatIDR(priceChangeInfo.previousTotal)}
                </span>
              </div>
              <div className="flex justify-between text-accent font-bold text-sm">
                <span>Total Terbaru:</span>
                <span className="font-price-tabular">
                  {formatIDR(priceChangeInfo.updatedTotal)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                size="md"
                onClick={() => setPriceChangeInfo(null)}
                className="touch-target text-xs"
              >
                Batal
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleAcceptPriceChange}
                className="touch-target text-xs font-semibold"
              >
                Setuju & Lanjutkan
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </main>
  )
}
