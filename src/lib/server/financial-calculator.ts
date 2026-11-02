import 'server-only'

export interface FinancialConfig {
  taxRateBps: number // Basis points (1000 = 10%, 500 = 5%, 0 = 0%)
  serviceRateBps: number // Basis points
  isTaxInclusive: boolean // Mode inklusif vs eksklusif
}

export interface CalculatedFinancials {
  subtotalAmount: number // Integer IDR (sebelum tax/service jika eksklusif)
  serviceAmount: number // Integer IDR
  taxAmount: number // Integer IDR
  totalAmount: number // Total final yang ditagihkan kepada pelanggan (Integer IDR)
  netBaseAmount: number // Nilai basis murni tanpa tax & service (Integer IDR)
  isTaxInclusive: boolean
  taxRateBps: number
  serviceRateBps: number
  taxPercentageFormatted: string // Contoh: "10%" atau "0%"
  servicePercentageFormatted: string // Contoh: "5%" atau "0%"
}

/**
 * Format basis points (BPS) ke representasi persentase string yang rapi.
 * 1000 bps -> "10%"
 * 500 bps -> "5%"
 * 1050 bps -> "10.5%"
 * 0 bps -> "0%"
 */
export function formatBpsPercentage(bps: number): string {
  if (!Number.isFinite(bps) || bps <= 0) return '0%'
  const percent = bps / 100
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2).replace(/\.?0+$/, '')}%`
}

/**
 * Menghitung rincian finansial pesanan secara server-authoritative
 * dengan pembulatan integer IDR presisi (tanpa galat desimal float).
 *
 * @param subtotalAmount Total harga item + modifier dalam integer IDR
 * @param config Konfigurasi finansial aktif kafe
 */
export function calculateOrderFinancials(
  subtotalAmount: number,
  config: FinancialConfig
): CalculatedFinancials {
  const safeSubtotal = Math.max(0, Math.floor(subtotalAmount))
  const taxRateBps = Math.max(0, Math.floor(config.taxRateBps || 0))
  const serviceRateBps = Math.max(0, Math.floor(config.serviceRateBps || 0))
  const isTaxInclusive = Boolean(config.isTaxInclusive)

  const taxPercentageFormatted = formatBpsPercentage(taxRateBps)
  const servicePercentageFormatted = formatBpsPercentage(serviceRateBps)

  // 1. Kasus 0% / 0% Baseline (Pilot SELA Default)
  if (taxRateBps === 0 && serviceRateBps === 0) {
    return {
      subtotalAmount: safeSubtotal,
      serviceAmount: 0,
      taxAmount: 0,
      totalAmount: safeSubtotal,
      netBaseAmount: safeSubtotal,
      isTaxInclusive,
      taxRateBps: 0,
      serviceRateBps: 0,
      taxPercentageFormatted: '0%',
      servicePercentageFormatted: '0%',
    }
  }

  // 2. Mode Inklusif (Harga menu sudah nett all-inclusive)
  if (isTaxInclusive) {
    // Total yang dibayar pelanggan = safeSubtotal
    const combinedRate = (serviceRateBps + taxRateBps) / 10000
    const netBaseAmount = Math.round(safeSubtotal / (1 + combinedRate))
    const serviceAmount = Math.round((netBaseAmount * serviceRateBps) / 10000)
    // Tax dihitung sebagai selisih agar netBase + service + tax tepat sama dengan subtotal
    const taxAmount = Math.max(0, safeSubtotal - netBaseAmount - serviceAmount)

    return {
      subtotalAmount: safeSubtotal,
      serviceAmount,
      taxAmount,
      totalAmount: safeSubtotal,
      netBaseAmount,
      isTaxInclusive: true,
      taxRateBps,
      serviceRateBps,
      taxPercentageFormatted,
      servicePercentageFormatted,
    }
  }

  // 3. Mode Eksklusif (Subtotal + Service + Tax)
  // Service dihitung dari Subtotal
  const serviceAmount = Math.round((safeSubtotal * serviceRateBps) / 10000)
  // Dasar pengenaan pajak (PB1) mencakup Subtotal + Service
  const taxBase = safeSubtotal + serviceAmount
  const taxAmount = Math.round((taxBase * taxRateBps) / 10000)
  const totalAmount = safeSubtotal + serviceAmount + taxAmount

  return {
    subtotalAmount: safeSubtotal,
    serviceAmount,
    taxAmount,
    totalAmount,
    netBaseAmount: safeSubtotal,
    isTaxInclusive: false,
    taxRateBps,
    serviceRateBps,
    taxPercentageFormatted,
    servicePercentageFormatted,
  }
}

