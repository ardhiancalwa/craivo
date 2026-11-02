// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/server/db'
import { GET as getOrdersHandler } from '@/app/api/staff/orders/route'
import { POST as confirmCashHandler } from '@/app/api/staff/orders/[id]/confirm-cash/route'
import { POST as cancelOrderHandler } from '@/app/api/staff/orders/[id]/cancel/route'
import { POST as refundOrderHandler } from '@/app/api/staff/orders/[id]/refund/route'
import { signStaffToken } from '@/lib/server/auth'
import crypto from 'node:crypto'

describe('Tahap 13: POS Cashier Dashboard & Cash Flow Integration Suite', () => {
  let cashierToken: string
  let adminToken: string
  let baristaToken: string

  let cashierUser: { id: string; username: string }
  let adminUser: { id: string; username: string }
  let baristaUser: { id: string; username: string }

  let tableId: string
  let testMenuItemId: string
  const createdOrderIds: string[] = []

  beforeAll(async () => {
    // 1. Get or create test table
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '01' } })
    tableId = table.id

    // 2. Get test menu item
    const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { id: 'menu-kopi-sela' } })
    testMenuItemId = menuItem.id

    // 3. Find or create staff users
    const cashier = await prisma.staffUser.findFirstOrThrow({ where: { role: 'CASHIER', isActive: true } })
    cashierUser = { id: cashier.id, username: cashier.username }
    cashierToken = await signStaffToken({
      sub: cashier.id,
      username: cashier.username,
      displayName: cashier.displayName,
      role: cashier.role,
    })

    const admin = await prisma.staffUser.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } })
    adminUser = { id: admin.id, username: admin.username }
    adminToken = await signStaffToken({
      sub: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    })

    const barista = await prisma.staffUser.findFirstOrThrow({ where: { role: 'BARISTA', isActive: true } })
    baristaUser = { id: barista.id, username: barista.username }
    baristaToken = await signStaffToken({
      sub: barista.id,
      username: barista.username,
      displayName: barista.displayName,
      role: barista.role,
    })
  })

  afterAll(async () => {
    // Clean up created orders and related records
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
    totalAmount?: number
  }) {
    const uniqueSuffix = crypto.randomUUID().slice(0, 8)
    const tokenHash = crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex')
    const totalAmount = overrides.totalAmount ?? 28000

    const order = await prisma.order.create({
      data: {
        orderNumber: `POS-${Date.now()}-${uniqueSuffix}`,
        orderSecretTokenHash: tokenHash,
        tableId,
        subtotalAmount: totalAmount,
        totalAmount,
        paymentMethod: overrides.paymentMethod ?? 'CASH',
        paymentStatus: overrides.paymentStatus ?? 'WAITING_CASHIER',
        orderStatus: overrides.orderStatus ?? 'QUEUED',
        customerNotes: 'Kurang manis',
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
        items: true,
      },
    })

    createdOrderIds.push(order.id)
    return order
  }

  describe('1. GET /api/staff/orders — POS Orders List & Filtering', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const req = new Request('http://localhost:3000/api/staff/orders?tab=cash_queue')
      const res = await getOrdersHandler(req)
      expect(res.status).toBe(401)
    })

    it('rejects BARISTA / KITCHEN role with 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/staff/orders?tab=cash_queue', {
        headers: {
          Authorization: `Bearer ${baristaToken}`,
        },
      })
      const res = await getOrdersHandler(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('FORBIDDEN')
    })

    it('allows CASHIER role to fetch orders and filters cash_queue properly', async () => {
      const cashOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
      })

      const req = new Request('http://localhost:3000/api/staff/orders?tab=cash_queue', {
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      })
      const res = await getOrdersHandler(req)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.tab).toBe('cash_queue')
      expect(data.counts.cashQueue).toBeGreaterThanOrEqual(1)

      const found = data.orders.find((o: { id: string }) => o.id === cashOrder.id)
      expect(found).toBeDefined()
      expect(found.orderNumber).toBe(cashOrder.orderNumber)
      expect(found.paymentMethod).toBe('CASH')
      expect(found.paymentStatus).toBe('WAITING_CASHIER')
      expect(found.items.length).toBe(1)
      expect(found.customerNotes).toBe('Kurang manis')
    })

    it('filters paid_history tab showing only PAID orders', async () => {
      const paidOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'QUEUED',
      })

      const req = new Request('http://localhost:3000/api/staff/orders?tab=paid_history', {
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      })
      const res = await getOrdersHandler(req)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      const found = data.orders.find((o: { id: string }) => o.id === paidOrder.id)
      expect(found).toBeDefined()
      expect(found.paymentStatus).toBe('PAID')
    })

    it('filters cancelled_history tab showing CANCELLED orders', async () => {
      const cancelledOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'CANCELLED',
      })

      const req = new Request('http://localhost:3000/api/staff/orders?tab=cancelled_history', {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      })
      const res = await getOrdersHandler(req)
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      const found = data.orders.find((o: { id: string }) => o.id === cancelledOrder.id)
      expect(found).toBeDefined()
      expect(found.orderStatus).toBe('CANCELLED')
    })
  })

  describe('2. POST /api/staff/orders/[id]/confirm-cash — Atomic Confirmation & Anti Click-Ganda', () => {
    it('rejects BARISTA / KITCHEN role with 403 Forbidden', async () => {
      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/confirm-cash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${baristaToken}`,
        },
      })

      const res = await confirmCashHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('FORBIDDEN')
    })

    it('rejects confirmation for QRIS order with 400 Bad Request', async () => {
      const qrisOrder = await createTestOrder({
        paymentMethod: 'QRIS',
        paymentStatus: 'UNPAID',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${qrisOrder.id}/confirm-cash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      })

      const res = await confirmCashHandler(req, { params: Promise.resolve({ id: qrisOrder.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('INVALID_PAYMENT_METHOD')
    })

    it('rejects confirmation for CANCELLED order with 400 Bad Request', async () => {
      const cancelledOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'CANCELLED',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${cancelledOrder.id}/confirm-cash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      })

      const res = await confirmCashHandler(req, { params: Promise.resolve({ id: cancelledOrder.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('ORDER_CANCELLED')
    })

    it('successfully confirms unpaid cash order atomically', async () => {
      // Record initial soldCount
      const initialMenu = await prisma.menuItem.findUniqueOrThrow({ where: { id: testMenuItemId } })
      const initialSoldCount = initialMenu.soldCount

      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'QUEUED',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/confirm-cash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cashierToken}`,
        },
      })

      const res = await confirmCashHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.order.paymentStatus).toBe('PAID')
      expect(data.order.orderStatus).toBe('QUEUED')

      // Verify DB updates
      const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(updatedOrder.paymentStatus).toBe('PAID')
      expect(updatedOrder.paidAt).not.toBeNull()

      // Verify PaymentAttempt was created
      const attempt = await prisma.paymentAttempt.findFirst({
        where: { orderId: order.id },
      })
      expect(attempt).toBeDefined()
      expect(attempt?.gateway).toBe('MANUAL_CASH')
      expect(attempt?.status).toBe('PAID')

      // Verify MenuItem soldCount incremented
      const updatedMenu = await prisma.menuItem.findUniqueOrThrow({ where: { id: testMenuItemId } })
      expect(updatedMenu.soldCount).toBe(initialSoldCount + 1)

      // Verify exactly ONE OutboxEvent was emitted for KDS
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: order.id, eventType: 'ORDER_PAID' },
      })
      expect(outboxEvents.length).toBe(1)
      expect(outboxEvents[0]?.channel).toBe('KDS')

      // Verify AuditLog was recorded
      const auditLog = await prisma.auditLog.findFirst({
        where: { orderId: order.id, action: 'CONFIRM_CASH' },
      })
      expect(auditLog).toBeDefined()
      expect(auditLog?.staffUserId).toBe(cashierUser.id)
    })

    it('is idempotent: secondary confirm calls return 200 without duplicate events or double soldCount', async () => {
      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
      })

      const makeReq = () =>
        new Request(`http://localhost:3000/api/staff/orders/${order.id}/confirm-cash`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cashierToken}`,
          },
        })

      // First confirmation
      const res1 = await confirmCashHandler(makeReq(), { params: Promise.resolve({ id: order.id }) })
      expect(res1.status).toBe(200)

      const menuAfterFirst = await prisma.menuItem.findUniqueOrThrow({ where: { id: testMenuItemId } })
      const soldCountAfterFirst = menuAfterFirst.soldCount

      // Second confirmation (idempotent retry)
      const res2 = await confirmCashHandler(makeReq(), { params: Promise.resolve({ id: order.id }) })
      expect(res2.status).toBe(200)
      const data2 = await res2.json()
      expect(data2.success).toBe(true)

      // Verify soldCount did NOT increment again
      const menuAfterSecond = await prisma.menuItem.findUniqueOrThrow({ where: { id: testMenuItemId } })
      expect(menuAfterSecond.soldCount).toBe(soldCountAfterFirst)

      // Verify OutboxEvent is still exactly 1
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: order.id, eventType: 'ORDER_PAID' },
      })
      expect(outboxEvents.length).toBe(1)
    })

    it('concurrency test: simultaneous confirm requests by 2 cashiers result in exactly 1 mutation', async () => {
      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
      })

      const reqA = new Request(`http://localhost:3000/api/staff/orders/${order.id}/confirm-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cashierToken}` },
      })
      const reqB = new Request(`http://localhost:3000/api/staff/orders/${order.id}/confirm-cash`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      // Execute both concurrently
      const [resA, resB] = await Promise.all([
        confirmCashHandler(reqA, { params: Promise.resolve({ id: order.id }) }),
        confirmCashHandler(reqB, { params: Promise.resolve({ id: order.id }) }),
      ])

      expect(resA.status).toBe(200)
      expect(resB.status).toBe(200)

      // Verify OutboxEvent is exactly 1 (no duplicate order paid events)
      const outboxEvents = await prisma.outboxEvent.findMany({
        where: { aggregateId: order.id, eventType: 'ORDER_PAID' },
      })
      expect(outboxEvents.length).toBe(1)
    })
  })

  describe('3. POST /api/staff/orders/[id]/cancel — Cancellation & Financial Invariant', () => {
    it('rejects BARISTA / KITCHEN role with 403 Forbidden', async () => {
      const order = await createTestOrder({ paymentMethod: 'CASH' })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ reason: 'Pelanggan membatalkan pesanan' }),
      })

      const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('requires a cancellation reason (minimum 3 characters)', async () => {
      const order = await createTestOrder({ paymentMethod: 'CASH' })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ reason: ' ' }),
      })

      const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('INVALID_REASON')
    })

    it('cancels unpaid order: orderStatus becomes CANCELLED', async () => {
      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ reason: 'Pelanggan berubah pikiran' }),
      })

      const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.order.orderStatus).toBe('CANCELLED')
      expect(data.order.requiresManualRefund).toBe(false)

      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(dbOrder.orderStatus).toBe('CANCELLED')

      const audit = await prisma.auditLog.findFirst({
        where: { orderId: order.id, action: 'ORDER_CANCELLED_UNPAID' },
      })
      expect(audit).toBeDefined()
    })

    it('CRITICAL FINANCIAL INVARIANT: cancels PAID order, paymentStatus REMAINS PAID, requiresManualRefund is true', async () => {
      const paidOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'QUEUED',
        totalAmount: 56000,
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${paidOrder.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: 'Pelanggan harus segera ke bandara, minta refund tunai' }),
      })

      const res = await cancelOrderHandler(req, { params: Promise.resolve({ id: paidOrder.id }) })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.order.orderStatus).toBe('CANCELLED')
      expect(data.order.paymentStatus).toBe('PAID') // PAYMENT STATUS MUST REMAIN PAID!
      expect(data.order.requiresManualRefund).toBe(true)

      // Database verification
      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: paidOrder.id } })
      expect(dbOrder.orderStatus).toBe('CANCELLED')
      expect(dbOrder.paymentStatus).toBe('PAID') // Cash ledger intact!

      // Audit log verification
      const audit = await prisma.auditLog.findFirst({
        where: { orderId: paidOrder.id, action: 'ORDER_CANCELLED_PAID_REFUND_PENDING' },
      })
      expect(audit).toBeDefined()
    })
  })

  describe('4. POST /api/staff/orders/[id]/refund — Manual Cash Refund Record Keeping', () => {
    it('rejects BARISTA / KITCHEN role with 403 Forbidden', async () => {
      const order = await createTestOrder({ paymentMethod: 'CASH' })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ amount: 28000, reason: 'Pengembalian tunai' }),
      })

      const res = await refundOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('rejects refund on order that is NOT cancelled with 400 Bad Request', async () => {
      const activePaidOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'QUEUED',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${activePaidOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ amount: 28000, reason: 'Pengembalian uang' }),
      })

      const res = await refundOrderHandler(req, { params: Promise.resolve({ id: activePaidOrder.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('ORDER_NOT_CANCELLED')
    })

    it('rejects refund on order that was never paid with 400 Bad Request', async () => {
      const unpaidCancelledOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: 'CANCELLED',
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${unpaidCancelledOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ amount: 28000, reason: 'Pengembalian uang' }),
      })

      const res = await refundOrderHandler(req, { params: Promise.resolve({ id: unpaidCancelledOrder.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('ORDER_NOT_PAID')
    })

    it('rejects refund when amount exceeds order total with 400 Bad Request', async () => {
      const cancelledPaidOrder = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'CANCELLED',
        totalAmount: 30000,
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${cancelledPaidOrder.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({ amount: 35000, reason: 'Pengembalian berlebih' }),
      })

      const res = await refundOrderHandler(req, { params: Promise.resolve({ id: cancelledPaidOrder.id }) })
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('REFUND_EXCEEDS_TOTAL')
    })

    it('records valid manual cash refund and creates ManualRefundRecord without modifying paymentStatus', async () => {
      const order = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'CANCELLED',
        totalAmount: 50000,
      })

      const req = new Request(`http://localhost:3000/api/staff/orders/${order.id}/refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          amount: 50000,
          reason: 'Uang fisik diserahkan langsung ke pelanggan di meja kasir',
          notes: 'Disaksikan oleh barista jaga',
        }),
      })

      const res = await refundOrderHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.refund.amount).toBe(50000)
      expect(data.refund.refundMethod).toBe('MANUAL_CASH')
      expect(data.order.remainingRefundable).toBe(0)

      // Database verification: ManualRefundRecord created
      const refundRecord = await prisma.manualRefundRecord.findFirst({
        where: { orderId: order.id },
      })
      expect(refundRecord).toBeDefined()
      expect(refundRecord?.amount).toBe(50000)
      expect(refundRecord?.staffUserId).toBe(cashierUser.id)
      expect(refundRecord?.refundMethod).toBe('MANUAL_CASH')

      // Database verification: paymentStatus is STILL PAID (not fictitiously changed to REFUNDED)
      const dbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
      expect(dbOrder.paymentStatus).toBe('PAID')

      // Database verification: AuditLog MANUAL_REFUND_COMPLETED recorded
      const audit = await prisma.auditLog.findFirst({
        where: { orderId: order.id, action: 'MANUAL_REFUND_COMPLETED' },
      })
      expect(audit).toBeDefined()
    })
  })
})

