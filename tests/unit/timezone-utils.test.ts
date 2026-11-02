import { describe, it, expect } from 'vitest'
import {
  getJakartaDayBoundaries,
  getJakartaDateRangeBoundaries,
  formatJakartaDateTime,
  JAKARTA_OFFSET_MS,
} from '@/lib/server/timezone-utils'

describe('Unit: Timezone Utilities (Asia/Jakarta Boundaries & WIB Display)', () => {
  describe('getJakartaDayBoundaries', () => {
    it('mengonversi YYYY-MM-DD ke rentang UTC yang tepat untuk 00:00 - 23:59:59 WIB', () => {
      const boundaries = getJakartaDayBoundaries('2026-10-29')

      // 2026-10-29 00:00:00 WIB = 2026-10-28 17:00:00.000 UTC
      expect(boundaries.startUtc.toISOString()).toBe('2026-10-28T17:00:00.000Z')

      // 2026-10-29 23:59:59.999 WIB = 2026-10-29 16:59:59.999 UTC
      expect(boundaries.endUtc.toISOString()).toBe('2026-10-29T16:59:59.999Z')

      expect(boundaries.jakartaDateString).toBe('2026-10-29')
    })

    it('membedakan transaksi 23:30 WIB dan 00:30 WIB hari berikutnya secara akurat', () => {
      const day29 = getJakartaDayBoundaries('2026-10-29')

      // Transaksi A: 2026-10-29 23:30:00 WIB -> 2026-10-29 16:30:00.000 UTC
      const txLateNight = new Date('2026-10-29T16:30:00.000Z')

      // Transaksi B: 2026-10-30 00:30:00 WIB -> 2026-10-29 17:30:00.000 UTC
      const txNextDayEarly = new Date('2026-10-29T17:30:00.000Z')

      // Transaksi A masuk dalam hari 29
      expect(txLateNight >= day29.startUtc && txLateNight <= day29.endUtc).toBe(true)

      // Transaksi B di luar hari 29 (masuk ke hari 30)
      expect(txNextDayEarly >= day29.startUtc && txNextDayEarly <= day29.endUtc).toBe(false)
      expect(txNextDayEarly > day29.endUtc).toBe(true)
    })

    it('menolak format tanggal yang tidak sesuai dengan error informatif', () => {
      expect(() => getJakartaDayBoundaries('29-10-2026')).toThrow('Format tanggal tidak valid')
      expect(() => getJakartaDayBoundaries('bukan-tanggal')).toThrow('Format tanggal tidak valid')
      expect(() => getJakartaDayBoundaries('')).toThrow('Format tanggal tidak valid')
    })
  })

  describe('getJakartaDateRangeBoundaries', () => {
    it('mengonversi rentang beberapa hari ke batas startUtc dan endUtc komprehensif', () => {
      const range = getJakartaDateRangeBoundaries('2026-10-25', '2026-10-29')

      // Start: 2026-10-25 00:00:00 WIB -> 2026-10-24 17:00:00.000 UTC
      expect(range.startUtc.toISOString()).toBe('2026-10-24T17:00:00.000Z')

      // End: 2026-10-29 23:59:59.999 WIB -> 2026-10-29 16:59:59.999 UTC
      expect(range.endUtc.toISOString()).toBe('2026-10-29T16:59:59.999Z')
      expect(range.startJakartaString).toBe('2026-10-25')
      expect(range.endJakartaString).toBe('2026-10-29')
    })

    it('menolak rentang jika startDate lebih besar dari endDate', () => {
      expect(() => getJakartaDateRangeBoundaries('2026-10-30', '2026-10-25')).toThrow(
        'startDate tidak boleh lebih besar dari endDate'
      )
    })
  })

  describe('formatJakartaDateTime', () => {
    it('memformat timestamp UTC ke string WIB yang sesuai', () => {
      // 2026-10-29 10:30:00 UTC = 2026-10-29 17:30 WIB
      const date = new Date('2026-10-29T10:30:00.000Z')
      const formatted = formatJakartaDateTime(date)

      expect(formatted).toContain('17:30 WIB')
      expect(formatted).toContain('2026')
    })
  })

  describe('Konstanta Offset', () => {
    it('memiliki offset 7 jam dalam milidetik', () => {
      expect(JAKARTA_OFFSET_MS).toBe(7 * 60 * 60 * 1000)
    })
  })
})

