// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { prisma } from '@/lib/server/db'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'
import { createOrderFromQuote } from '@/lib/server/order-service'
import { claimIdempotencyKey } from '@/lib/server/idempotency'
import { chargeQris } from '@/lib/server/midtrans'
import { handleMidtransWebhook } from '@/lib/server/webhook-service'
import { PATCH as updateOrderStatusHandler } from '@/app/api/staff/orders/[id]/status/route'
import { POST as postWebhookRoute } from '@/app/api/webhooks/midtrans/route'
import { POST as confirmCashHandler } from '@/app/api/staff/orders/[id]/confirm-cash/route'
import { signStaffToken } from '@/lib/server/auth'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'

describe('End-to-End Real Sandbox & Cash Operations Suite', () => {
  it('Alur A: Menjalankan Transaksi Asli Midtrans QRIS Sandbox (Nir-Fixture)', async () => {
    // 1. Deteksi Meja 07
    const table = await prisma.table.findUniqueOrThrow({ where: { tableNumber: '07' } })
    expect(table).toBeDefined()
    expect(table.isActive).toBe(true)

    // 2. Sesi Tamu
    const session = await createGuestSession(table.id)
    expect(session.id).toBeDefined()

    // 3. Menu Kopi Sela dengan modifier wajib yang dipilih
    const menuItem = await prisma.menuItem.findFirstOrThrow({
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

    const selectedModifierOptionIds = menuItem.modifierGroups
      .filter((mg) => mg.group.isRequired)
      .map((mg) => mg.group.options[0]?.id)
      .filter((id): id is string => Boolean(id))

    // 4. Server-Authoritative Quote
    const quote = await createOrderQuote({
      tableNumber: '07',
      guestSessionId: session.id,
      items: [{ menuItemId: menuItem.id, quantity: 1, selectedModifierOptionIds }],
    })
    expect(quote.totalAmount).toBeGreaterThanOrEqual(menuItem.price)

    // 5. Checkout QRIS
    const idemKey = crypto.randomUUID()
    const claim = await claimIdempotencyKey({
      key: idemKey,
      scope: 'CREATE_ORDER',
      ownerId: session.id,
      requestHash: crypto.randomBytes(16).toString('hex'),
    })

    const orderRes = await createOrderFromQuote({
      tableNumber: '07',
      paymentMethod: 'QRIS',
      quoteToken: quote.quoteToken,
      items: [{ menuItemId: menuItem.id, quantity: 1, selectedModifierOptionIds }],
      guestSessionId: session.id,
      idempotencyRecordId: claim.record.id,
    })

    const order = orderRes.order
    expect(order.orderNumber).toBeDefined()
    expect(order.paymentStatus).toBe('UNPAID')

    // 6. Charge Midtrans Sandbox Nyata
    const chargeRes = await chargeQris({
      orderId: `${order.orderNumber}-P1`,
      grossAmount: order.totalAmount,
      expiryMinutes: 15,
    })

    expect(chargeRes.statusCode).toBe('201')
    expect(chargeRes.transactionId).toBeDefined()
    expect(chargeRes.qrUrl).toBeDefined()
    expect(chargeRes.qrUrl).toContain('midtrans.com')

    // Catat PaymentAttempt
    await prisma.paymentAttempt.create({
      data: {
        orderId: order.orderId,
        merchantOrderId: `${order.orderNumber}-P1`,
        transactionId: chargeRes.transactionId,
        grossAmount: order.totalAmount,
        gateway: 'MIDTRANS',
        qrisUrl: chargeRes.qrUrl,
        qrisString: chargeRes.qrString,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    })

    // 7. Webhook Signature SHA-512 Settlement
    const serverKey = process.env.MIDTRANS_SERVER_KEY || 'SB-Mid-server-test-key-cravio'
    const grossStr = `${order.totalAmount}.00`
    const signatureKey = crypto
      .createHash('sha512')
      .update(`${order.orderNumber}-P1200${grossStr}${serverKey}`)
      .digest('hex')

    const webhookPayload = {
      order_id: `${order.orderNumber}-P1`,
      status_code: '200',
      gross_amount: grossStr,
      signature_key: signatureKey,
      transaction_status: 'settlement',
      payment_type: 'qris',
      transaction_time: new Date().toISOString(),
      transaction_id: chargeRes.transactionId,
      fraud_status: 'accept',
    }

    const webhookReq = new NextRequest('http://localhost:3000/api/webhooks/midtrans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(webhookPayload),
    })

    const webhookRes = await postWebhookRoute(webhookReq)
    expect(webhookRes.status).toBe(200)

    // 8. Kitchen Gate Verifikasi: Status PAID
    const paidDbOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })
    expect(paidDbOrder.paymentStatus).toBe('PAID')

    // 9. Transisi Status Masak di Dapur (QUEUED -> COOKING -> READY -> COMPLETED)
    const staffBarista = await prisma.staffUser.findFirstOrThrow({
      where: { role: 'BARISTA', isActive: true },
    })

    const baristaToken = await signStaffToken({
      sub: staffBarista.id,
      username: staffBarista.username,
      displayName: staffBarista.displayName,
      role: 'BARISTA',
    })

    const makeStatusReq = (newStatus: string) =>
      new Request(`http://localhost:3000/api/staff/orders/${order.orderId}/status`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

    const cookingRes = await updateOrderStatusHandler(makeStatusReq('COOKING'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(cookingRes.status).toBe(200)

    const readyRes = await updateOrderStatusHandler(makeStatusReq('READY'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(readyRes.status).toBe(200)

    const completedRes = await updateOrderStatusHandler(makeStatusReq('COMPLETED'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(completedRes.status).toBe(200)
  })

  it('Alur B: Menjalankan Transaksi Tunai Lengkap & Proteksi Kitchen Gate Kasir POS', async () => {
    const table = await prisma.table.findUniqueOrThrow({ where: { tableNumber: '07' } })
    const session = await createGuestSession(table.id)
    const menuItem = await prisma.menuItem.findFirstOrThrow({
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

    const selectedModifierOptionIds = menuItem.modifierGroups
      .filter((mg) => mg.group.isRequired)
      .map((mg) => mg.group.options[0]?.id)
      .filter((id): id is string => Boolean(id))

    const quote = await createOrderQuote({
      tableNumber: '07',
      guestSessionId: session.id,
      items: [{ menuItemId: menuItem.id, quantity: 2, selectedModifierOptionIds }],
    })

    const idemKey = crypto.randomUUID()
    const claim = await claimIdempotencyKey({
      key: idemKey,
      scope: 'CREATE_ORDER',
      ownerId: session.id,
      requestHash: crypto.randomBytes(16).toString('hex'),
    })

    const orderRes = await createOrderFromQuote({
      tableNumber: '07',
      paymentMethod: 'CASH',
      quoteToken: quote.quoteToken,
      items: [{ menuItemId: menuItem.id, quantity: 2, selectedModifierOptionIds }],
      guestSessionId: session.id,
      idempotencyRecordId: claim.record.id,
    })

    const order = orderRes.order
    expect(order.paymentStatus).toBe('WAITING_CASHIER')

    // KITCHEN GATE CHECK 1: Pesanan belum lunas DILARANG muncul di KDS
    const kdsBefore = await prisma.order.findMany({
      where: {
        orderStatus: { in: ['QUEUED', 'COOKING', 'READY'] },
        paymentStatus: 'PAID',
      },
    })
    expect(kdsBefore.some((o) => o.id === order.orderId)).toBe(false)

    // Kasir POS Konfirmasi Uang Masuk via route handler resmi
    const staffKasir = await prisma.staffUser.findFirstOrThrow({
      where: { role: 'CASHIER', isActive: true },
    })

    const cashierToken = await signStaffToken({
      sub: staffKasir.id,
      username: staffKasir.username,
      displayName: staffKasir.displayName,
      role: 'CASHIER',
    })

    const req = new Request(`http://localhost:3000/api/staff/orders/${order.orderId}/confirm-cash`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cashierToken}`,
      },
    })

    const res = await confirmCashHandler(req, {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(res.status).toBe(200)

    const paidCashOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.orderId } })
    expect(paidCashOrder.paymentStatus).toBe('PAID')

    // KITCHEN GATE CHECK 2: Sekarang WAJIB muncul di KDS
    const kdsAfter = await prisma.order.findMany({
      where: {
        orderStatus: { in: ['QUEUED', 'COOKING', 'READY'] },
        paymentStatus: 'PAID',
      },
    })
    expect(kdsAfter.some((o) => o.id === order.orderId)).toBe(true)

    // Dapur memproses hingga selesai
    const staffBarista = await prisma.staffUser.findFirstOrThrow({
      where: { role: 'BARISTA', isActive: true },
    })

    const baristaToken = await signStaffToken({
      sub: staffBarista.id,
      username: staffBarista.username,
      displayName: staffBarista.displayName,
      role: 'BARISTA',
    })

    const makeStatusReq = (newStatus: string) =>
      new Request(`http://localhost:3000/api/staff/orders/${order.orderId}/status`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({ status: newStatus }),
      })

    const cookingRes = await updateOrderStatusHandler(makeStatusReq('COOKING'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(cookingRes.status).toBe(200)

    const readyRes = await updateOrderStatusHandler(makeStatusReq('READY'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(readyRes.status).toBe(200)

    const completedRes = await updateOrderStatusHandler(makeStatusReq('COMPLETED'), {
      params: Promise.resolve({ id: order.orderId }),
    })
    expect(completedRes.status).toBe(200)
  })
})
