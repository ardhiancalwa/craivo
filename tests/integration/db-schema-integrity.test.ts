// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient, OrderStatus, PaymentStatus, PaymentMethod, PaymentGateway } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient()

describe('Database Schema & Integrity Verification (Cravio - SELA Pilot)', () => {
  beforeAll(async () => {
    await prisma.$connect()
  })

  afterAll(async () => {
    // Clean up test order created during the suite
    await prisma.order.deleteMany({
      where: { orderNumber: { startsWith: 'TEST-ORD-' } },
    })
    await prisma.idempotencyRecord.deleteMany({
      where: { key: { startsWith: 'test-idemp-' } },
    })
    await prisma.$disconnect()
  })

  it('verifies Cravio configuration exists with 0% tax & service rate', async () => {
    const config = await prisma.cravioConfig.findFirst()
    expect(config).toBeDefined()
    expect(['Cravio', 'SELA Artisanal Coffee & Bake']).toContain(config?.name)
    expect(config?.tagline).toBe('Your craving, Perfectly Matched')
    expect(config?.taxRateBps).toBe(0)
    expect(config?.serviceRateBps).toBe(0)
    expect(config?.qrisTimeoutMinutes).toBe(15)
    expect(config?.cashTimeoutMinutes).toBe(20)
  })

  it('verifies 10 cafe tables and uniqueness constraint on tableNumber', async () => {
    const tables = await prisma.table.findMany()
    expect(tables.length).toBeGreaterThanOrEqual(10)

    // Attempting to create duplicate tableNumber "01" should fail with P2002
    await expect(
      prisma.table.create({
        data: {
          tableNumber: '01',
          qrSlug: 'sela-table-01-duplicate-test',
        },
      })
    ).rejects.toThrow()
  })

  it('verifies exactly 3 real categories exist in the database (Semua is UI-only)', async () => {
    const categories = await prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    })
    expect(categories.length).toBe(3)
    const slugs = categories.map((c) => c.slug)
    expect(slugs).toEqual(['kopi', 'non-kopi', 'makanan'])
  })

  it('verifies at least 18 seeded menu items with integer prices', async () => {
    const menuItems = await prisma.menuItem.findMany()
    expect(menuItems.length).toBeGreaterThanOrEqual(18)

    for (const item of menuItems) {
      expect(Number.isInteger(item.price)).toBe(true)
      expect(item.price).toBeGreaterThan(0)
      expect(item.isArchived).toBe(false)
      expect(item.deletedAt).toBeNull()
    }
  })

  it('verifies 3-step quiz structure and weighted tag associations', async () => {
    const questions = await prisma.quizQuestion.findMany({
      include: {
        options: {
          include: {
            optionTags: true,
          },
        },
      },
      orderBy: { stepNumber: 'asc' },
    })

    expect(questions.length).toBe(3)
    expect(questions[0]?.dimension).toBe('MOOD')
    expect(questions[1]?.dimension).toBe('FLAVOR')
    expect(questions[2]?.dimension).toBe('FORMAT')

    // Flavor weights must be 3, Format weights 2, Mood weights 1
    const flavorOpt = questions[1]?.options[0]?.optionTags[0]
    expect(flavorOpt?.weight).toBe(3)

    const formatOpt = questions[2]?.options[0]?.optionTags[0]
    expect(formatOpt?.weight).toBe(2)

    const moodOpt = questions[0]?.options[0]?.optionTags[0]
    expect(moodOpt?.weight).toBe(1)
  })

  it('creates an order with SHA-256 token hash, integer pricing, and immutable item snapshot', async () => {
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '07' } })
    const sampleMenu = await prisma.menuItem.findFirstOrThrow({ where: { id: 'menu-kopi-sela' } })

    const rawToken = 'guest-secret-token-xyz-12345678'
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')

    const orderNumber = `TEST-ORD-${Date.now()}`

    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderSecretTokenHash: tokenHash,
        tableId: table.id,
        customerNotes: 'Less ice please',
        subtotalAmount: sampleMenu.price,
        taxAmount: 0,
        serviceAmount: 0,
        totalAmount: sampleMenu.price,
        orderStatus: OrderStatus.QUEUED,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod: PaymentMethod.QRIS,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        items: {
          create: [
            {
              menuItemId: sampleMenu.id,
              nameSnapshot: sampleMenu.name,
              priceSnapshot: sampleMenu.price,
              quantity: 1,
              subtotal: sampleMenu.price,
            },
          ],
        },
      },
      include: { items: true },
    })

    expect(order.id).toBeDefined()
    expect(order.orderSecretTokenHash).toBe(tokenHash)
    expect(order.totalAmount).toBe(28000)
    expect(order.version).toBe(1)

    // Snapshot integrity: Item snapshot is decoupled from subsequent menu changes
    const snapshot = order.items[0]
    expect(snapshot?.nameSnapshot).toBe('Es Kopi Susu Sela')
    expect(snapshot?.priceSnapshot).toBe(28000)

    // Simulate menu price change in catalog:
    try {
      await prisma.menuItem.update({
        where: { id: sampleMenu.id },
        data: { price: 35000 },
      })

      // Fetch order again; snapshot must remain 28000
      const fetchedOrder = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      })
      expect(fetchedOrder.items[0]?.priceSnapshot).toBe(28000)
    } finally {
      // Revert sample menu price
      await prisma.menuItem.update({
        where: { id: sampleMenu.id },
        data: { price: 28000 },
      })
    }
  })

  it('demonstrates soft-delete preservation: archiving menu item never breaks historical order items', async () => {
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '02' } })
    const testMenu = await prisma.menuItem.create({
      data: {
        name: 'Temporary Test Croissant',
        description: 'For soft delete testing',
        price: 25000,
        categoryId: (await prisma.category.findFirstOrThrow()).id,
      },
    })

    const orderNumber = `TEST-ORD-SOFTDEL-${Date.now()}`
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderSecretTokenHash: 'dummy-hash',
        tableId: table.id,
        subtotalAmount: 25000,
        totalAmount: 25000,
        paymentMethod: PaymentMethod.CASH,
        items: {
          create: [
            {
              menuItemId: testMenu.id,
              nameSnapshot: testMenu.name,
              priceSnapshot: testMenu.price,
              quantity: 1,
              subtotal: 25000,
            },
          ],
        },
      },
      include: { items: true },
    })

    // Perform soft-delete (archival)
    await prisma.menuItem.update({
      where: { id: testMenu.id },
      data: {
        isArchived: true,
        deletedAt: new Date(),
        isAvailable: false,
      },
    })

    // Historical order must still exist and retain complete snapshot data
    const historicalOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    })

    expect(historicalOrder.items.length).toBe(1)
    expect(historicalOrder.items[0]?.nameSnapshot).toBe('Temporary Test Croissant')
    expect(historicalOrder.items[0]?.priceSnapshot).toBe(25000)

    // Hard delete testMenu (onDelete: SetNull guarantees foreign key safety)
    await prisma.menuItem.delete({ where: { id: testMenu.id } })

    const orderAfterHardDelete = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    })
    expect(orderAfterHardDelete.items[0]?.menuItemId).toBeNull()
    expect(orderAfterHardDelete.items[0]?.nameSnapshot).toBe('Temporary Test Croissant')
  })

  it('enforces optimistic locking version increment during state transition', async () => {
    const table = await prisma.table.findFirstOrThrow()
    const orderNumber = `TEST-ORD-LOCK-${Date.now()}`
    const order = await prisma.order.create({
      data: {
        orderNumber,
        orderSecretTokenHash: 'lock-token-hash',
        tableId: table.id,
        subtotalAmount: 24000,
        totalAmount: 24000,
        paymentMethod: PaymentMethod.QRIS,
        orderStatus: OrderStatus.QUEUED,
        version: 1,
      },
    })

    // Transition QUEUED -> COOKING with conditional update
    const updated = await prisma.order.updateMany({
      where: {
        id: order.id,
        version: 1, // Conditional check
      },
      data: {
        orderStatus: OrderStatus.COOKING,
        version: { increment: 1 },
      },
    })
    expect(updated.count).toBe(1)

    // Stale write attempt with old version 1 must update 0 rows
    const staleUpdate = await prisma.order.updateMany({
      where: {
        id: order.id,
        version: 1, // Stale version
      },
      data: {
        orderStatus: OrderStatus.READY,
        version: { increment: 1 },
      },
    })
    expect(staleUpdate.count).toBe(0)
  })

  it('enforces uniqueness on IdempotencyRecord key', async () => {
    const key = `test-idemp-${Date.now()}`
    const ownerId = 'test-guest-owner-id'
    await prisma.idempotencyRecord.create({
      data: {
        key,
        scope: '/api/orders',
        ownerId,
        requestHash: 'test-hash-123',
        responseStatus: 201,
        responseBody: JSON.stringify({ success: true }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    })

    // Duplicate key insertion for same scope and ownerId must fail with P2002
    await expect(
      prisma.idempotencyRecord.create({
        data: {
          key,
          scope: '/api/orders',
          ownerId,
          requestHash: 'different-hash',
          responseStatus: 201,
          responseBody: JSON.stringify({ duplicate: true }),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      })
    ).rejects.toThrow()
  })

  it('verifies Row Level Security (RLS) is enabled on orders table in PostgreSQL', async () => {
    const result = await prisma.$queryRaw<Array<{ tablename: string; rowsecurity: boolean }>>`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' AND tablename = 'orders';
    `
    expect(result.length).toBe(1)
    expect(result[0]?.rowsecurity).toBe(true)
  })

  it('creates and retrieves OutboxEvent for real-time SSE event bus', async () => {
    const event = await prisma.outboxEvent.create({
      data: {
        channel: 'KDS',
        aggregateType: 'ORDER',
        aggregateId: 'ord-test-sse-123',
        eventType: 'ORDER_PAID',
        payload: JSON.stringify({ orderNumber: 'ORD-TEST-001', table: '07' }),
      },
    })

    expect(event.id).toBeDefined()
    expect(event.status).toBe('PENDING')
    expect(event.retryCount).toBe(0)

    // Mark as processed
    const processed = await prisma.outboxEvent.update({
      where: { id: event.id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
    })
    expect(processed.status).toBe('PROCESSED')

    // Clean up test event
    await prisma.outboxEvent.delete({ where: { id: event.id } })
  })
})

