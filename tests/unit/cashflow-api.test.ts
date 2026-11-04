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

vi.mock('@/lib/server/cashflow-service', () => ({
  getCashflowSummary: vi.fn(),
  updateCashflowProfile: vi.fn(),
}))

import { GET, PUT } from '@/app/api/staff/admin/cashflow/route'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { getCashflowSummary, updateCashflowProfile } from '@/lib/server/cashflow-service'

describe('Route Handler: /api/staff/admin/cashflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(verifyCsrfOrigin).mockReturnValue(true)
  })

  describe('GET /api/staff/admin/cashflow', () => {
    it('menolak akses dengan 401/403 jika pengguna bukan role ADMIN', async () => {
      vi.mocked(requireStaffRole).mockRejectedValueOnce(
        new AuthError('Hanya role ADMIN yang diizinkan mengakses arus kas.', 403, 'FORBIDDEN')
      )

      const req = new NextRequest('http://localhost:3000/api/staff/admin/cashflow')
      const res = await GET(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('FORBIDDEN')
    })

    it('mengembalikan ringkasan arus kas jika diautentikasi sebagai ADMIN', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      const mockSummary = {
        profile: {
          periodName: 'Nov 2026',
          initialCapital: 50000000,
          rawMaterialCost: 15000000,
          operationalCost: 4500000,
          overheadCost: 6000000,
          salaryStaff: 8000000,
          salaryOwner: 4000000,
          targetProductionQty: 1500,
          shareLossPercentage: 5,
          sellingPricePerUnit: 28000,
        },
        metrics: {
          hppBahanPerUnit: 10500,
          hppFullCostingPerUnit: 25500,
          endingCashBalance: 52000000,
        },
        realized: {
          realizedRevenue: 40000000,
          realizedPaidOrders: 120,
        },
      }

      vi.mocked(getCashflowSummary).mockResolvedValueOnce(mockSummary as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/cashflow')
      const res = await GET(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.data.profile.initialCapital).toBe(50000000)
      expect(json.data.metrics.hppBahanPerUnit).toBe(10500)
    })
  })

  describe('PUT /api/staff/admin/cashflow', () => {
    it('menolak request jika CSRF origin tidak sah', async () => {
      vi.mocked(verifyCsrfOrigin).mockReturnValueOnce(false)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/cashflow', {
        method: 'PUT',
        body: JSON.stringify({}),
      })

      const res = await PUT(req)
      const json = await res.json()

      expect(res.status).toBe(403)
      expect(json.error).toBe('CSRF_REJECTED')
    })

    it('menolak payload dengan nilai negatif atau kuantitas nol via Zod validation', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      const invalidPayload = {
        initialCapital: -5000, // Negatif
        rawMaterialCost: 15000000,
        operationalCost: 4500000,
        overheadCost: 6000000,
        salaryStaff: 8000000,
        salaryOwner: 4000000,
        targetProductionQty: 0, // Min 1
        shareLossPercentage: 5,
        sellingPricePerUnit: 28000,
      }

      const req = new NextRequest('http://localhost:3000/api/staff/admin/cashflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      })

      const res = await PUT(req)
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('berhasil memvalidasi dan memperbarui parameter arus kas dengan data sah', async () => {
      vi.mocked(requireStaffRole).mockResolvedValueOnce({
        sub: 'admin-1',
        username: 'hendra_admin',
        role: 'ADMIN',
      } as any)

      const validPayload = {
        periodName: 'Desember 2026',
        initialCapital: 60000000,
        rawMaterialCost: 18000000,
        operationalCost: 5000000,
        overheadCost: 6500000,
        salaryStaff: 9000000,
        salaryOwner: 5000000,
        targetProductionQty: 1800,
        shareLossPercentage: 4.5,
        sellingPricePerUnit: 30000,
        notes: 'Target peak season akhir tahun',
      }

      vi.mocked(updateCashflowProfile).mockResolvedValueOnce({
        profile: validPayload,
      } as any)

      const req = new NextRequest('http://localhost:3000/api/staff/admin/cashflow', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload),
      })

      const res = await PUT(req)
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(updateCashflowProfile).toHaveBeenCalled()
    })
  })
})
