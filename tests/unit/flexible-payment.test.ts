// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/server/auth-guard', () => ({
  requireStaffRole: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number
    code: string
    constructor(message: string, status = 401, code = 'UNAUTHORIZED') {
      super(message)
      this.name = 'AuthError'
      this.status = status
      this.code = code
    }
  },
}))

vi.mock('@/lib/server/csrf', () => ({
  verifyCsrfOrigin: vi.fn(),
}))

vi.mock('@/lib/server/config-service', () => ({
  getCafeConfig: vi.fn(),
  updatePaymentMethodsConfig: vi.fn(),
}))

import { GET as getAdminPaymentConfig, PUT as updateAdminPaymentConfig } from '@/app/api/staff/admin/config/payment/route'
import { GET as getPublicPaymentMethods } from '@/app/api/config/payment-methods/route'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { getCafeConfig, updatePaymentMethodsConfig } from '@/lib/server/config-service'

describe('Flexible Payment Methods Route Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCsrfOrigin).mockReturnValue(true)
  })

  describe('GET /api/staff/admin/config/payment', () => {
    it('menolak akses jika bukan ADMIN', async () => {
      vi.mocked(requireStaffRole).mockRejectedValueOnce(
        new AuthError('Akses ditolak: Hanya ADMIN yang diizinkan.', 403, 'FORBIDDEN')
      )

      const req = new NextRequest('http://localhost:3000/api/staff/admin/config/payment')
      const res = await getAdminPaymentConfig(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('FORBIDDEN')
    })

    it('mengembalikan status metode pembayaran kafe', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        role: 'ADMIN',
      } as any)

      vi.mocked(getCafeConfig).mockResolvedValueOnce({
        id: 'main',
        name: 'Cravio Cafe',
        enableMidtransQris: true,
        enableCash: true,
        enableManualQris: false,
        manualQrisImageUrl: null,
        manualQrisName: null,
        enableManualTransfer: true,
        manualTransferBank: 'BCA',
        manualTransferAccount: '1234567890',
        manualTransferName: 'Cravio Roastery',
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/config/payment')
      const res = await getAdminPaymentConfig(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.enableMidtransQris).toBe(true)
      expect(json.data.enableManualTransfer).toBe(true)
      expect(json.data.manualTransferBank).toBe('BCA')
    })
  })

  describe('PUT /api/staff/admin/config/payment', () => {
    it('menolak jika CSRF tidak valid', async () => {
      vi.mocked(verifyCsrfOrigin).mockReturnValueOnce(false)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/config/payment', {
        method: 'PUT',
        body: JSON.stringify({ enableCash: true }),
      })

      const res = await updateAdminPaymentConfig(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('CSRF_REJECTED')
    })

    it('memperbarui konfigurasi metode pembayaran yang valid', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        role: 'ADMIN',
      } as any)

      vi.mocked(getCafeConfig).mockResolvedValueOnce({
        enableMidtransQris: true,
        enableCash: true,
        enableManualQris: false,
        enableManualTransfer: false,
      } as any)

      vi.mocked(updatePaymentMethodsConfig).mockResolvedValueOnce({
        id: 'main',
        enableMidtransQris: false,
        enableCash: true,
        enableManualQris: true,
        manualQrisName: 'QRIS BCA Cravio',
        manualQrisImageUrl: 'https://images.cravio.id/qris.png',
        enableManualTransfer: false,
        manualTransferBank: null,
        manualTransferAccount: null,
        manualTransferName: null,
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/config/payment', {
        method: 'PUT',
        body: JSON.stringify({
          enableMidtransQris: false,
          enableCash: true,
          enableManualQris: true,
          manualQrisName: 'QRIS BCA Cravio',
          manualQrisImageUrl: 'https://images.cravio.id/qris.png',
        }),
      })

      const res = await updateAdminPaymentConfig(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(updatePaymentMethodsConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          enableMidtransQris: false,
          enableCash: true,
          enableManualQris: true,
          manualQrisName: 'QRIS BCA Cravio',
        }),
        expect.anything(),
        expect.anything()
      )
    })
  })

  describe('GET /api/config/payment-methods (Customer Public Endpoint)', () => {
    it('mengembalikan status metode pembayaran yang dapat dibaca checkout pelanggan', async () => {
      vi.mocked(getCafeConfig).mockResolvedValueOnce({
        id: 'main',
        enableMidtransQris: true,
        enableCash: false,
        enableManualQris: true,
        manualQrisName: 'QRIS Toko Cravio',
        manualQrisImageUrl: 'https://example.com/qris.jpg',
        enableManualTransfer: false,
        manualTransferBank: null,
        manualTransferAccount: null,
        manualTransferName: null,
      } as any)

      const res = await getPublicPaymentMethods()
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.enableMidtransQris).toBe(true)
      expect(json.data.enableManualQris).toBe(true)
      expect(json.data.manualQrisName).toBe('QRIS Toko Cravio')
      expect(json.data.enableCash).toBe(false)
      expect(json.data.enableManualTransfer).toBe(false)
    })
  })
})
