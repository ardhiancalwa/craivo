// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'

interface MockRecord {
  id: string
  key: string
  points: number
  expireAt: Date
  createdAt: Date
  updatedAt: Date
}

const { mockStore, mockRateLimitRecord } = vi.hoisted(() => {
  const store = new Map<string, MockRecord>()

  const record = {
    findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
      const item = store.get(where.key)
      if (!item) return null
      return { ...item }
    }),

    create: vi.fn(async ({ data }: { data: { key: string; points: number; expireAt: Date } }) => {
      const rec: MockRecord = {
        id: `mock-rec-${Math.random()}`,
        key: data.key,
        points: data.points,
        expireAt: new Date(data.expireAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      store.set(data.key, rec)
      return { ...rec }
    }),

    update: vi.fn(async ({ where, data }: {
      where: { key: string }
      data: {
        points?: number | { increment?: number }
        expireAt?: Date
      }
    }) => {
      const existing = store.get(where.key)
      if (!existing) {
        throw new Error(`Record with key ${where.key} not found`)
      }

      let newPoints = existing.points
      if (typeof data.points === 'number') {
        newPoints = data.points
      } else if (data.points && typeof data.points === 'object' && typeof data.points.increment === 'number') {
        newPoints += data.points.increment
      }

      const updated: MockRecord = {
        ...existing,
        points: newPoints,
        expireAt: data.expireAt ? new Date(data.expireAt) : existing.expireAt,
        updatedAt: new Date(),
      }
      store.set(where.key, updated)
      return { ...updated }
    }),

    deleteMany: vi.fn(async ({ where }: { where?: { key?: { in?: string[] } } }) => {
      if (where?.key?.in) {
        for (const k of where.key.in) {
          store.delete(k)
        }
      } else {
        store.clear()
      }
      return { count: 1 }
    }),
  }

  return { mockStore: store, mockRateLimitRecord: record }
})

vi.mock('@/lib/server/db', () => ({
  default: {
    rateLimitRecord: mockRateLimitRecord,
  },
  prisma: {
    rateLimitRecord: mockRateLimitRecord,
  },
}))

import {
  consumeRateLimit,
  checkGuestCheckoutRateLimit,
  checkStaffLoginRateLimit,
} from '@/lib/server/rate-limiter'

describe('Multi-Instance Database Rate Limiter (SEC-02 - Unit Tests with In-Memory Mock)', () => {
  beforeEach(() => {
    mockStore.clear()
    vi.clearAllMocks()
  })

  it('allows requests within limit and decrements remaining points', async () => {
    const key = `test:rate:basic:${crypto.randomUUID()}`

    const r1 = await consumeRateLimit({ key, limit: 3, windowSeconds: 60 })
    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(2)
    expect(r1.points).toBe(1)

    const r2 = await consumeRateLimit({ key, limit: 3, windowSeconds: 60 })
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(1)
    expect(r2.points).toBe(2)

    const r3 = await consumeRateLimit({ key, limit: 3, windowSeconds: 60 })
    expect(r3.allowed).toBe(true)
    expect(r3.remaining).toBe(0)
    expect(r3.points).toBe(3)
  })

  it('blocks requests once limit is exceeded and returns resetSeconds', async () => {
    const key = `test:rate:blocked:${crypto.randomUUID()}`

    // Habiskan kuota (limit: 2)
    await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })
    await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })

    // Permintaan ke-3 wajib ditolak
    const r3 = await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })
    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
    expect(r3.resetSeconds).toBeGreaterThan(0)
  })

  it('resets points when window expires', async () => {
    const key = `test:rate:expire:${crypto.randomUUID()}`

    // Set record buatan yang sudah kedaluwarsa
    await mockRateLimitRecord.create({
      data: {
        key,
        points: 5,
        expireAt: new Date(Date.now() - 1000), // Sudah lewat 1 detik
      },
    })

    const result = await consumeRateLimit({ key, limit: 3, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.points).toBe(1)
    expect(result.remaining).toBe(2)
  })

  it('enforces guest checkout rate limit per guestSessionId', async () => {
    const testSessionId = `sess_test_${crypto.randomUUID()}`

    // 12 pemesanan berturut-turut diizinkan
    for (let i = 0; i < 12; i++) {
      const res = await checkGuestCheckoutRateLimit(testSessionId)
      expect(res.allowed).toBe(true)
    }

    // Pemesanan ke-13 wajib ditolak
    const blockedRes = await checkGuestCheckoutRateLimit(testSessionId)
    expect(blockedRes.allowed).toBe(false)
    expect(blockedRes.message).toContain('Terlalu banyak permintaan pemesanan')
    expect(blockedRes.resetSeconds).toBeGreaterThan(0)
  })

  it('enforces staff login rate limit per IP address', async () => {
    const testIp = `192.168.100.${Math.floor(Math.random() * 200) + 10}`

    // 15 percobaan pertama diizinkan
    for (let i = 0; i < 15; i++) {
      const res = await checkStaffLoginRateLimit(testIp)
      expect(res.allowed).toBe(true)
    }

    // Percobaan ke-16 wajib ditolak
    const blocked = await checkStaffLoginRateLimit(testIp)
    expect(blocked.allowed).toBe(false)
    expect(blocked.message).toContain('Terlalu banyak percobaan login')
  })
})
