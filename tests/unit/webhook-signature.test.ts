import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  verifyMidtransSignature,
  parseAndValidateIdrAmount,
} from '@/lib/server/midtrans'

describe('Unit: Midtrans Webhook Signature & Money Parser', () => {
  const serverKey = 'SB-Mid-server-test-secret-key-12345'
  const orderId = 'SELA-261029-001-P1-abc1'
  const statusCode = '200'
  const grossAmount = '38000.00'

  function computeValidSignature(
    oid: string,
    sc: string,
    amt: string,
    sk: string
  ): string {
    const raw = `${oid}${sc}${amt}${sk}`
    return crypto.createHash('sha512').update(raw).digest('hex')
  }

  describe('verifyMidtransSignature()', () => {
    it('memvalidasi signature SHA-512 yang valid dengan string asli', () => {
      const validSig = computeValidSignature(orderId, statusCode, grossAmount, serverKey)

      const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: validSig,
        serverKey,
      })

      expect(isValid).toBe(true)
    })

    it('memvalidasi signature case-insensitive (huruf besar/kecil)', () => {
      const validSig = computeValidSignature(orderId, statusCode, grossAmount, serverKey)

      const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: validSig.toUpperCase(),
        serverKey,
      })

      expect(isValid).toBe(true)
    })

    it('menolak signature yang salah walau hanya beda 1 karakter', () => {
      const validSig = computeValidSignature(orderId, statusCode, grossAmount, serverKey)
      // Ganti karakter terakhir
      const tamperedSig = validSig.slice(0, -1) + (validSig.endsWith('a') ? 'b' : 'a')

      const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: tamperedSig,
        serverKey,
      })

      expect(isValid).toBe(false)
    })

    it('menolak signature dengan panjang berbeda tanpa melempar error', () => {
      const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount,
        signatureKey: 'short-invalid-sig',
        serverKey,
      })

      expect(isValid).toBe(false)
    })

    it('gagal jika gross_amount diubah walau hanya menambahkan .00 jika hash aslinya tanpa .00', () => {
      const sigWithoutDecimals = computeValidSignature(orderId, statusCode, '38000', serverKey)

      // Verifikasi menggunakan '38000.00' terhadap hash '38000'
      const isValid = verifyMidtransSignature({
        orderId,
        statusCode,
        grossAmount: '38000.00',
        signatureKey: sigWithoutDecimals,
        serverKey,
      })

      expect(isValid).toBe(false)
    })
  })

  describe('parseAndValidateIdrAmount()', () => {
    it('menerima format integer IDR tanpa desimal', () => {
      expect(parseAndValidateIdrAmount('38000')).toBe(38000)
      expect(parseAndValidateIdrAmount('150000')).toBe(150000)
    })

    it('menerima format integer IDR dengan desimal .00', () => {
      expect(parseAndValidateIdrAmount('38000.00')).toBe(38000)
      expect(parseAndValidateIdrAmount('28000.00')).toBe(28000)
    })

    it('menolak desimal pecahan tidak sah (seperti .50 atau .99) untuk mencegah integer truncate exploit', () => {
      expect(() => parseAndValidateIdrAmount('38000.50')).toThrow(
        /pecahan desimal tidak diperkenankan/
      )
      expect(() => parseAndValidateIdrAmount('38000.99')).toThrow(
        /pecahan desimal tidak diperkenankan/
      )
      expect(() => parseAndValidateIdrAmount('38000.1')).toThrow(
        /pecahan desimal tidak diperkenankan/
      )
    })

    it('menolak nominal negatif, nol, atau bukan angka', () => {
      expect(() => parseAndValidateIdrAmount('0')).toThrow(/integer positif/)
      expect(() => parseAndValidateIdrAmount('-38000')).toThrow(/tidak sah/)
      expect(() => parseAndValidateIdrAmount('abc')).toThrow(/tidak sah/)
      expect(() => parseAndValidateIdrAmount('38,000')).toThrow(/tidak sah/)
    })
  })
})

