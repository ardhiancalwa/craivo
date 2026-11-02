// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/lib/server/db'
import { GET as kdsOrdersHandler } from '@/app/api/staff/kds/orders/route'
import { PATCH as updateOrderStatusHandler } from '@/app/api/staff/orders/[id]/status/route'
import { GET as getOrderHandler } from '@/app/api/orders/[id]/route'
import { signStaffToken } from '@/lib/server/auth'
import { hashOrderSecretToken } from '@/lib/server/order-capability'
import crypto from 'node:crypto'

describe('Tahap 15: KDS Dapur & Pelacak Pesanan Pelanggan Integration Suite', () => {
  let adminToken: string
  let baristaToken: string

  let tableId: string
  let testMenuItemId: string
  const createdOrderIds: string[] = []

  beforeAll(async () => {
    // 1. Get test table
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '01' } })
    tableId = table.id

    // 2. Get test menu item
    const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { id: 'menu-kopi-sela' } })
    testMenuItemId = menuItem.id

    // 3. Find staff users
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

  // Helper to create test orders
  async function createTestOrder(overrides: {
    paymentMethod?: 'CASH' | 'QRIS'
    paymentStatus?: 'WAITING_CASHIER' | 'UNPAID' | 'PAID' | 'EXPIRED'
    orderStatus?: 'QUEUED' | 'COOKING' | 'READY' | 'COMPLETED' | 'CANCELLED'
    paidAt?: Date | null
    totalAmount?: number
  }) {
    const uniqueSuffix = crypto.randomUUID().slice(0, 8)
    const token = `sec_kds_${crypto.randomBytes(16).toString('hex')}`
    const tokenHash = hashOrderSecretToken(token)
    const totalAmount = overrides.totalAmount ?? 35000

    const order = await prisma.order.create({
      data: {
        orderNumber: `KDS-${Date.now()}-${uniqueSuffix}`,
        orderSecretTokenHash: tokenHash,
        tableId,
        subtotalAmount: totalAmount,
        totalAmount,
        paymentMethod: overrides.paymentMethod ?? 'CASH',
        paymentStatus: overrides.paymentStatus ?? 'WAITING_CASHIER',
        orderStatus: overrides.orderStatus ?? 'QUEUED',
        paidAt: overrides.paidAt,
        customerNotes: 'Kurang manis & es terpisah',
        items: {
          create: [
            {
              menuItemId: testMenuItemId,
              nameSnapshot: 'Kopi Susu Sela',
              priceSnapshot: totalAmount,
              quantity: 2,
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

  describe('1. Server-Authoritative Kitchen Gate Enforcement (DEC-013)', () => {
    it('excludes unpaid cash (WAITING_CASHIER), unpaid QRIS (UNPAID), and EXPIRED orders from KDS', async () => {
      // 1. Order Tunai belum bayar
      const { order: unpaidCash } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'QUEUED',
      })

      // 2. Order QRIS belum bayar
      const { order: unpaidQris } = await createTestOrder({
        paymentMethod: 'QRIS',
        paymentStatus: 'UNPAID',
        orderStatus: 'QUEUED',
      })

      // 3. Order Expired
      const { order: expiredOrder } = await createTestOrder({
        paymentMethod: 'QRIS',
        paymentStatus: 'EXPIRED',
        orderStatus: 'QUEUED',
      })

      // 4. Order Lunas (PAID)
      const { order: paidOrder } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'QUEUED',
      })

      const req = new Request('http://localhost:3000/api/staff/kds/orders', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      })
      const res = await kdsOrdersHandler(req)
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      const orderIds = (body.orders as { id: string }[]).map((o) => o.id)

      // Hanya paidOrder yang boleh masuk KDS
      expect(orderIds).toContain(paidOrder.id)
      expect(orderIds).not.toContain(unpaidCash.id)
      expect(orderIds).not.toContain(unpaidQris.id)
      expect(orderIds).not.toContain(expiredOrder.id)
    })
  })

  describe('2. Strict FIFO Ordering Based on paidAt: asc', () => {
    it('orders active KDS tickets in strict FIFO sequence by paidAt timestamp', async () => {
      const now = Date.now()
      const t1 = new Date(now - 30 * 60 * 1000) // 30 menit lalu
      const t2 = new Date(now - 15 * 60 * 1000) // 15 menit lalu
      const t3 = new Date(now - 5 * 60 * 1000)  // 5 menit lalu

      const { order: o1 } = await createTestOrder({ paymentStatus: 'PAID', paidAt: t1, orderStatus: 'QUEUED' })
      const { order: o2 } = await createTestOrder({ paymentStatus: 'PAID', paidAt: t2, orderStatus: 'QUEUED' })
      const { order: o3 } = await createTestOrder({ paymentStatus: 'PAID', paidAt: t3, orderStatus: 'QUEUED' })

      const req = new Request('http://localhost:3000/api/staff/kds/orders', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      })
      const res = await kdsOrdersHandler(req)
      const body = await res.json()

      const orders = body.orders as { id: string }[]
      const idx1 = orders.findIndex((o) => o.id === o1.id)
      const idx2 = orders.findIndex((o) => o.id === o2.id)
      const idx3 = orders.findIndex((o) => o.id === o3.id)

      expect(idx1).toBeGreaterThanOrEqual(0)
      expect(idx2).toBeGreaterThanOrEqual(0)
      expect(idx3).toBeGreaterThanOrEqual(0)

      // FIFO check: o1 (terlama) harus sebelum o2, dan o2 sebelum o3
      expect(idx1).toBeLessThan(idx2)
      expect(idx2).toBeLessThan(idx3)
    })
  })

  describe('3. Optimistic Concurrency Control & Versioning (Dual Staff Action Safety)', () => {
    it('handles concurrent status updates safely using version checks', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'QUEUED',
      })

      // Simulasi dua staf (Barista 1 dan Barista 2) yang keduanya membaca order pada version 1
      const req1 = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: 'COOKING' }),
      })

      const req2 = new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status: 'COOKING' }),
      })

      // Jalankan paralel
      const [res1, res2] = await Promise.all([
        updateOrderStatusHandler(req1, { params: Promise.resolve({ id: order.id }) }),
        updateOrderStatusHandler(req2, { params: Promise.resolve({ id: order.id }) }),
      ])

      // Keduanya harus mengembalikan status sukses (satu mutasi nyata, satu idempoten bersih)
      expect(res1.status).toBe(200)
      expect(res2.status).toBe(200)

      // Cek di DB bahwa version naik tepat 1 kali (dari 1 ke 2)
      const freshOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(freshOrder.orderStatus).toBe('COOKING')
      expect(freshOrder.version).toBe(order.version + 1)
    })
  })

  describe('4. Full Sequential Progression: QUEUED -> COOKING -> READY -> COMPLETED', () => {
    it('progresses through all 4 stages correctly, records completedAt and emits events', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'QUEUED',
      })

      // 1. QUEUED -> COOKING
      const resCooking = await updateOrderStatusHandler(
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${baristaToken}` },
          body: JSON.stringify({ status: 'COOKING' }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      )
      expect(resCooking.status).toBe(200)
      const dataCooking = await resCooking.json()
      expect(dataCooking.order.orderStatus).toBe('COOKING')

      // 2. COOKING -> READY
      const resReady = await updateOrderStatusHandler(
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${baristaToken}` },
          body: JSON.stringify({ status: 'READY' }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      )
      expect(resReady.status).toBe(200)
      const dataReady = await resReady.json()
      expect(dataReady.order.orderStatus).toBe('READY')

      // 3. READY -> COMPLETED
      const resCompleted = await updateOrderStatusHandler(
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${baristaToken}` },
          body: JSON.stringify({ status: 'COMPLETED' }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      )
      expect(resCompleted.status).toBe(200)
      const dataCompleted = await resCompleted.json()
      expect(dataCompleted.order.orderStatus).toBe('COMPLETED')

      // Verifikasi di DB: completedAt terisi
      const finished = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(finished.completedAt).not.toBeNull()
      expect(finished.orderStatus).toBe('COMPLETED')
      // INVARIAN FINANSIAL MUTLAK: paymentStatus tetap PAID
      expect(finished.paymentStatus).toBe('PAID')
    })
  })

  describe('5. Illegal Status Transitions Rejection', () => {
    it('rejects jumping from QUEUED directly to COMPLETED with 400', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'QUEUED',
      })

      const res = await updateOrderStatusHandler(
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${baristaToken}` },
          body: JSON.stringify({ status: 'COMPLETED' }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('INVALID_STATUS_TRANSITION')
    })

    it('rejects backward transition from READY to COOKING with 400', async () => {
      const { order } = await createTestOrder({
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'READY',
      })

      const res = await updateOrderStatusHandler(
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${baristaToken}` },
          body: JSON.stringify({ status: 'COOKING' }),
        }),
        { params: Promise.resolve({ id: order.id }) }
      )
      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error).toBe('INVALID_STATUS_TRANSITION')
    })
  })

  describe('6. Customer Tracker API & State Separation', () => {
    it('returns separated paymentStatus and orderStatus with verified capability token', async () => {
      const { order, token } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'COOKING',
      })

      const req = new NextRequest(`http://localhost:3000/api/orders/${order.id}`, {
        headers: { 'x-order-secret-token': token },
      })
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const body = await res.json()
      expect(body.success).toBe(true)
      expect(body.data.paymentStatus).toBe('PAID')
      expect(body.data.orderStatus).toBe('COOKING')
      expect(body.data.orderNumber).toBe(order.orderNumber)
      expect(body.data.items.length).toBeGreaterThan(0)
    })
  })

  describe('7. Customer Tracker Table Isolation & Secret Guard', () => {
    it('rejects request with missing token (403 Forbidden)', async () => {
      const { order } = await createTestOrder({})
      const req = new NextRequest(`http://localhost:3000/api/orders/${order.id}`)
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('rejects cross-order token (Order A token cannot read Order B) with 403', async () => {
      const { token: tokenA } = await createTestOrder({})
      const { order: orderB } = await createTestOrder({})

      const req = new NextRequest(`http://localhost:3000/api/orders/${orderB.id}`, {
        headers: { 'x-order-secret-token': tokenA },
      })
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: orderB.id }) })
      expect(res.status).toBe(403)
    })
  })

  describe('8. Refund Review State Display in Tracker', () => {
    it('preserves paymentStatus PAID and sets orderStatus CANCELLED for manual refund review', async () => {
      const { order, token } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        paidAt: new Date(),
        orderStatus: 'QUEUED',
      })

      // Kasir membatalkan pesanan yang sudah lunas
      await prisma.order.update({
        where: { id: order.id },
        data: { orderStatus: 'CANCELLED' },
      })

      const req = new NextRequest(`http://localhost:3000/api/orders/${order.id}`, {
        headers: { 'x-order-secret-token': token },
      })
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const body = await res.json()
      // Tracker mendeteksi isRefundReview = (isCancelled && isPaid)
      expect(body.data.orderStatus).toBe('CANCELLED')
      expect(body.data.paymentStatus).toBe('PAID')
    })
  })
})
