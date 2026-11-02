// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/server/db'
import { publishEvent, fetchNewEvents } from '@/lib/server/realtime-bus'
import { GET as kdsEventsHandler } from '@/app/api/staff/kds/events/route'
import { GET as posEventsHandler } from '@/app/api/staff/pos/events/route'
import { GET as orderStreamHandler } from '@/app/api/orders/[id]/stream/route'
import { GET as kdsOrdersHandler } from '@/app/api/staff/kds/orders/route'
import { PATCH as updateOrderStatusHandler } from '@/app/api/staff/orders/[id]/status/route'
import { PATCH as toggleStockHandler } from '@/app/api/staff/menu/[id]/stock/route'
import { PATCH as updatePriceHandler } from '@/app/api/staff/menu/[id]/price/route'
import { signStaffToken } from '@/lib/server/auth'
import { hashOrderSecretToken } from '@/lib/server/order-capability'
import crypto from 'node:crypto'

describe('Tahap 14: Real-time Sync & Event Bus Integration Suite', () => {
  let cashierToken: string
  let adminToken: string
  let baristaToken: string

  let tableId: string
  let testMenuItemId: string
  const createdOrderIds: string[] = []
  const createdOutboxEventIds: string[] = []

  beforeAll(async () => {
    // 1. Get test table
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '01' } })
    tableId = table.id

    // 2. Get test menu item
    const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { id: 'menu-kopi-sela' } })
    testMenuItemId = menuItem.id

    // 3. Find staff users
    const cashier = await prisma.staffUser.findFirstOrThrow({ where: { role: 'CASHIER', isActive: true } })
    cashierToken = await signStaffToken({
      sub: cashier.id,
      username: cashier.username,
      displayName: cashier.displayName,
      role: cashier.role,
    })

    const admin = await prisma.staffUser.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } })
    adminToken = await signStaffToken({
      sub: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    })

    const barista = await prisma.staffUser.findFirstOrThrow({ where: { role: 'BARISTA', isActive: true } })
    baristaToken = await signStaffToken({
      sub: barista.id,
      username: barista.username,
      displayName: barista.displayName,
      role: barista.role,
    })
  })

  afterAll(async () => {
    // Cleanup outbox events created in tests
    if (createdOutboxEventIds.length > 0) {
      await prisma.outboxEvent.deleteMany({
        where: { id: { in: createdOutboxEventIds } },
      }).catch(() => {})
    }

    // Cleanup orders
    for (const orderId of createdOrderIds) {
      await prisma.manualRefundRecord.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: orderId } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.paymentAttempt.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.orderItemModifier.deleteMany({ where: { orderItem: { orderId } } }).catch(() => {})
      await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }
  })

  // Helper to create test orders with real capability tokens
  async function createTestOrder(overrides: {
    paymentMethod?: 'CASH' | 'QRIS'
    paymentStatus?: 'WAITING_CASHIER' | 'UNPAID' | 'PAID' | 'EXPIRED'
    orderStatus?: 'QUEUED' | 'COOKING' | 'READY' | 'COMPLETED' | 'CANCELLED'
    totalAmount?: number
  }) {
    const uniqueSuffix = crypto.randomUUID().slice(0, 8)
    const token = `sec_test_${crypto.randomBytes(16).toString('hex')}`
    const tokenHash = hashOrderSecretToken(token)
    const totalAmount = overrides.totalAmount ?? 28000

    const order = await prisma.order.create({
      data: {
        orderNumber: `RT-${Date.now()}-${uniqueSuffix}`,
        orderSecretTokenHash: tokenHash,
        tableId,
        subtotalAmount: totalAmount,
        totalAmount,
        paymentMethod: overrides.paymentMethod ?? 'CASH',
        paymentStatus: overrides.paymentStatus ?? 'WAITING_CASHIER',
        orderStatus: overrides.orderStatus ?? 'QUEUED',
        customerNotes: 'Less ice please',
        items: {
          create: [
            {
              menuItemId: testMenuItemId,
              nameSnapshot: 'Kopi Susu Sela',
              priceSnapshot: totalAmount,
              quantity: 1,
              subtotal: totalAmount,
            },
          ],
        },
      },
      include: {
        table: true,
        items: true,
      },
    })

    createdOrderIds.push(order.id)
    return { order, token }
  }

  describe('1. Outbox Event Persistence & Cursor-Based Fetching', () => {
    it('persists event to database and retrieves it via fetchNewEvents', async () => {
      const aggregateId = crypto.randomUUID()
      const baseline = await publishEvent({
        channel: 'KDS',
        eventType: 'BASELINE',
        aggregateId,
      })
      createdOutboxEventIds.push(baseline.id)

      const event = await publishEvent({
        channel: 'KDS',
        eventType: 'ORDER_PAID',
        aggregateId,
        payload: { testKey: 'hello_kds', timestamp: Date.now() },
      })

      createdOutboxEventIds.push(event.id)
      expect(typeof event.id).toBe('string')
      expect(event.channel).toBe('KDS')
      expect(event.eventType).toBe('ORDER_PAID')

      // Fetch new events starting from baseline cursor
      const events = await fetchNewEvents({
        channels: ['KDS'],
        afterId: baseline.id,
      })

      const found = events.find((e) => e.id === event.id)
      expect(found).toBeDefined()
      expect(found?.aggregateId).toBe(aggregateId)
      const payloadObj = JSON.parse(found?.payload as string)
      expect(payloadObj.testKey).toBe('hello_kds')
    })
  })

  describe('2. Multi-Instance Fan-Out Simulation (Zero In-Memory Process Dependency)', () => {
    it('allows separate consumer instances to receive events published by another instance', async () => {
      const aggregateId = crypto.randomUUID()
      const baseline = await publishEvent({
        channel: 'POS',
        eventType: 'BASELINE',
        aggregateId,
      })
      createdOutboxEventIds.push(baseline.id)

      const startMs = Date.now()

      // Producer Instance publishes event to DB
      const published = await publishEvent({
        channel: 'POS',
        eventType: 'NEW_CASH_ORDER',
        aggregateId,
        payload: { orderNumber: 'POS-FANOUT-001', amount: 50000 },
      })
      createdOutboxEventIds.push(published.id)

      // Consumer Instance (independent DB query) reads from outbox
      const consumedEvents = await fetchNewEvents({
        channels: ['POS'],
        afterId: baseline.id,
      })

      const elapsedMs = Date.now() - startMs
      const targetEvent = consumedEvents.find((e) => e.id === published.id)

      expect(targetEvent).toBeDefined()
      const parsed = JSON.parse(targetEvent?.payload as string)
      expect(parsed.orderNumber).toBe('POS-FANOUT-001')
      // Sesuai target SLA <= 2000ms
      expect(elapsedMs).toBeLessThanOrEqual(2000)
    })
  })

  describe('3. Reconnection & Zero Event Loss with Last-Event-ID Cursor', () => {
    it('returns missed sequential events without duplicates when reconnecting with afterId', async () => {
      const aggregateId = crypto.randomUUID()

      const e1 = await publishEvent({ channel: 'KDS', eventType: 'EVENT_1', aggregateId })
      const e2 = await publishEvent({ channel: 'KDS', eventType: 'EVENT_2', aggregateId })
      const e3 = await publishEvent({ channel: 'KDS', eventType: 'EVENT_3', aggregateId })
      createdOutboxEventIds.push(e1.id, e2.id, e3.id)

      // Client reconnects sending Last-Event-ID = e1.id
      const reconnectedEvents = await fetchNewEvents({
        channels: ['KDS'],
        afterId: e1.id,
      })

      const eventTypes = reconnectedEvents.map((e) => e.eventType)
      expect(eventTypes).toContain('EVENT_2')
      expect(eventTypes).toContain('EVENT_3')
      expect(eventTypes).not.toContain('EVENT_1')

      // Assert sequential ordering by ID
      const targetEvents = reconnectedEvents.filter((e) => [e2.id, e3.id].includes(e.id))
      expect(targetEvents.length).toBe(2)
      expect(targetEvents[0]?.id).toBe(e2.id)
      expect(targetEvents[1]?.id).toBe(e3.id)
    })
  })

  describe('4. RBAC Authorization for Staff Event Streams', () => {
    it('rejects unauthenticated KDS stream with 401', async () => {
      const req = new Request('http://localhost:3000/api/staff/kds/events')
      const res = await kdsEventsHandler(req)
      expect(res.status).toBe(401)
    })

    it('allows BARISTA, CASHIER, and ADMIN to connect to KDS SSE stream', async () => {
      for (const token of [baristaToken, cashierToken, adminToken]) {
        const ac = new AbortController()
        const req = new Request('http://localhost:3000/api/staff/kds/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        })

        const res = await kdsEventsHandler(req)
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')
        expect(res.headers.get('cache-control')).toContain('no-cache')
        ac.abort()
      }
    })

    it('rejects unauthenticated POS stream with 401', async () => {
      const req = new Request('http://localhost:3000/api/staff/pos/events')
      const res = await posEventsHandler(req)
      expect(res.status).toBe(401)
    })

    it('rejects BARISTA on POS stream with 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/staff/pos/events', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      })
      const res = await posEventsHandler(req)
      expect(res.status).toBe(403)
    })

    it('allows CASHIER and ADMIN on POS stream', async () => {
      for (const token of [cashierToken, adminToken]) {
        const ac = new AbortController()
        const req = new Request('http://localhost:3000/api/staff/pos/events', {
          headers: { Authorization: `Bearer ${token}` },
          signal: ac.signal,
        })

        const res = await posEventsHandler(req)
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toContain('text/event-stream')
        ac.abort()
      }
    })
  })

  describe('5. Customer Tracker Stream Isolation & Capability Guard', () => {
    it('rejects stream request without capability token with 403', async () => {
      const { order } = await createTestOrder({})
      const req = new Request(`http://localhost:3000/api/orders/${order.id}/stream`)
      const res = await orderStreamHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('rejects cross-order capability token with 403 (Token Order A cannot stream Order B)', async () => {
      const { token: tokenA } = await createTestOrder({})
      const { order: orderB } = await createTestOrder({})

      // Attempt to listen to orderB stream using tokenA
      const req = new Request(`http://localhost:3000/api/orders/${orderB.id}/stream`, {
        headers: {
          'x-order-secret-token': tokenA,
        },
      })
      const res = await orderStreamHandler(req, { params: Promise.resolve({ id: orderB.id }) })
      expect(res.status).toBe(403)
    })

    it('allows valid order capability token to connect to isolated SSE stream', async () => {
      const { order, token } = await createTestOrder({})
      const ac = new AbortController()

      const req = new Request(`http://localhost:3000/api/orders/${order.id}/stream`, {
        headers: {
          'x-order-secret-token': token,
        },
        signal: ac.signal,
      })
      const res = await orderStreamHandler(req, { params: Promise.resolve({ id: order.id }) })

      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/event-stream')
      ac.abort()
    })
  })

  describe('6. Kitchen Gate Enforcement (DEC-013) & Status Transitions', () => {
    it('rejects transition to COOKING if paymentStatus is not PAID (Kitchen Gate)', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'QUEUED',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'COOKING' }),
      })

      const res = await updateOrderStatusHandler(req, { params: Promise.resolve({ id: order.id }) })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error).toBe('ORDER_NOT_PAID')
    })

    it('allows full progression: QUEUED -> COOKING -> READY -> COMPLETED when PAID', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'PAID',
        orderStatus: 'QUEUED',
      })

      // 1. Transition: QUEUED -> COOKING
      const reqCooking = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'COOKING' }),
      })
      const resCooking = await updateOrderStatusHandler(reqCooking, { params: Promise.resolve({ id: order.id }) })
      expect(resCooking.status).toBe(200)
      const dataCooking = await resCooking.json()
      expect(dataCooking.order.orderStatus).toBe('COOKING')

      // Verify event published to KDS and customer channel
      const kdsEvents1 = await fetchNewEvents({ channels: ['KDS'], aggregateId: order.id })
      expect(kdsEvents1.some((e) => e.eventType === 'ORDER_STATUS_CHANGED')).toBe(true)

      // 2. Transition: COOKING -> READY
      const reqReady = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'READY' }),
      })
      const resReady = await updateOrderStatusHandler(reqReady, { params: Promise.resolve({ id: order.id }) })
      expect(resReady.status).toBe(200)
      const dataReady = await resReady.json()
      expect(dataReady.order.orderStatus).toBe('READY')

      // 3. Transition: READY -> COMPLETED
      const reqCompleted = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'COMPLETED' }),
      })
      const resCompleted = await updateOrderStatusHandler(reqCompleted, { params: Promise.resolve({ id: order.id }) })
      expect(resCompleted.status).toBe(200)
      const dataCompleted = await resCompleted.json()
      expect(dataCompleted.order.orderStatus).toBe('COMPLETED')

      // 4. Illegal backward transition: COMPLETED -> COOKING rejected with 400
      const reqIllegal = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'COOKING' }),
      })
      const resIllegal = await updateOrderStatusHandler(reqIllegal, { params: Promise.resolve({ id: order.id }) })
      expect(resIllegal.status).toBe(400)
      const bodyIllegal = await resIllegal.json()
      expect(bodyIllegal.error).toBe('INVALID_STATUS_TRANSITION')
    })

    it('GET /api/staff/kds/orders returns only active PAID orders (excluding UNPAID & COMPLETED)', async () => {
      // 1. Order Unpaid (should NOT appear)
      const { order: unpaidOrder } = await createTestOrder({
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'QUEUED',
      })

      // 2. Order Paid & Queued (SHOULD appear)
      const { order: activeOrder } = await createTestOrder({
        paymentStatus: 'PAID',
        orderStatus: 'QUEUED',
      })

      // 3. Order Completed (should NOT appear)
      const { order: completedOrder } = await createTestOrder({
        paymentStatus: 'PAID',
        orderStatus: 'COMPLETED',
      })

      const req = new Request('http://localhost:3000/api/staff/kds/orders', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      })
      const res = await kdsOrdersHandler(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      const orderIds = (body.orders as { id: string }[]).map((o) => o.id)

      expect(orderIds).toContain(activeOrder.id)
      expect(orderIds).not.toContain(unpaidOrder.id)
      expect(orderIds).not.toContain(completedOrder.id)
    })
  })

  describe('7. Catalog Invalidation Signal Propagation', () => {
    it('emits STOCK_TOGGLED on channel CATALOG when stock is toggled', async () => {
      const req = new Request(`http://localhost:3000/api/staff/menu/${testMenuItemId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ isAvailable: true }),
      })

      const res = await toggleStockHandler(req, { params: Promise.resolve({ id: testMenuItemId }) })
      expect(res.status).toBe(200)

      const events = await fetchNewEvents({
        channels: ['CATALOG'],
        aggregateId: testMenuItemId,
      })
      expect(events.some((e) => e.eventType === 'STOCK_TOGGLED')).toBe(true)
    })

    it('emits PRICE_CHANGED on channel CATALOG when price is updated by Admin', async () => {
      const req = new Request(`http://localhost:3000/api/staff/menu/${testMenuItemId}/price`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ price: 28000 }),
      })

      const res = await updatePriceHandler(req, { params: Promise.resolve({ id: testMenuItemId }) })
      expect(res.status).toBe(200)

      const events = await fetchNewEvents({
        channels: ['CATALOG'],
        aggregateId: testMenuItemId,
      })
      expect(events.some((e) => e.eventType === 'PRICE_CHANGED')).toBe(true)
    })
  })

  describe('8. Latency Benchmark & Distribution SLA Verification', () => {
    it('verifies event publish-to-read latency is strictly under target SLA <= 2.0s', async () => {
      const testRuns = 3
      const latencies: number[] = []

      for (let i = 0; i < testRuns; i++) {
        const aggregateId = crypto.randomUUID()
        const baseline = await publishEvent({
          channel: 'KDS',
          eventType: 'BASELINE',
          aggregateId,
        })
        createdOutboxEventIds.push(baseline.id)

        const start = performance.now()

        const published = await publishEvent({
          channel: 'KDS',
          eventType: 'BENCHMARK_PING',
          aggregateId,
          payload: { run: i },
        })
        createdOutboxEventIds.push(published.id)

        const readEvents = await fetchNewEvents({
          channels: ['KDS'],
          afterId: baseline.id,
        })

        const durationMs = performance.now() - start
        latencies.push(durationMs)

        const matched = readEvents.find((e) => e.id === published.id)
        expect(matched).toBeDefined()
        expect(durationMs).toBeLessThanOrEqual(2000)
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      console.log(`[LATENCY BENCHMARK] Average latency across ${testRuns} runs: ${avgLatency.toFixed(2)} ms`)
      expect(avgLatency).toBeLessThanOrEqual(2000)
    })
  })
})
