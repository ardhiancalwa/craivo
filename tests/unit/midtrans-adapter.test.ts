import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getMidtransBaseUrl,
  getMidtransAuthHeader,
  formatMidtransOrderTime,
  chargeQris,
  getTransactionStatus,
  MidtransGatewayError,
  MidtransTimeoutError,
} from '@/lib/server/midtrans'

describe('Unit: Midtrans Core API Adapter (Sandbox Mode)', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  describe('Configuration & Auth Helpers', () => {
    it('mengembalikan URL Sandbox Midtrans ketika mode produksi false', () => {
      const baseUrl = getMidtransBaseUrl()
      expect(baseUrl).toBe('https://api.sandbox.midtrans.com')
    })

    it('menghasilkan Authorization Basic Auth header berbasis MIDTRANS_SERVER_KEY', () => {
      const authHeader = getMidtransAuthHeader()
      expect(authHeader.startsWith('Basic ')).toBe(true)

      const base64Part = authHeader.replace('Basic ', '')
      const decoded = Buffer.from(base64Part, 'base64').toString('utf-8')
      expect(decoded.endsWith(':')).toBe(true)
      expect(decoded.length).toBeGreaterThan(1)
    })

    it('memformat tanggal ke format Midtrans order_time (YYYY-MM-DD HH:mm:ss +0700)', () => {
      // 2026-10-29 10:30:00 UTC = 2026-10-29 17:30:00 WIB (+07:00)
      const testDate = new Date('2026-10-29T10:30:00Z')
      const formatted = formatMidtransOrderTime(testDate)

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+0700$/)
      expect(formatted).toContain('+0700')
      expect(formatted).toContain('2026-10-29 17:30:00')
    })
  })

  describe('chargeQris()', () => {
    it('mengirim payload sesuai spesifikasi Core API QRIS dan mengekstrak qrUrl serta qrString', async () => {
      const mockResponse = {
        status_code: '201',
        status_message: 'GoPay transaction is created',
        transaction_id: 'tx-sandbox-12345',
        order_id: 'SELA-261029-001-P1',
        gross_amount: '38000.00',
        currency: 'IDR',
        payment_type: 'qris',
        transaction_time: '2026-10-29 12:00:00',
        transaction_status: 'pending',
        qr_string: '00020101021226680016ID.CO.GOPAY.WWW0118936000000000000000',
        actions: [
          {
            name: 'generate-qr-code',
            method: 'GET',
            url: 'https://api.sandbox.midtrans.com/v2/qris/tx-sandbox-12345/qr-code',
          },
        ],
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 201,
        json: async () => mockResponse,
      } as Response)

      const result = await chargeQris({
        orderId: 'SELA-261029-001-P1',
        grossAmount: 38000,
        expiryMinutes: 15,
      })

      expect(globalThis.fetch).toHaveBeenCalledTimes(1)
      const [calledUrl, calledInit] = (globalThis.fetch as any).mock.calls[0]

      expect(calledUrl).toBe('https://api.sandbox.midtrans.com/v2/charge')
      expect(calledInit.method).toBe('POST')

      const body = JSON.parse(calledInit.body)
      expect(body.payment_type).toBe('qris')
      expect(body.transaction_details.order_id).toBe('SELA-261029-001-P1')
      expect(body.transaction_details.gross_amount).toBe(38000)
      expect(body.qris.acquirer).toBe('gopay')
      expect(body.custom_expiry.expiry_duration).toBe(15)
      expect(body.custom_expiry.unit).toBe('minute')

      expect(result.statusCode).toBe('201')
      expect(result.transactionId).toBe('tx-sandbox-12345')
      expect(result.qrString).toBe(mockResponse.qr_string)
      expect(result.qrUrl).toBe('https://api.sandbox.midtrans.com/v2/qris/tx-sandbox-12345/qr-code')
    })

    it('melempar MidtransGatewayError bila status_code bukan 201/200', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 400,
        json: async () => ({
          status_code: '400',
          status_message: 'Validation Error: gross_amount is required',
        }),
      } as Response)

      await expect(
        chargeQris({
          orderId: 'SELA-ERR',
          grossAmount: 0,
        })
      ).rejects.toThrow(MidtransGatewayError)
    })

    it('melempar MidtransTimeoutError ketika request network timeout atau abort', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      globalThis.fetch = vi.fn().mockRejectedValue(abortError)

      await expect(
        chargeQris({
          orderId: 'SELA-TIMEOUT-TEST',
          grossAmount: 50000,
        })
      ).rejects.toThrow(MidtransTimeoutError)
    })
  })

  describe('getTransactionStatus()', () => {
    it('mengambil status transaksi sukses dari Midtrans GET /v2/{order_id}/status', async () => {
      const mockStatus = {
        status_code: '200',
        status_message: 'Success, transaction is found',
        transaction_id: 'tx-sandbox-12345',
        order_id: 'SELA-261029-001-P1',
        gross_amount: '38000.00',
        payment_type: 'qris',
        transaction_status: 'settlement',
        transaction_time: '2026-10-29 12:00:00',
      }

      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 200,
        json: async () => mockStatus,
      } as Response)

      const result = await getTransactionStatus('SELA-261029-001-P1')

      expect(result.notFound).toBe(false)
      expect(result.transactionStatus).toBe('settlement')
      expect(result.grossAmount).toBe(38000)
    })

    it('mengembalikan notFound: true jika transaksi belum tercatat (status 404)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        status: 404,
        json: async () => ({
          status_code: '404',
          status_message: "Transaction doesn't exist.",
        }),
      } as Response)

      const result = await getTransactionStatus('SELA-NOT-FOUND')

      expect(result.notFound).toBe(true)
      expect(result.statusCode).toBe('404')
      expect(result.transactionStatus).toBe('not_found')
    })
  })
})

