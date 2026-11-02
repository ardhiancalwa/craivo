// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { POST as postOrderRoute } from '@/app/api/orders/route'
import { POST as postPayQrisRoute } from '@/app/api/orders/[id]/pay/qris/route'
import { GET as getPayStatusRoute } from '@/app/api/orders/[id]/pay/status/route'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'

describe('Midtrans Core API QRIS Charge Integration Suite (Live Sandbox & DB)', () => {
  let tableNumber: string
  let guestSessionToken: string
  let guestSessionId: string
  let orderId: string
  let orderSecretToken: string
  let orderNumber: string
  let sampleTotalAmount: number
  const createdOrderIds: string[] = []
  const createdGuestSessionIds: string[] = []
  const createdIdempotencyKeys: string[] = []

  beforeAll(async () => {
    // 1. Ambil meja aktif dari DB
    const table = await prisma.table.findFirst({
      where: { isActive: true },
    })
    expect(table).not.toBeNull()
    tableNumber = table!.tableNumber

    // 2. Buat Guest Session
    const session = await createGuestSession(table!.id)
    guestSessionToken = session.token
    guestSessionId = session.id
    createdGuestSessionIds.push(session.id)

    // 3. Ambil menu item aktif yang tidak mewajibkan modifier
    const item = await prisma.menuItem.findFirstOrThrow({
      where: {
        isArchived: false,
        isAvailable: true,
        modifierGroups: { none: { group: { isRequired: true } } },
      },
    })
    expect(item).not.toBeNull()

    // 4. Buat Order Quote resmi
    const quote = await createOrderQuote({
      tableNumber,
      guestSessionId,
      items: [{ menuItemId: item!.id, quantity: 1, selectedModifierOptionIds: [] }],
    })

    // 5. Buat Order resmi via POST /api/orders
    const idemKey = crypto.randomUUID()
    createdIdempotencyKeys.push(idemKey)

    const orderReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'Idempotency-Key': idemKey,
        cookie: `cravio_guest=${guestSessionToken}`,
      },
      body: JSON.stringify({
        tableNumber,
        paymentMethod: 'QRIS',
        quoteToken: quote.quoteToken,
        items: [{ menuItemId: item!.id, quantity: 1, selectedModifierOptionIds: [] }],
      }),
    })

    const orderRes = await postOrderRoute(orderReq)
    const orderJson = await orderRes.json()
    if (orderRes.status !== 201) {
      console.error('Order creation failed with status:', orderRes.status, JSON.stringify(orderJson))
    }
    expect(orderRes.status).toBe(201)
    expect(orderJson.success).toBe(true)

    orderId = orderJson.data.orderId
    orderNumber = orderJson.data.orderNumber
    sampleTotalAmount = orderJson.data.totalAmount
    orderSecretToken = orderJson.data.orderSecretToken
    createdOrderIds.push(orderId)

    expect(orderId).toBeDefined()
    expect(orderSecretToken).toBeDefined()
  })

  afterAll(async () => {
    // Teardown: Bersihkan DB setelah pengujian selesai
    try {
      const validOrderIds = createdOrderIds.filter(Boolean)
      if (validOrderIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { orderId: { in: validOrderIds } },
        })
        await prisma.paymentAttempt.deleteMany({
          where: { orderId: { in: validOrderIds } },
        })
        await prisma.orderItemModifier.deleteMany({
          where: { orderItem: { orderId: { in: validOrderIds } } },
        })
        await prisma.orderItem.deleteMany({
          where: { orderId: { in: validOrderIds } },
        })
        await prisma.order.deleteMany({
          where: { id: { in: validOrderIds } },
        })
      }

      const validIdemKeys = createdIdempotencyKeys.filter(Boolean)
      if (validIdemKeys.length > 0) {
        await prisma.idempotencyRecord.deleteMany({
          where: { key: { in: validIdemKeys } },
        })
      }

      const validSessionIds = createdGuestSessionIds.filter(Boolean)
      if (validSessionIds.length > 0) {
        await prisma.guestSession.deleteMany({
          where: { id: { in: validSessionIds } },
        })
      }
    } catch (cleanErr) {
      console.warn('Teardown cleanup error:', cleanErr)
    }
  })

  it('1. Menolak inisialisasi QRIS jika tanpa Capability Token (403 Forbidden)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/qris`, {
      method: 'POST',
    })

    const res = await postPayQrisRoute(req, {
      params: Promise.resolve({ id: orderId }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('2. Berhasil menginisialisasi charge QRIS nyata ke Midtrans Sandbox (201 Created)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/qris`, {
      method: 'POST',
      headers: {
        'x-order-secret-token': orderSecretToken,
      },
    })

    const res = await postPayQrisRoute(req, {
      params: Promise.resolve({ id: orderId }),
    })
    const json = await res.json()
    if (res.status !== 201) {
      console.error('postPayQrisRoute returned non-201:', res.status, JSON.stringify(json))
    }

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)

    const data = json.data
    expect(data.reused).toBe(false)
    expect(data.grossAmount).toBe(sampleTotalAmount)
    expect(data.status).toBe('PENDING')
    expect(data.merchantOrderId).toMatch(new RegExp(`^${orderNumber}-P1`))
    expect(data.transactionId).toBeDefined()
    expect(typeof data.transactionId).toBe('string')

    // Midtrans Sandbox harus mengembalikan qrisUrl dan/atau qrisString
    expect(data.qrisUrl).toBeDefined()
    expect(data.qrisUrl).toContain('midtrans.com')

    // Verifikasi PaymentAttempt tercatat di PostgreSQL Neon
    const attemptInDb = await prisma.paymentAttempt.findFirst({
      where: { orderId },
    })
    expect(attemptInDb).not.toBeNull()
    expect(attemptInDb!.merchantOrderId).toBe(data.merchantOrderId)
    expect(attemptInDb!.grossAmount).toBe(sampleTotalAmount)
    expect(attemptInDb!.status).toBe('PENDING')
    expect(attemptInDb!.qrisUrl).toBe(data.qrisUrl)
  })

  it('3. Nominal transaksi di gateway persis sama dengan total snapshot server', async () => {
    const attemptInDb = await prisma.paymentAttempt.findFirst({
      where: { orderId },
    })
    expect(attemptInDb).not.toBeNull()
    expect(attemptInDb!.grossAmount).toBe(sampleTotalAmount)
  })

  it('4. Nir-Charge Ganda: refresh/panggilan ulang mengembalikan attempt yang sama (200 OK, reused: true)', async () => {
    const initialAttemptCount = await prisma.paymentAttempt.count({
      where: { orderId },
    })

    const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/qris`, {
      method: 'POST',
      headers: {
        'x-order-secret-token': orderSecretToken,
      },
    })

    const res = await postPayQrisRoute(req, {
      params: Promise.resolve({ id: orderId }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.reused).toBe(true)

    // Jumlah attempt di database tetap sama (tidak menduplikasi charge)
    const afterAttemptCount = await prisma.paymentAttempt.count({
      where: { orderId },
    })
    expect(afterAttemptCount).toBe(initialAttemptCount)
  })

  it('5. Menolak pemeriksaan status tanpa Capability Token (403 Forbidden)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/status`, {
      method: 'GET',
    })

    const res = await getPayStatusRoute(req, {
      params: Promise.resolve({ id: orderId }),
    })

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('FORBIDDEN')
  })

  it('6. Berhasil memeriksa status resmi ke Midtrans Get Status (GET /api/orders/[id]/pay/status)', async () => {
    const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/status`, {
      method: 'GET',
      headers: {
        'x-order-secret-token': orderSecretToken,
      },
    })

    const res = await getPayStatusRoute(req, {
      params: Promise.resolve({ id: orderId }),
    })

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.paymentStatus).toBe('PENDING')
    expect(json.data.remainingSeconds).toBeGreaterThan(0)
  })

  it('7. Invarian: status pesanan tetap PENDING dan KDS gate belum terbuka selama pembayaran belum settlement', async () => {
    const orderInDb = await prisma.order.findUnique({
      where: { id: orderId },
    })
    expect(orderInDb).not.toBeNull()
    expect(orderInDb!.paymentStatus).toBe('PENDING')
    expect(orderInDb!.paidAt).toBeNull()
  })
})
