// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest'
import { prisma } from '@/lib/server/db'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'
import { createOrderFromQuote } from '@/lib/server/order-service'
import { claimIdempotencyKey } from '@/lib/server/idempotency'
import crypto from 'node:crypto'

describe('Tahap 22: Stress & Volume Testing (50 Sekuensial & 10 Konkuren)', () => {
  let tableId: string
  let menuItemId: string
  let selectedModifierOptionIds: string[] = []

  beforeAll(async () => {
    const table = await prisma.table.findUniqueOrThrow({ where: { tableNumber: '07' } })
    tableId = table.id

    const item = await prisma.menuItem.findFirstOrThrow({
      where: { isAvailable: true, isArchived: false, category: { slug: 'kopi' } },
      include: {
        modifierGroups: {
          include: {
            group: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    })
    menuItemId = item.id

    selectedModifierOptionIds = item.modifierGroups
      .filter((mg) => mg.group.isRequired)
      .map((mg) => mg.group.options[0]?.id)
      .filter((id): id is string => Boolean(id))
  })

  it('1. Eksekusi 50 Transaksi Sekuensial: Setiap transaksi menghasilkan order number unik & status konsisten', async () => {
    const totalTransactions = 50
    const orderNumbers: string[] = []
    const startTime = Date.now()

    for (let i = 0; i < totalTransactions; i++) {
      const session = await createGuestSession(tableId)
      const quote = await createOrderQuote({
        tableNumber: '07',
        guestSessionId: session.id,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds }],
      })

      const idemKey = crypto.randomUUID()
      const claim = await claimIdempotencyKey({
        key: idemKey,
        scope: 'CREATE_ORDER',
        ownerId: session.id,
        requestHash: crypto.randomBytes(16).toString('hex'),
      })

      const res = await createOrderFromQuote({
        tableNumber: '07',
        paymentMethod: i % 2 === 0 ? 'QRIS' : 'CASH',
        quoteToken: quote.quoteToken,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds }],
        guestSessionId: session.id,
        idempotencyRecordId: claim.record.id,
      })

      expect(res.order.orderId).toBeDefined()
      expect(res.order.orderNumber).toMatch(/^[A-Z0-9]{4}-\d{6}-\d{3,}$/)
      orderNumbers.push(res.order.orderNumber)
    }

    const duration = Date.now() - startTime
    console.log(`[STRESS TEST] 50 Transaksi Sekuensial selesai dalam ${duration}ms (rata-rata ${(duration / totalTransactions).toFixed(1)}ms/order)`)

    // Verifikasi keunikan mutlak (0 duplicate)
    const uniqueOrders = new Set(orderNumbers)
    expect(uniqueOrders.size).toBe(totalTransactions)
  }, 120000)

  it('2. Eksekusi 10 Pesanan Bersamaan (Concurrent Orders): Penanganan jitter & isolasi tanpa tabrakan P2002', async () => {
    const concurrentCount = 10

    const promises = Array.from({ length: concurrentCount }).map(async (_, idx) => {
      const session = await createGuestSession(tableId)
      const quote = await createOrderQuote({
        tableNumber: '07',
        guestSessionId: session.id,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds }],
      })

      const idemKey = crypto.randomUUID()
      const claim = await claimIdempotencyKey({
        key: idemKey,
        scope: 'CREATE_ORDER',
        ownerId: session.id,
        requestHash: `hash_concurrent_stress_${idx}_${Date.now()}`,
      })

      return createOrderFromQuote({
        tableNumber: '07',
        paymentMethod: 'CASH',
        quoteToken: quote.quoteToken,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds }],
        guestSessionId: session.id,
        idempotencyRecordId: claim.record.id,
      })
    })

    const results = await Promise.all(promises)
    expect(results).toHaveLength(concurrentCount)

    const orderNumbers = results.map((r) => r.order.orderNumber)
    const uniqueNumbers = new Set(orderNumbers)
    expect(uniqueNumbers.size).toBe(concurrentCount)
  }, 60000)

  it('3. Rekonsiliasi Konsistensi Data: Verifikasi integritas order, item, dan status di DB', async () => {
    // Ambil order terbaru yang dibuat di test ini
    const sampleOrders = await prisma.order.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    })

    for (const order of sampleOrders) {
      expect(order.subtotalAmount).toBeGreaterThan(0)
      expect(order.totalAmount).toBeGreaterThan(0)
      expect(order.items.length).toBeGreaterThan(0)
      expect(Number.isInteger(order.totalAmount)).toBe(true)
    }
  })
})

