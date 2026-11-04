// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'

// Mocks
vi.mock('@/lib/server/db', () => ({
  prisma: {
    $transaction: vi.fn(async (ops) => {
      if (Array.isArray(ops)) return Promise.all(ops)
      if (typeof ops === 'function') return ops(prisma)
      return ops
    }),
    table: {
      findFirst: vi.fn(),
    },
    guestSession: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/server/storage-service', () => ({
  saveMenuImage: vi.fn(),
}))

function createMockPngBuffer(width = 800, height = 600): Buffer {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(25)
  ihdr.writeUInt32BE(13, 0)
  ihdr.write('IHDR', 4, 'ascii')
  ihdr.writeUInt32BE(width, 8)
  ihdr.writeUInt32BE(height, 12)
  ihdr[16] = 8
  ihdr[17] = 2
  return Buffer.concat([header, ihdr])
}

import { prisma } from '@/lib/server/db'
import { ensureGuestSessionForTable } from '@/lib/server/guest-session'
import { POST as uploadProofPost } from '@/app/api/orders/[id]/payment-proof/route'
import { saveMenuImage } from '@/lib/server/storage-service'

describe('Guest Session Auto-Recovery & Payment Proof Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('ensureGuestSessionForTable', () => {
    it('creates a new guest session when no valid session exists but table is active in DB', async () => {
      vi.mocked(prisma.table.findFirst).mockResolvedValueOnce({
        id: 'table-uuid-1',
        tableNumber: 'T-05',
        qrSlug: 'slug-t05',
        isActive: true,
        label: 'Meja 5',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any)

      vi.mocked(prisma.guestSession.create).mockResolvedValueOnce({
        id: 'session-uuid-new',
        sessionToken: 'hashed-session-token',
        tableId: 'table-uuid-1',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12),
        table: {
          id: 'table-uuid-1',
          tableNumber: 'T-05',
          qrSlug: 'slug-t05',
          isActive: true,
          label: 'Meja 5',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as any)

      // Request without any guest cookie
      const req = new NextRequest('http://localhost:3000/api/orders')
      const result = await ensureGuestSessionForTable('T-05', req, '127.0.0.1', 'Mozilla/5.0')

      expect(result).not.toBeNull()
      expect(result?.isNewSession).toBe(true)
      expect(result?.rawSessionToken).toBeTruthy()
      expect(result?.session.table.tableNumber).toBe('T-05')
      expect(prisma.guestSession.create).toHaveBeenCalledTimes(1)
    })

    it('returns null when tableNumber does not exist in DB', async () => {
      vi.mocked(prisma.table.findFirst).mockResolvedValueOnce(null)

      const req = new NextRequest('http://localhost:3000/api/orders')
      const result = await ensureGuestSessionForTable('T-999', req)

      expect(result).toBeNull()
      expect(prisma.guestSession.create).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/orders/[id]/payment-proof', () => {
    it('rejects upload when CSRF origin is invalid', async () => {
      const formData = new FormData()
      formData.append('file', new Blob(['fake image'], { type: 'image/png' }), 'proof.png')

      const req = new NextRequest('http://localhost:3000/api/orders/order-123/payment-proof', {
        method: 'POST',
        body: formData,
        headers: {
          host: 'localhost:3000',
          origin: 'http://malicious-site.com',
          'x-order-secret-token': 'test-token',
        },
      })

      const res = await uploadProofPost(req, {
        params: Promise.resolve({ id: 'order-123' }),
      })

      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('CSRF_REJECTED')
    })

    it('rejects upload when order does not exist or secret token does not match', async () => {
      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce(null)

      const pngBuffer = createMockPngBuffer(800, 600)
      const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', blob, 'proof.png')

      const req = new NextRequest('http://localhost:3000/api/orders/order-123/payment-proof', {
        method: 'POST',
        body: formData,
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'x-order-secret-token': 'wrong-secret',
        },
      })

      const res = await uploadProofPost(req, {
        params: Promise.resolve({ id: 'order-123' }),
      })

      expect(res.status).toBe(404)
    })

    it('successfully uploads valid image proof and updates order', async () => {
      const secretToken = 'valid-secret-123'
      const secretHash = crypto.createHash('sha256').update(secretToken).digest('hex')

      vi.mocked(prisma.order.findUnique).mockResolvedValueOnce({
        id: 'order-uuid-1',
        orderNumber: 'CRV-001',
        orderSecretTokenHash: secretHash,
        paymentMethod: 'MANUAL_QRIS',
        paymentStatus: 'UNPAID',
        status: 'WAITING_CASHIER',
        table: {
          tableNumber: 'T-01',
        },
      } as any)

      vi.mocked(saveMenuImage).mockResolvedValueOnce({
        url: '/uploads/menu/proof-123.webp',
        filename: 'proof-123.webp',
        mimeType: 'image/webp',
        size: 1024,
        width: 800,
        height: 600,
      })

      vi.mocked(prisma.order.update).mockResolvedValueOnce({
        id: 'order-uuid-1',
        paymentProofUrl: '/uploads/menu/proof-123.webp',
      } as any)

      const pngBuffer = createMockPngBuffer(800, 600)
      const blob = new Blob([new Uint8Array(pngBuffer)], { type: 'image/png' })

      const formData = new FormData()
      formData.append('file', blob, 'proof.png')

      const req = new NextRequest('http://localhost:3000/api/orders/order-uuid-1/payment-proof', {
        method: 'POST',
        body: formData,
        headers: {
          host: 'localhost:3000',
          origin: 'http://localhost:3000',
          'x-order-secret-token': secretToken,
        },
      })

      const res = await uploadProofPost(req, {
        params: Promise.resolve({ id: 'order-uuid-1' }),
      })

      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.paymentProofUrl).toBe('/uploads/menu/proof-123.webp')
      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-uuid-1' },
        data: { paymentProofUrl: '/uploads/menu/proof-123.webp' },
      })
      expect(prisma.auditLog.create).toHaveBeenCalled()
    })
  })
})
