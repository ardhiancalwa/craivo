import { describe, it, expect } from 'vitest'
import {
  calculateOrderFinancials,
  formatBpsPercentage,
  type FinancialConfig,
} from '@/lib/server/financial-calculator'

describe('Unit: Financial Calculator (PB1 Tax & Service Charge)', () => {
  describe('formatBpsPercentage', () => {
    it('memformat basis points ke persentase string yang rapi', () => {
      expect(formatBpsPercentage(0)).toBe('0%')
      expect(formatBpsPercentage(500)).toBe('5%')
      expect(formatBpsPercentage(1000)).toBe('10%')
      expect(formatBpsPercentage(1050)).toBe('10.5%')
      expect(formatBpsPercentage(1100)).toBe('11%')
      expect(formatBpsPercentage(-100)).toBe('0%')
      expect(formatBpsPercentage(NaN)).toBe('0%')
    })
  })

  describe('calculateOrderFinancials - Baseline SELA 0% / 0%', () => {
    const config0Pct: FinancialConfig = {
      taxRateBps: 0,
      serviceRateBps: 0,
      isTaxInclusive: false,
    }

    it('menghasilkan nilai nett tanpa biaya tambahan pada baseline 0%/0%', () => {
      const result = calculateOrderFinancials(50000, config0Pct)

      expect(result.subtotalAmount).toBe(50000)
      expect(result.serviceAmount).toBe(0)
      expect(result.taxAmount).toBe(0)
      expect(result.totalAmount).toBe(50000)
      expect(result.netBaseAmount).toBe(50000)
      expect(result.taxPercentageFormatted).toBe('0%')
      expect(result.servicePercentageFormatted).toBe('0%')
    })
  })

  describe('calculateOrderFinancials - Mode Eksklusif (Plus-Plus)', () => {
    const configExclusive: FinancialConfig = {
      taxRateBps: 1000, // 10%
      serviceRateBps: 500, // 5%
      isTaxInclusive: false,
    }

    it('menghitung service dari subtotal dan PB1 dari (subtotal + service)', () => {
      // Subtotal: 50.000
      // Service (5%): 2.500
      // Tax Base: 52.500
      // Tax PB1 (10%): 5.250
      // Total: 57.750
      const result = calculateOrderFinancials(50000, configExclusive)

      expect(result.subtotalAmount).toBe(50000)
      expect(result.serviceAmount).toBe(2500)
      expect(result.taxAmount).toBe(5250)
      expect(result.totalAmount).toBe(57750)
      expect(result.netBaseAmount).toBe(50000)
      expect(result.taxPercentageFormatted).toBe('10%')
      expect(result.servicePercentageFormatted).toBe('5%')
      expect(result.isTaxInclusive).toBe(false)
    })

    it('melakukan pembulatan integer rupiah tanpa galat desimal float', () => {
      // Subtotal: 33.333
      // Service (5%): round(33.333 * 0.05) = round(1666.65) = 1667
      // Tax Base: 33.333 + 1667 = 35.000
      // Tax PB1 (10%): round(35.000 * 0.10) = 3500
      // Total: 33.333 + 1667 + 3500 = 38.500
      const result = calculateOrderFinancials(33333, configExclusive)

      expect(result.subtotalAmount).toBe(33333)
      expect(result.serviceAmount).toBe(1667)
      expect(result.taxAmount).toBe(3500)
      expect(result.totalAmount).toBe(38500)
      expect(Number.isInteger(result.totalAmount)).toBe(true)
    })
  })

  describe('calculateOrderFinancials - Mode Inklusif (All-Inclusive Nett)', () => {
    const configInclusive: FinancialConfig = {
      taxRateBps: 1000, // 10%
      serviceRateBps: 500, // 5%
      isTaxInclusive: true,
    }

    it('menjaga totalAmount sama persis dengan subtotalAmount dan breakdown seimbang', () => {
      // Subtotal: 50.000 (total tagihan)
      // Combined rate: (500 + 1000) / 10000 = 0.15
      // netBase: round(50000 / 1.15) = 43478
      // service: round(43478 * 0.05) = 2174
      // tax: 50000 - 43478 - 2174 = 4348
      const result = calculateOrderFinancials(50000, configInclusive)

      expect(result.totalAmount).toBe(50000)
      expect(result.subtotalAmount).toBe(50000)
      expect(result.netBaseAmount).toBe(43478)
      expect(result.serviceAmount).toBe(2174)
      expect(result.taxAmount).toBe(4348)
      expect(result.isTaxInclusive).toBe(true)

      // Invarian kepastian finansial: netBase + service + tax === totalAmount
      expect(result.netBaseAmount + result.serviceAmount + result.taxAmount).toBe(result.totalAmount)
    })

    it('menjamin invarian breakdown pada berbagai nominal harga ganjil', () => {
      const oddPrices = [9999, 17500, 23456, 45890, 100001, 250000]

      for (const price of oddPrices) {
        const result = calculateOrderFinancials(price, configInclusive)
        expect(result.totalAmount).toBe(price)
        expect(result.netBaseAmount + result.serviceAmount + result.taxAmount).toBe(price)
        expect(Number.isInteger(result.netBaseAmount)).toBe(true)
        expect(Number.isInteger(result.serviceAmount)).toBe(true)
        expect(Number.isInteger(result.taxAmount)).toBe(true)
      }
    })
  })

  describe('Edge Cases', () => {
    it('menangani subtotal 0 atau negatif secara aman tanpa crash', () => {
      const config: FinancialConfig = {
        taxRateBps: 1000,
        serviceRateBps: 500,
        isTaxInclusive: false,
      }

      const resZero = calculateOrderFinancials(0, config)
      expect(resZero.totalAmount).toBe(0)
      expect(resZero.taxAmount).toBe(0)
      expect(resZero.serviceAmount).toBe(0)

      const resNegative = calculateOrderFinancials(-5000, config)
      expect(resNegative.totalAmount).toBe(0)
      expect(resNegative.subtotalAmount).toBe(0)
    })
  })
})

