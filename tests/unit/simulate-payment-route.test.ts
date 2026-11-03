// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/server/order-access', () => ({
  extractOrderSecretToken: vi.fn(),
  verifyOrderAccess: vi.fn(),
  OrderAccessError: class OrderAccessError extends Error {
    statusCode: number
    code: string
    constructor(code: string, message: string, statusCode = 403) {
      super(message)
      this.name = 'OrderAccessError'
      this.code = code
      this.statusCode = statusCode
    }
  },
}))

vi.mock('@/lib/server/db', () => ({
  prisma: {
    paymentAttempt: {
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server/midtrans', () => ({
  simulateSandboxQrisPayment: vi.fn(),
  MidtransGatewayError: class MidtransGatewayError extends Error {
    statusCode: number
    midtransCode?: string
    constructor(message: string, statusCode = 502, midtransCode?: string) {
      super(message)
      this.name = 'MidtransGatewayError'
      this.statusCode = statusCode
      this.midtransCode = midtransCode
    }
  },
}))

vi.mock('@/lib/server/payment-service', () => ({
  checkAndUpdatePaymentStatus: vi.fn(),
}))

const mockGetServerEnv = vi.fn()
vi.mock('@/lib/server/env', () => ({
  getServerEnv: () => mockGetServerEnv(),
}))

import { POST } from '@/app/api/orders/[id]/pay/simulate/route'
import { extractOrderSecretToken, verifyOrderAccess } from '@/lib/server/order-access'
import { prisma } from '@/lib/server/db'
import { simulateSandboxQrisPayment } from '@/lib/server/midtrans'
import { checkAndUpdatePaymentStatus } from '@/lib/server/payment-service'

describe('Route Handler: POST /api/orders/[id]/pay/simulate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServerEnv.mockReturnValue({
      MIDTRANS_IS_PRODUCTION: false,
    })
  })

  it('menolak request dengan 403 Forbidden bila berada di environment produksi', async () => {
    mockGetServerEnv.mockReturnValueOnce({
      MIDTRANS_IS_PRODUCTION: true,
    })

    const req = new NextRequest('http://localhost:3000/api/orders/order-123/pay/simulate', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'order-123' }) })
    const json = await res.json()

    expect(res.status).toBe(403)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN_IN_PRODUCTION')
  })

  it('mengembalikan status sukses langsung jika pesanan sudah PAID', async () => {
    vi.mocked(extractOrderSecretToken).mockResolvedValueOnce('valid-token')
    vi.mocked(verifyOrderAccess).mockResolvedValueOnce({
      id: 'order-123',
      paymentStatus: 'PAID',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/orders/order-123/pay/simulate', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'order-123' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.message).toContain('sudah berstatus lunas')
  })

  it('mengembalikan 400 Bad Request jika tidak ada QRIS attempt aktif', async () => {
    vi.mocked(extractOrderSecretToken).mockResolvedValueOnce('valid-token')
    vi.mocked(verifyOrderAccess).mockResolvedValueOnce({
      id: 'order-123',
      paymentStatus: 'PENDING',
    } as any)
    vi.mocked(prisma.paymentAttempt.findFirst).mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost:3000/api/orders/order-123/pay/simulate', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'order-123' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('NO_ACTIVE_QRIS')
  })

  it('berhasil memanggil simulateSandboxQrisPayment dan checkAndUpdatePaymentStatus', async () => {
    vi.mocked(extractOrderSecretToken).mockResolvedValueOnce('valid-token')
    vi.mocked(verifyOrderAccess).mockResolvedValueOnce({
      id: 'order-123',
      paymentStatus: 'PENDING',
    } as any)
    vi.mocked(prisma.paymentAttempt.findFirst).mockResolvedValueOnce({
      id: 'attempt-1',
      qrisUrl: 'https://api.sandbox.midtrans.com/v2/qris/test/qr-code',
      status: 'PENDING',
    } as any)
    vi.mocked(simulateSandboxQrisPayment).mockResolvedValueOnce({ success: true })
    vi.mocked(checkAndUpdatePaymentStatus).mockResolvedValueOnce({
      paymentStatus: 'PAID',
      orderStatus: 'QUEUED',
      orderNumber: 'SELA-01-001',
    } as any)

    const req = new NextRequest('http://localhost:3000/api/orders/order-123/pay/simulate', {
      method: 'POST',
    })

    const res = await POST(req, { params: Promise.resolve({ id: 'order-123' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(simulateSandboxQrisPayment).toHaveBeenCalledWith('https://api.sandbox.midtrans.com/v2/qris/test/qr-code')
    expect(checkAndUpdatePaymentStatus).toHaveBeenCalledWith('order-123', 'valid-token')
    expect(json.data.paymentStatus).toBe('PAID')
  })
})
