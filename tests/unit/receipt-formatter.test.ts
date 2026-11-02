// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  formatThermalReceipt,
  formatKitchenTicket,
  wrapText,
  generatePrintableHtml,
  type ReceiptOrderData,
} from '@/lib/receipt-formatter'

describe('Tahap 16: Receipt & Kitchen Ticket Formatter Unit Tests', () => {
  const mockOrder: ReceiptOrderData = {
    id: 'ord-test-123',
    orderNumber: 'SELA-261029-001',
    table: {
      tableNumber: '07',
    },
    paymentMethod: 'CASH',
    paymentStatus: 'PAID',
    createdAt: new Date('2026-10-29T14:30:00+07:00'),
    paidAt: new Date('2026-10-29T14:32:00+07:00'),
    customerNotes: 'Tolong jangan pakai sedotan plastik',
    subtotalAmount: 76000,
    taxAmount: 0,
    serviceAmount: 0,
    totalAmount: 76000,
    items: [
      {
        id: 'item-1',
        nameSnapshot: 'Kopi Susu Aren Gula Aren Organik Spesial',
        priceSnapshot: 28000,
        quantity: 1,
        notes: 'Es sedikit saja',
        subtotal: 28000,
        modifiers: [
          { nameSnapshot: 'Less Sugar (50%)', priceSnapshot: 0 },
          { nameSnapshot: 'Oatmilk Tambahan', priceSnapshot: 6000 },
        ],
      },
      {
        id: 'item-2',
        nameSnapshot: 'Artisanal Butter Croissant Prancisan Panggang Hangat',
        priceSnapshot: 24000,
        quantity: 2,
        notes: 'Hangatkan dulu ya',
        subtotal: 48000,
        modifiers: [],
      },
    ],
  }

  describe('1. Line Wrapping & Formatting Helpers', () => {
    it('wraps long text properly without exceeding maxWidth', () => {
      const longName = 'Specialty Single Origin Filter Coffee V60 Anaerobic Slow Drip'
      const wrapped = wrapText(longName, 20)
      expect(wrapped.length).toBeGreaterThan(1)
      for (const line of wrapped) {
        expect(line.length).toBeLessThanOrEqual(20)
      }
    })

    it('returns original short text in single element array', () => {
      const short = 'Espresso'
      const wrapped = wrapText(short, 20)
      expect(wrapped).toEqual(['Espresso'])
    })
  })

  describe('2. Cashier & Customer Thermal Receipt (58mm & 80mm)', () => {
    it('formats 58mm receipt with 32 columns and proper SELA header', () => {
      const receipt = formatThermalReceipt(mockOrder, { paper: '58mm', isReprint: false })
      const lines = receipt.split('\n')

      expect(receipt).toContain('SELA')
      expect(receipt).toContain('ARTISANAL COFFEE & BAKE')
      expect(receipt).toContain('MEJA 07')
      expect(receipt).toContain('SELA-261029-001')
      expect(receipt).toContain('LUNAS (PAID)')
      expect(receipt).toContain('76.000')

      // Verifikasi divider baris utama tepat 32 karakter
      const dividerLine = lines.find((l) => l.startsWith('================================'))
      expect(dividerLine).toBeDefined()
      expect(dividerLine?.length).toBe(32)
    })

    it('formats 80mm receipt with 48 columns', () => {
      const receipt = formatThermalReceipt(mockOrder, { paper: '80mm', isReprint: false })
      const lines = receipt.split('\n')

      const dividerLine = lines.find((l) => l.startsWith('================================================'))
      expect(dividerLine).toBeDefined()
      expect(dividerLine?.length).toBe(48)
    })

    it('adds reprint watermark when isReprint is true', () => {
      const firstPrint = formatThermalReceipt(mockOrder, { isReprint: false })
      expect(firstPrint).not.toContain('CETAK ULANG')

      const reprint = formatThermalReceipt(mockOrder, { isReprint: true, reprintCount: 1 })
      expect(reprint).toContain('*** CETAK ULANG (REPRINT) #2 ***')
    })

    it('displays prominent warning for unpaid cash order and does NOT resemble LUNAS', () => {
      const unpaidOrder: ReceiptOrderData = {
        ...mockOrder,
        paymentStatus: 'WAITING_CASHIER',
        paidAt: null,
      }

      const receipt = formatThermalReceipt(unpaidOrder, { isReprint: false })
      expect(receipt).toContain('MENUNGGU PEMBAYARAN KASIR')
      expect(receipt).toContain('*** BELUM LUNAS ***')
      expect(receipt).toContain('PERHATIAN: BUKAN BUKTI LUNAS')
      expect(receipt).not.toContain('LUNAS (PAID)')
      expect(receipt).not.toContain('SIMPAN SEBAGAI BUKTI BAYAR')
    })
  })

  describe('3. Kitchen Ticket (MUTLAK TANPA HARGA/RUPIAH)', () => {
    it('formats kitchen ticket highlighting table number and notes without ANY price or currency', () => {
      const ticket = formatKitchenTicket(mockOrder, { paper: '58mm', isReprint: false })

      // Wajib ada
      expect(ticket).toContain('[ TIKET DAPUR / BARISTA ]')
      expect(ticket).toContain('*** MEJA 07 ***')
      expect(ticket).toContain('SELA-261029-001')
      expect(ticket).toContain('Tolong jangan pakai sedotan')
      expect(ticket).toContain('plastik')
      expect(ticket).toContain('1x    Kopi Susu Aren')
      expect(ticket).toContain('+ Less Sugar (50%)')
      expect(ticket).toContain('* "Es sedikit saja"')
      expect(ticket).toContain('2x    Artisanal Butter Croissant')
      expect(ticket).toContain('* "Hangatkan dulu ya"')

      // MUTLAK TIDAK BOLEH ADA HARGA / KEUANGAN
      expect(ticket).not.toContain('Rp')
      expect(ticket).not.toContain('76.000')
      expect(ticket).not.toContain('28.000')
      expect(ticket).not.toContain('24.000')
      expect(ticket).not.toContain('TOTAL')
      expect(ticket).not.toContain('Subtotal')
      expect(ticket).not.toContain('Pajak')
    })

    it('kitchen ticket reprint displays separate kitchen reprint watermark', () => {
      const ticketReprint = formatKitchenTicket(mockOrder, { isReprint: true, reprintCount: 2 })
      expect(ticketReprint).toContain('*** CETAK ULANG DAPUR #3 ***')
    })
  })

  describe('4. Standalone HTML Receipt Generator', () => {
    it('generates self-contained HTML with print styles and content', () => {
      const html = generatePrintableHtml({
        type: 'customer',
        paper: '58mm',
        order: mockOrder,
        isReprint: false,
      })

      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('@media print')
      expect(html).toContain('SELA')
      expect(html).toContain('MEJA 07')
      expect(html).toContain('window.print()')
    })
  })
})
