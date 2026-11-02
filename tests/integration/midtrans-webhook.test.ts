// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { getServerEnv } from '@/lib/server/env'
import { POST as postOrderRoute } from '@/app/api/orders/route'
import { POST as postPayQrisRoute } from '@/app/api/orders/[id]/pay/qris/route'
import { POST as postWebhookRoute } from '@/app/api/webhooks/midtrans/route'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'

describe('Midtrans Webhook & State Transition Integration Suite (Live DB)', () => {
  let tableNumber: string
  let guestSessionToken: string
  let guestSessionId: string
  let orderId: string
  let orderSecretToken: string
  let orderNumber: string
  let sampleTotalAmount: number
  let merchantOrderId: string
  let menuItemId: string
  let initialSoldCount: number

  const createdOrderIds: string[] = []
  const createdGuestSessionIds: string[] = []
  const createdIdempotencyKeys: string[] = []

  beforeAll(async () => {
    // 1. Ambil meja aktif
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
    menuItemId = item.id
    initialSoldCount = item.soldCount

    // 4. Buat Order Quote
    const quote = await createOrderQuote({
      tableNumber,
      guestSessionId,
      items: [{ menuItemId, quantity: 2, selectedModifierOptionIds: [] }],
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
        items: [{ menuItemId, quantity: 2, selectedModifierOptionIds: [] }],
      }),
    })

    const orderRes = await postOrderRoute(orderReq)
    expect(orderRes.status).toBe(201)
    const orderJson = await orderRes.json()

    orderId = orderJson.data.orderId
    orderNumber = orderJson.data.orderNumber
    sampleTotalAmount = orderJson.data.totalAmount
    orderSecretToken = orderJson.data.orderSecretToken
    createdOrderIds.push(orderId)

    // 6. Inisialisasi QRIS PaymentAttempt
    const qrisReq = new NextRequest(`http://localhost:3000/api/orders/${orderId}/pay/qris`, {
      method: 'POST',
      headers: {
        'x-order-secret-token': orderSecretToken,
      },
    })

    const qrisRes = await postPayQrisRoute(qrisReq, {
      params: Promise.resolve({ id: orderId }),
    })
    expect(qrisRes.status).toBe(201)
    const qrisJson = await qrisRes.json()

    merchantOrderId = qrisJson.data.merchantOrderId
    expect(merchantOrderId).toBeDefined()
  })

  afterAll(async () => {
    try {
      const validOrderIds = createdOrderIds.filter(Boolean)
      if (validOrderIds.length > 0) {
        await prisma.auditLog.deleteMany({
          where: { orderId: { in: validOrderIds } },
        })
        await prisma.outboxEvent.deleteMany({
          where: { aggregateId: { in: validOrderIds } },
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

  function generateSignature(oid: string, sc: string, amt: string): string {
    const env = getServerEnv()
    const raw = `${oid}${sc}${amt}${env.MIDTRANS_SERVER_KEY}`
    return crypto.createHash('sha512').update(raw).digest('hex')
  }

  it('1. Menolak webhook dengan Signature SHA-512 palsu (403 Forbidden)', async () => {
    const grossAmountStr = `${sampleTotalAmount}.00`
    const fakeSignature = 'bad00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: grossAmountStr,
      signature_key: fakeSignature,
      transaction_status: 'settlement',
      transaction_id: `tx-${Date.now()}`,
      payment_type: 'qris',
      currency: 'IDR',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.code).toBe('INVALID_SIGNATURE')
  })

  it('2. Menolak webhook bila nominal gross_amount tidak cocok dengan snapshot server (400 Bad Request)', async () => {
    const tamperedAmount = `${sampleTotalAmount + 10000}.00`
    const sig = generateSignature(merchantOrderId, '200', tamperedAmount)

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: tamperedAmount,
      signature_key: sig,
      transaction_status: 'settlement',
      transaction_id: `tx-${Date.now()}`,
      payment_type: 'qris',
      currency: 'IDR',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.message).toContain('Amount mismatch')
  })

  it('3. Menolak status capture generik pada transaksi QRIS (400 Bad Request)', async () => {
    const grossAmountStr = `${sampleTotalAmount}.00`
    const sig = generateSignature(merchantOrderId, '200', grossAmountStr)

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'capture', // Generik alur kartu kredit (tidak sah untuk QRIS)
      transaction_id: `tx-${Date.now()}`,
      payment_type: 'qris',
      currency: 'IDR',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error.message).toContain("Status 'capture' tidak sah")
  })

  it('4. Berhasil memproses webhook settlement sah: transisi PAID, buka gate KDS, dan emit OutboxEvent', async () => {
    const grossAmountStr = `${sampleTotalAmount}.00`
    const sig = generateSignature(merchantOrderId, '200', grossAmountStr)
    const txId = `tx-settle-${Date.now()}`

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'settlement',
      transaction_id: txId,
      payment_type: 'qris',
      currency: 'IDR',
      settlement_time: '2026-10-29 12:00:00',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.settled).toBe(true)

    // Verifikasi state database Neon
    const orderInDb = await prisma.order.findUnique({
      where: { id: orderId },
    })
    expect(orderInDb).not.toBeNull()
    expect(orderInDb!.paymentStatus).toBe('PAID')
    expect(orderInDb!.orderStatus).toBe('QUEUED') // Gate KDS Dapur terbuka
    expect(orderInDb!.paidAt).not.toBeNull()

    // Verifikasi PaymentAttempt diperbarui
    const attemptInDb = await prisma.paymentAttempt.findFirst({
      where: { merchantOrderId },
    })
    expect(attemptInDb).not.toBeNull()
    expect(attemptInDb!.status).toBe('PAID')
    expect(attemptInDb!.transactionId).toBe(txId)

    // Verifikasi kenaikan soldCount menu item (+2)
    const itemInDb = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
    })
    expect(itemInDb!.soldCount).toBe(initialSoldCount + 2)

    // Verifikasi penerbitan satu durable OutboxEvent
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: orderId,
        eventType: 'ORDER_PAID',
      },
    })
    expect(outboxEvents.length).toBe(1)
    expect(outboxEvents[0]?.channel).toBe('KDS')
  })

  it('5. Idempotensi Webhook: Callback settlement kedua direspons 200 OK tanpa menduplikasi omzet atau event', async () => {
    const grossAmountStr = `${sampleTotalAmount}.00`
    const sig = generateSignature(merchantOrderId, '200', grossAmountStr)

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'settlement',
      transaction_id: `tx-duplicate-${Date.now()}`,
      payment_type: 'qris',
      currency: 'IDR',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.deduplicated).toBe(true)

    // soldCount tidak bertambah lagi (tetap initial + 2)
    const itemInDb = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
    })
    expect(itemInDb!.soldCount).toBe(initialSoldCount + 2)

    // OutboxEvent tetap tepat 1
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateId: orderId,
        eventType: 'ORDER_PAID',
      },
    })
    expect(outboxEvents.length).toBe(1)
  })

  it('6. Out-of-Order Safety: Callback expire/cancel yang tiba setelah pesanan PAID diabaikan dengan aman', async () => {
    const grossAmountStr = `${sampleTotalAmount}.00`
    const sig = generateSignature(merchantOrderId, '200', grossAmountStr)

    const payload = {
      order_id: merchantOrderId,
      status_code: '200',
      gross_amount: grossAmountStr,
      signature_key: sig,
      transaction_status: 'expire', // Notifikasi basi yang tiba terlambat
      transaction_id: `tx-expire-${Date.now()}`,
      payment_type: 'qris',
      currency: 'IDR',
    }

    const req = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await postWebhookRoute(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.ignored).toBe(true)

    // Status order di database TETAP PAID (tidak diturunkan ke EXPIRED)
    const orderInDb = await prisma.order.findUnique({
      where: { id: orderId },
    })
    expect(orderInDb!.paymentStatus).toBe('PAID')
    expect(orderInDb!.orderStatus).toBe('QUEUED')
  })
})

