// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { getServerEnv } from '@/lib/server/env'
import { POST as postCronReconcileRoute } from '@/app/api/cron/reconcile-payments/route'
import { reconcilePendingAndExpiredOrders } from '@/lib/server/reconciliation-service'
import * as midtransModule from '@/lib/server/midtrans'
import { createGuestSession } from '@/lib/server/guest-session'

describe('Payment Reconciliation & Expiry Scheduled Job Integration Suite (Live DB)', () => {
  let tableId: string
  let guestSessionId: string

  const createdOrderIds: string[] = []
  const createdGuestSessionIds: string[] = []

  beforeAll(async () => {
    const table = await prisma.table.findFirst({
      where: { isActive: true },
    })
    expect(table).not.toBeNull()
    tableId = table!.id

    const session = await createGuestSession(tableId)
    guestSessionId = session.id
    createdGuestSessionIds.push(session.id)
  })

  afterAll(async () => {
    vi.restoreAllMocks()

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

  it('1. POST /api/cron/reconcile-payments menolak permintaan tanpa Bearer CRON_SECRET yang sah (401)', async () => {
    // Tanpa header
    const req1 = new NextRequest('http://localhost:3000/api/cron/reconcile-payments', {
      method: 'POST',
    })
    const res1 = await postCronReconcileRoute(req1)
    expect(res1.status).toBe(401)

    // Token salah
    const req2 = new NextRequest('http://localhost:3000/api/cron/reconcile-payments', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer invalid_secret_token_12345',
      },
    })
    const res2 = await postCronReconcileRoute(req2)
    expect(res2.status).toBe(401)
  })

  it('2. POST /api/cron/reconcile-payments berhasil dieksekusi dengan Authorization Bearer CRON_SECRET yang sah (200)', async () => {
    const env = getServerEnv()
    const req = new NextRequest('http://localhost:3000/api/cron/reconcile-payments', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CRON_SECRET}`,
      },
    })

    const res = await postCronReconcileRoute(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.totalScanned).toBeDefined()
  })

  it('3. Rekonsiliasi otomatis: Order yang kedaluwarsa (>15 menit) dan tidak ada di gateway disinkronkan ke EXPIRED', async () => {
    const orderNumber = `RECON-TEST-EXP-${Date.now()}`
    const merchantOrderId = `${orderNumber}-P1`

    // Buat order buatan yang sudah lewat batas waktu (expiresAt 5 menit lalu)
    const testOrder = await prisma.order.create({
      data: {
        orderNumber,
        tableId,
        guestSessionId,
        orderSecretTokenHash: crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex'),
        subtotalAmount: 28000,
        taxAmount: 0,
        serviceAmount: 0,
        totalAmount: 28000,
        orderStatus: 'QUEUED',
        paymentStatus: 'PENDING',
        paymentMethod: 'QRIS',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000), // Lampau
      },
    })
    createdOrderIds.push(testOrder.id)

    await prisma.paymentAttempt.create({
      data: {
        orderId: testOrder.id,
        merchantOrderId,
        gateway: 'MIDTRANS',
        grossAmount: 28000,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    })

    // Jalankan rekonsiliasi
    const reconResult = await reconcilePendingAndExpiredOrders({ limit: 10 })
    expect(reconResult.success).toBe(true)
    expect(reconResult.expiredCount).toBeGreaterThan(0)

    // Periksa status order di database Neon
    const orderInDb = await prisma.order.findUnique({
      where: { id: testOrder.id },
    })
    expect(orderInDb!.paymentStatus).toBe('EXPIRED')

    // Periksa audit log
    const auditLogs = await prisma.auditLog.findMany({
      where: { orderId: testOrder.id },
    })
    expect(auditLogs.length).toBeGreaterThan(0)
    expect(auditLogs[0]?.action).toContain('ORDER_EXPIRED')
  })

  it('4. Penanganan Dana Masuk Pasca Kedaluwarsa: Uang dicatat sah di laporan keuangan, order ditandai review kasir, KDS dapur tidak memasak', async () => {
    const orderNumber = `RECON-LATE-PAY-${Date.now()}`
    const merchantOrderId = `${orderNumber}-P1`

    // Buat order yang sudah terlanjur berstatus EXPIRED dan CANCELLED
    const testOrder = await prisma.order.create({
      data: {
        orderNumber,
        tableId,
        guestSessionId,
        orderSecretTokenHash: crypto.createHash('sha256').update(crypto.randomUUID()).digest('hex'),
        subtotalAmount: 38000,
        taxAmount: 0,
        serviceAmount: 0,
        totalAmount: 38000,
        orderStatus: 'CANCELLED', // Dibatalkan
        paymentStatus: 'EXPIRED', // Sudah kedaluwarsa
        paymentMethod: 'QRIS',
        expiresAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    })
    createdOrderIds.push(testOrder.id)

    // Ubah sementara status paymentStatus ke PENDING untuk disimulasikan rekonsiliasi
    await prisma.order.update({
      where: { id: testOrder.id },
      data: { paymentStatus: 'PENDING' },
    })

    const attempt = await prisma.paymentAttempt.create({
      data: {
        orderId: testOrder.id,
        merchantOrderId,
        gateway: 'MIDTRANS',
        grossAmount: 38000,
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    })

    // Mock Midtrans getTransactionStatus untuk mengembalikan 'settlement'
    // Mensimulasikan nasabah mentransfer tepat saat sistem kafe menganggap order sudah lewat batas
    vi.spyOn(midtransModule, 'getTransactionStatus').mockImplementation(async (oid: string) => {
      if (oid === merchantOrderId) {
        return {
          notFound: false,
          statusCode: '200',
          statusMessage: 'Success, transaction is found',
          transactionId: 'tx-late-payment-999',
          orderId: merchantOrderId,
          grossAmount: 38000,
          transactionStatus: 'settlement',
          transactionTime: new Date().toISOString(),
          rawResponse: { simulated: true },
        }
      }
      return midtransModule.getTransactionStatus(oid)
    })

    // Sebelum rekonsiliasi, set orderStatus ke CANCELLED untuk mensimulasikan late payment setelah order dibatalkan
    await prisma.order.update({
      where: { id: testOrder.id },
      data: { orderStatus: 'CANCELLED' },
    })

    const reconResult = await reconcilePendingAndExpiredOrders({ limit: 10 })
    expect(reconResult.success).toBe(true)
    expect(reconResult.settledAfterExpiryCount).toBe(1)

    // Verifikasi database:
    const updatedOrder = await prisma.order.findUnique({
      where: { id: testOrder.id },
    })
    // 1. Uang masuk dicatat sah (PAID) sehingga tidak hilang dari omzet dan laporan kas
    expect(updatedOrder!.paymentStatus).toBe('PAID')
    expect(updatedOrder!.paidAt).not.toBeNull()
    // 2. KDS dapur TIDAK otomatis memasak order yang sudah dibatalkan (orderStatus TETAP CANCELLED)
    expect(updatedOrder!.orderStatus).toBe('CANCELLED')

    // 3. Status PaymentAttempt tercatat PAID
    const updatedAttempt = await prisma.paymentAttempt.findUnique({
      where: { id: attempt.id },
    })
    expect(updatedAttempt!.status).toBe('PAID')
    expect(updatedAttempt!.transactionId).toBe('tx-late-payment-999')

    // 4. Audit Log tercatat untuk SOP refund manual kasir/admin
    const reviewLog = await prisma.auditLog.findFirst({
      where: {
        orderId: testOrder.id,
        action: 'PAYMENT_SETTLED_AFTER_EXPIRY_REVIEW_REQUIRED',
      },
    })
    expect(reviewLog).not.toBeNull()
    expect(reviewLog!.details).toContain('SOP refund manual')
  })
})
