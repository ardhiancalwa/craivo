import { describe, it, expect } from 'vitest'
import {
  sanitizeCsvCell,
  generateTransactionsCsv,
  type TransactionCsvRow,
} from '@/lib/server/csv-exporter'

describe('Unit: CSV Exporter & Formula Injection Protection (CWE-1236)', () => {
  describe('sanitizeCsvCell', () => {
    it('mengapit teks biasa dengan tanda petik ganda RFC 4180', () => {
      expect(sanitizeCsvCell('Es Kopi Susu')).toBe('"Es Kopi Susu"')
      expect(sanitizeCsvCell('Meja 05')).toBe('"Meja 05"')
    })

    it('mengonversi angka menjadi string ter-quote', () => {
      expect(sanitizeCsvCell(25000)).toBe('"25000"')
      expect(sanitizeCsvCell(0)).toBe('"0"')
    })

    it('menangani nilai null dan undefined dengan string kosong aman', () => {
      expect(sanitizeCsvCell(null)).toBe('""')
      expect(sanitizeCsvCell(undefined)).toBe('""')
    })

    it('melakukan escaping ganda pada tanda kutip di dalam nilai (" -> "")', () => {
      expect(sanitizeCsvCell('Kopi "Signature" SELA')).toBe('"Kopi ""Signature"" SELA"')
    })

    it('mencegah Formula Injection (CWE-1236) dengan memberi awalan petik tunggal', () => {
      // Simbol formula spreadsheet: =, +, -, @, \t, \r, %
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe('"\'=SUM(A1:A10)"')
      expect(sanitizeCsvCell('=cmd|"/C calc"!A0')).toBe('"\'=cmd|""/C calc""!A0"')
      expect(sanitizeCsvCell('+6281234567890')).toBe('"\'+6281234567890"')
      expect(sanitizeCsvCell('-1000')).toBe('"\'-1000"')
      expect(sanitizeCsvCell('@SUM(1+1)')).toBe('"\'@SUM(1+1)"')
      expect(sanitizeCsvCell('\tmalicious_tab')).toBe('"\'\tmalicious_tab"')
      expect(sanitizeCsvCell('\rmalicious_cr')).toBe('"\'\rmalicious_cr"')
      expect(sanitizeCsvCell('%username%')).toBe('"\'%username%"')
    })
  })

  describe('generateTransactionsCsv', () => {
    const mockRows: TransactionCsvRow[] = [
      {
        orderNumber: 'ORD-20261029-0001',
        createdAtJakarta: '29 Okt 2026, 10:15 WIB',
        tableNumber: '04',
        paymentMethod: 'QRIS',
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
        subtotal: 50000,
        service: 0,
        tax: 0,
        totalGross: 50000,
        refundAmount: 0,
        totalNet: 50000,
        itemSummary: '2x Kopi Susu Sela',
        customerNotes: 'Kurang manis',
        refundReason: null,
      },
      {
        orderNumber: 'ORD-20261029-0002',
        createdAtJakarta: '29 Okt 2026, 11:30 WIB',
        tableNumber: '12',
        paymentMethod: 'CASH',
        paymentStatus: 'REFUNDED',
        orderStatus: 'CANCELLED',
        subtotal: 35000,
        service: 0,
        tax: 0,
        totalGross: 35000,
        refundAmount: 35000,
        totalNet: 0,
        itemSummary: '1x Manual Brew V60',
        customerNotes: null,
        refundReason: 'Salah input kasir',
      },
    ]

    it('menghasilkan berkas CSV diawali UTF-8 BOM (\\uFEFF) untuk kompatibilitas Excel', () => {
      const csv = generateTransactionsCsv(mockRows)
      expect(csv.startsWith('\uFEFF')).toBe(true)
    })

    it('memuat seluruh kolom header finansial dan operasional yang disyaratkan', () => {
      const csv = generateTransactionsCsv(mockRows)
      const lines = csv.replace('\uFEFF', '').split('\r\n')
      const headerLine = lines[0]

      expect(headerLine).toContain('Nomor Order')
      expect(headerLine).toContain('Waktu Transaksi (WIB)')
      expect(headerLine).toContain('Nomor Meja')
      expect(headerLine).toContain('Metode Bayar')
      expect(headerLine).toContain('Status Pembayaran')
      expect(headerLine).toContain('Status Dapur')
      expect(headerLine).toContain('Subtotal (IDR)')
      expect(headerLine).toContain('Biaya Layanan (IDR)')
      expect(headerLine).toContain('Pajak PB1 (IDR)')
      expect(headerLine).toContain('Total Kotor (IDR)')
      expect(headerLine).toContain('Total Refund (IDR)')
      expect(headerLine).toContain('Total Bersih (IDR)')
      expect(headerLine).toContain('Rincian Menu')
      expect(headerLine).toContain('Catatan Pelanggan')
      expect(headerLine).toContain('Alasan Refund / Void')
    })

    it('memformat baris data dengan benar dan menyertakan fallback catatan/refund', () => {
      const csv = generateTransactionsCsv(mockRows)
      const lines = csv.replace('\uFEFF', '').split('\r\n')

      expect(lines.length).toBe(3) // 1 header + 2 data rows

      // Baris 1: ORD-0001
      expect(lines[1]).toContain('"ORD-20261029-0001"')
      expect(lines[1]).toContain('"QRIS"')
      expect(lines[1]).toContain('"50000"')
      expect(lines[1]).toContain('"Kurang manis"')
      expect(lines[1]).toContain('"\'-\"') // fallback refund reason diberi petik tunggal anti-formula injection

      // Baris 2: ORD-0002
      expect(lines[2]).toContain('"ORD-20261029-0002"')
      expect(lines[2]).toContain('"REFUNDED"')
      expect(lines[2]).toContain('"Salah input kasir"')
    })
  })
})
