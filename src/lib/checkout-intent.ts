import { createUuid } from './utils'

export interface CheckoutIntent {
  key: string // UUID v4
  fingerprint: string
  createdAt: number
}

const STORAGE_INTENT_KEY = 'cravio_checkout_intent'
const STORAGE_ORDERS_KEY = 'cravio_orders'

/**
 * Menghasilkan representasi string kanonis dari isi checkout di sisi klien
 * untuk menguji konsistensi niat checkout (idempotency intent stabilizer).
 */
export function computeClientFingerprint(params: {
  tableNumber: string
  paymentMethod: string
  customerNotes?: string
  quoteToken: string
  items: Array<{
    menuItemId: string
    selectedModifierOptionIds: string[]
    quantity: number
    notes?: string
  }>
}): string {
  const canonicalItems = (params.items || [])
    .map((it) => ({
      menuItemId: it.menuItemId,
      selectedModifierOptionIds: [...(it.selectedModifierOptionIds || [])].sort(),
      quantity: it.quantity,
      notes: (it.notes || '').trim(),
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))

  return JSON.stringify({
    tableNumber: params.tableNumber.trim(),
    paymentMethod: params.paymentMethod,
    customerNotes: (params.customerNotes || '').trim(),
    quoteToken: params.quoteToken.trim(),
    items: canonicalItems,
  })
}

/**
 * Mengambil key idempotensi yang sedang aktif untuk fingerprint yang sama,
 * atau menerbitkan UUID v4 baru jika niat checkout baru atau payload berubah.
 */
export function getOrCreateCheckoutIntent(fingerprint: string): string {
  if (typeof window === 'undefined') {
    return createUuid()
  }

  try {
    const raw = localStorage.getItem(STORAGE_INTENT_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CheckoutIntent
      // Jika fingerprint identik dan masih dalam batas toleransi 30 menit, pakai key yang sama
      if (
        parsed.fingerprint === fingerprint &&
        Date.now() - parsed.createdAt < 30 * 60 * 1000
      ) {
        return parsed.key
      }
    }

    const newKey = createUuid()
    const newIntent: CheckoutIntent = {
      key: newKey,
      fingerprint,
      createdAt: Date.now(),
    }
    localStorage.setItem(STORAGE_INTENT_KEY, JSON.stringify(newIntent))
    return newKey
  } catch {
    return createUuid()
  }
}

/**
 * Menghapus niat checkout setelah pesanan berhasil dibuat atau keranjang diubah secara signifikan.
 */
export function clearCheckoutIntent(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_INTENT_KEY)
  } catch {
    // Abaikan error kuota localStorage
  }
}

/**
 * Menyimpan order capability token ke localStorage perangkat pemesan (DEC-014).
 */
export function saveOrderCapabilityToken(
  orderId: string,
  orderNumber: string,
  token: string
): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY)
    const orders = raw ? JSON.parse(raw) : {}
    orders[orderId] = {
      orderNumber,
      token,
      savedAt: Date.now(),
    }
    localStorage.setItem(STORAGE_ORDERS_KEY, JSON.stringify(orders))
  } catch {
    // Abaikan error kuota localStorage
  }
}

/**
 * Membaca token kapabilitas pesanan dari localStorage.
 */
export function getOrderCapabilityToken(orderId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_ORDERS_KEY)
    if (!raw) return null
    const orders = JSON.parse(raw)
    return orders[orderId]?.token || null
  } catch {
    return null
  }
}

