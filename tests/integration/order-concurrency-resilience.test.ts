// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'
import { createOrderFromQuote } from '@/lib/server/order-service'
import { claimIdempotencyKey } from '@/lib/server/idempotency'

describe('Order Number Concurrency & Jitter Resilience (CON-01)', () => {
  let tableId: string
  let menuItemId: string
  let requiredModifierOptionIds: string[] = []
  const createdGuestSessionIds: string[] = []
  const createdOrderIds: string[] = []
  const createdIdempotencyKeys: string[] = []

  beforeAll(async () => {
    // Ambil meja 07
    const table = await prisma.table.findUnique({ where: { tableNumber: '07' } })
    expect(table).not.toBeNull()
    tableId = table!.id

    // Ambil menu aktif lengkap dengan modifiernya
    const item = await prisma.menuItem.findFirst({
      where: { isAvailable: true, isArchived: false },
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
    expect(item).not.toBeNull()
    menuItemId = item!.id

    if (item?.modifierGroups) {
      requiredModifierOptionIds = item.modifierGroups
        .filter((mg) => mg.group.isRequired)
        .map((mg) => mg.group.options[0]?.id)
        .filter((id): id is string => Boolean(id))
    }
  })

  afterAll(async () => {
    // Cleanup orders
    if (createdOrderIds.length > 0) {
      await prisma.orderItemModifier.deleteMany({
        where: { orderItem: { orderId: { in: createdOrderIds } } },
      }).catch(() => {})
      await prisma.orderItem.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {})
      await prisma.auditLog.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {})
      await prisma.paymentAttempt.deleteMany({
        where: { orderId: { in: createdOrderIds } },
      }).catch(() => {})
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: { in: createdOrderIds } },
      }).catch(() => {})
      await prisma.order.deleteMany({
        where: { id: { in: createdOrderIds } },
      }).catch(() => {})
    }

    if (createdIdempotencyKeys.length > 0) {
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: createdIdempotencyKeys } },
      }).catch(() => {})
    }

    if (createdGuestSessionIds.length > 0) {
      await prisma.guestSession.deleteMany({
        where: { id: { in: createdGuestSessionIds } },
      }).catch(() => {})
    }
  })

  it('handles 5 concurrent orders simultaneously without P2002 collision errors', async () => {
    const concurrentCount = 5

    // Siapkan 5 sesi tamu dan quote independen
    const orderPromises = Array.from({ length: concurrentCount }).map(async (_, idx) => {
      const session = await createGuestSession(tableId)
      createdGuestSessionIds.push(session.id)

      const quote = await createOrderQuote({
        tableNumber: '07',
        guestSessionId: session.id,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds: requiredModifierOptionIds }],
      })

      const idemKey = crypto.randomUUID()
      createdIdempotencyKeys.push(idemKey)

      const claim = await claimIdempotencyKey({
        key: idemKey,
        scope: 'CREATE_ORDER',
        ownerId: session.id,
        requestHash: `hash_concurrency_${idx}_${Date.now()}`,
      })

      return createOrderFromQuote({
        tableNumber: '07',
        paymentMethod: 'QRIS',
        quoteToken: quote.quoteToken,
        items: [{ menuItemId, quantity: 1, selectedModifierOptionIds: requiredModifierOptionIds }],
        guestSessionId: session.id,
        idempotencyRecordId: claim.record.id,
      })
    })

    // Eksekusi seluruh pesanan secara serentak (Promise.all)
    const results = await Promise.all(orderPromises)

    expect(results).toHaveLength(concurrentCount)

    const orderNumbers: string[] = []

    for (const res of results) {
      expect(res.order).toBeDefined()
      expect(res.order.orderId).toBeDefined()
      createdOrderIds.push(res.order.orderId)

      // Pastikan format nomor pesanan sesuai spesifikasi PREFIX-YYMMDD-XXX
      expect(res.order.orderNumber).toMatch(/^[A-Z0-9]{4}-\d{6}-\d{3,}$/)
      orderNumbers.push(res.order.orderNumber)
    }

    // Pastikan setiap nomor pesanan unik sempurna (tidak ada duplikat)
    const uniqueOrderNumbers = new Set(orderNumbers)
    expect(uniqueOrderNumbers.size).toBe(concurrentCount)
  })
})
