// @vitest-environment node
import { describe, it, expect, afterAll } from 'vitest'
import crypto from 'node:crypto'
import prisma from '@/lib/server/db'
import {
  consumeRateLimit,
  checkGuestCheckoutRateLimit,
  checkStaffLoginRateLimit,
} from '@/lib/server/rate-limiter'

describe('Database Rate Limiter Integration (SEC-02 - Live/Staging DB)', () => {
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

  it('allows requests within limit and decrements remaining points on live database', async () => {
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

  it('blocks requests once limit is exceeded and returns resetSeconds on live database', async () => {
    const key = getUniqueKey('test:rate:blocked')

    await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })
    await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })

    const r3 = await consumeRateLimit({ key, limit: 2, windowSeconds: 60 })
    expect(r3.allowed).toBe(false)
    expect(r3.remaining).toBe(0)
    expect(r3.resetSeconds).toBeGreaterThan(0)
  })

  it('resets points when window expires on live database', async () => {
    const key = getUniqueKey('test:rate:expire')

    await prisma.rateLimitRecord.create({
      data: {
        key,
        points: 5,
        expireAt: new Date(Date.now() - 1000),
      },
    })

    const result = await consumeRateLimit({ key, limit: 3, windowSeconds: 60 })
    expect(result.allowed).toBe(true)
    expect(result.points).toBe(1)
    expect(result.remaining).toBe(2)
  })
})

