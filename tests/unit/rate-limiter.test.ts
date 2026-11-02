// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import crypto from 'node:crypto'
import prisma from '@/lib/server/db'
import {
  consumeRateLimit,
  checkGuestCheckoutRateLimit,
  checkStaffLoginRateLimit,
} from '@/lib/server/rate-limiter'

describe('Multi-Instance Database Rate Limiter (SEC-02)', () => {
  const testKeys: string[] = []

  const getUniqueKey = (prefix: string) => {
    const k = `${prefix}:${crypto.randomUUID()}`
    testKeys.push(k)
    return k
  }

  afterAll(async () => {
    if (testKeys.length > 0) {
      await prisma.rateLimitRecord.deleteMany({
        where: { key: { in: testKeys } },
      }).catch(() => {})
    }
  })

  it('allows requests within limit and decrements remaining points', async () => {
    const key = getUniqueKey('test:rate:basic')

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
    const key = getUniqueKey('test:rate:blocked')

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
    const key = getUniqueKey('test:rate:expire')

    // Set record buatan yang sudah kedaluwarsa
    await prisma.rateLimitRecord.create({
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
    testKeys.push(`guest:checkout:sess:${testSessionId}`)

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
    testKeys.push(`staff:login:ip:${testIp}`)

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
