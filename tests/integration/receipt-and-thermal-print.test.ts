// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/lib/server/db'
import { POST as printLogHandler } from '@/app/api/orders/[id]/print-log/route'
import { GET as downloadReceiptHandler } from '@/app/api/orders/[id]/receipt/download/route'
import { signStaffToken } from '@/lib/server/auth'
import { hashOrderSecretToken } from '@/lib/server/order-capability'
import crypto from 'node:crypto'

describe('Tahap 16: Struk Digital & Layout Cetak Thermal Integration Suite', () => {
  let cashierToken: string
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
    // Cleanup created test orders & cascade relations
    if (createdOrderIds.length > 0) {
      await prisma.printLog.deleteMany({ where: { orderId: { in: createdOrderIds } } })
      await prisma.auditLog.deleteMany({ where: { orderId: { in: createdOrderIds } } })
      await prisma.orderItemModifier.deleteMany({
        where: { orderItem: { orderId: { in: createdOrderIds } } },
      })
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } })
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } })
    }
  })

  // Helper untuk membuat pesanan uji dengan snapshot kekal
  async function createTestOrder(overrides: {
    paymentMethod?: 'CASH' | 'QRIS'
    paymentStatus?: 'UNPAID' | 'WAITING_CASHIER' | 'PAID' | 'EXPIRED'
    orderStatus?: 'QUEUED' | 'COOKING' | 'READY' | 'COMPLETED' | 'CANCELLED'
    paidAt?: Date | null
    customerNotes?: string | null
    customItemName?: string
  }) {
    const rawSecretToken = `st_${crypto.randomBytes(16).toString('hex')}`
    const tokenHash = hashOrderSecretToken(rawSecretToken)
    const uniqueNum = `SL-PRINT-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    const order = await prisma.order.create({
      data: {
        orderNumber: uniqueNum,
        orderSecretTokenHash: tokenHash,
        tableId,
        subtotalAmount: 38000,
        taxAmount: 0,
        serviceAmount: 0,
        totalAmount: 38000,
        paymentMethod: overrides.paymentMethod ?? 'CASH',
        paymentStatus: overrides.paymentStatus ?? 'PAID',
        orderStatus: overrides.orderStatus ?? 'QUEUED',
        paidAt: overrides.paidAt !== undefined ? overrides.paidAt : new Date(),
        customerNotes: overrides.customerNotes ?? 'Catatan pesanan uji meja 01',
        items: {
          create: [
            {
              menuItemId: testMenuItemId,
              nameSnapshot: overrides.customItemName ?? 'Kopi Susu Aren SELA Spesial',
              priceSnapshot: 28000,
              quantity: 1,
              notes: 'Gula 50%',
              subtotal: 38000,
              modifiers: {
                create: [
                  {
                    nameSnapshot: 'Oatmilk Organik Tambahan',
                    priceSnapshot: 10000,
                  },
                ],
              },
            },
          ],
        },
      },
      include: {
        table: true,
        items: {
          include: {
            modifiers: true,
          },
        },
      },
    })

    createdOrderIds.push(order.id)
    return { order, token: rawSecretToken }
  }

  describe('1. Snapshot Matching on Downloaded Receipts', () => {
    it('generates receipt matching exact DB snapshot values (name, modifiers, subtotal, total)', async () => {
      const { order, token } = await createTestOrder({
        customItemName: 'Signature Espresso Double Shot Blend',
      })

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=txt&paper=58mm&type=customer`,
        {
          headers: { 'x-order-secret-token': token },
        }
      )

      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)

      const text = await res.text()
      expect(text).toContain('Signature Espresso')
      expect(text).toContain('Double Shot Blend')
      expect(text).toContain('Oatmilk Organik')
      expect(text).toContain('Tambahan')
      expect(text).toContain('38.000')
      expect(text).toContain(order.orderNumber)
      expect(text).toContain('MEJA 01')
      expect(text).toContain('LUNAS (PAID)')
    })
  })

  describe('2. Strict Access Control & Role Enforcement', () => {
    it('rejects unauthenticated request without token or staff session (403 Forbidden)', async () => {
      const { order } = await createTestOrder({})
      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=txt&type=customer`
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('rejects cross-order customer token (Token Order A cannot download Order B) with 403', async () => {
      const { token: tokenA } = await createTestOrder({})
      const { order: orderB } = await createTestOrder({})

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${orderB.id}/receipt/download?format=txt&type=customer`,
        {
          headers: { 'x-order-secret-token': tokenA },
        }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: orderB.id }) })
      expect(res.status).toBe(403)
    })

    it('rejects customer trying to download cashier receipt or kitchen ticket (403 Forbidden)', async () => {
      const { order, token } = await createTestOrder({})

      // Customer mencoba type=cashier
      const reqCashier = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=cashier`,
        {
          headers: { 'x-order-secret-token': token },
        }
      )
      const resCashier = await downloadReceiptHandler(reqCashier, { params: Promise.resolve({ id: order.id }) })
      expect(resCashier.status).toBe(403)

      // Customer mencoba type=kitchen
      const reqKitchen = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=kitchen`,
        {
          headers: { 'x-order-secret-token': token },
        }
      )
      const resKitchen = await downloadReceiptHandler(reqKitchen, { params: Promise.resolve({ id: order.id }) })
      expect(resKitchen.status).toBe(403)
    })

    it('rejects Barista trying to download cashier receipt (403 Forbidden)', async () => {
      const { order } = await createTestOrder({})

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=cashier`,
        {
          headers: { Authorization: `Bearer ${baristaToken}` },
        }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(403)
    })

    it('allows Cashier to download cashier receipt, kitchen ticket, and customer receipt', async () => {
      const { order } = await createTestOrder({})

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=cashier`,
        {
          headers: { Authorization: `Bearer ${cashierToken}` },
        }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)
    })

    it('allows Barista to download kitchen ticket', async () => {
      const { order } = await createTestOrder({})

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=kitchen`,
        {
          headers: { Authorization: `Bearer ${baristaToken}` },
        }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text).toContain('[ TIKET DAPUR / BARISTA ]')
      expect(text).not.toContain('Rp')
    })

    it('allows Admin to download any receipt type', async () => {
      const { order } = await createTestOrder({})

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?type=cashier`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)
    })
  })

  describe('3. Atomic Print Attempt Logging & Independent Reprint Count', () => {
    it('maintains independent reprint counters for CASHIER_RECEIPT and KITCHEN_TICKET', async () => {
      const { order } = await createTestOrder({})

      // 1. Kasir mencetak Struk Kasir ke-1 -> attempt 1, isReprint: false
      const reqCashier1 = new NextRequest(`http://localhost:3000/api/orders/${order.id}/print-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          documentType: 'CASHIER_RECEIPT',
          format: 'THERMAL_58MM',
        }),
      })
      const resCashier1 = await printLogHandler(reqCashier1, { params: Promise.resolve({ id: order.id }) })
      expect(resCashier1.status).toBe(200)
      const dataCashier1 = await resCashier1.json()
      expect(dataCashier1.data.attemptNumber).toBe(1)
      expect(dataCashier1.data.isReprint).toBe(false)
      expect(dataCashier1.data.reprintCount).toBe(0)

      // 2. Barista mencetak Tiket Dapur ke-1 -> attempt 1, isReprint: false
      // MEMBUKTIKAN: Tiket Dapur ke-1 TIDAK terpengaruh oleh cetak struk kasir!
      const reqKitchen1 = new NextRequest(`http://localhost:3000/api/orders/${order.id}/print-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${baristaToken}`,
        },
        body: JSON.stringify({
          documentType: 'KITCHEN_TICKET',
          format: 'THERMAL_58MM',
        }),
      })
      const resKitchen1 = await printLogHandler(reqKitchen1, { params: Promise.resolve({ id: order.id }) })
      expect(resKitchen1.status).toBe(200)
      const dataKitchen1 = await resKitchen1.json()
      expect(dataKitchen1.data.attemptNumber).toBe(1)
      expect(dataKitchen1.data.isReprint).toBe(false)
      expect(dataKitchen1.data.reprintCount).toBe(0)

      // 3. Kasir mencetak Struk Kasir ke-2 -> attempt 2, isReprint: true
      const reqCashier2 = new NextRequest(`http://localhost:3000/api/orders/${order.id}/print-log`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cashierToken}`,
        },
        body: JSON.stringify({
          documentType: 'CASHIER_RECEIPT',
          format: 'THERMAL_58MM',
        }),
      })
      const resCashier2 = await printLogHandler(reqCashier2, { params: Promise.resolve({ id: order.id }) })
      const dataCashier2 = await resCashier2.json()
      expect(dataCashier2.data.attemptNumber).toBe(2)
      expect(dataCashier2.data.isReprint).toBe(true)
      expect(dataCashier2.data.reprintCount).toBe(1)

      // 4. Verifikasi di DB AuditLog
      const auditLogs = await prisma.auditLog.findMany({
        where: { orderId: order.id, action: 'PRINT_ATTEMPT' },
      })
      expect(auditLogs.length).toBe(3)
    })
  })

  describe('4. Download Formats (Plain Text & HTML)', () => {
    it('returns valid plain text with attachment Content-Disposition', async () => {
      const { order, token } = await createTestOrder({})
      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=txt&paper=58mm&type=customer`,
        { headers: { 'x-order-secret-token': token } }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/plain')
      expect(res.headers.get('content-disposition')).toContain('attachment; filename="sela-customer-')
      const text = await res.text()
      expect(text).toContain('SELA')
    })

    it('returns self-contained HTML with print CSS and attachment header', async () => {
      const { order, token } = await createTestOrder({})
      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=html&paper=80mm&type=customer`,
        { headers: { 'x-order-secret-token': token } }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/html')
      expect(res.headers.get('content-disposition')).toContain('.html"')
      const html = await res.text()
      expect(html).toContain('<!DOCTYPE html>')
      expect(html).toContain('@media print')
    })
  })

  describe('5. Financial Status Invariants on Receipts', () => {
    it('displays prominent warning for unpaid cash order and does NOT display as paid', async () => {
      const { order, token } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'WAITING_CASHIER',
        paidAt: null,
      })

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=txt&type=customer`,
        { headers: { 'x-order-secret-token': token } }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      const text = await res.text()
      expect(text).toContain('MENUNGGU PEMBAYARAN KASIR')
      expect(text).toContain('PERHATIAN: BUKAN BUKTI LUNAS')
      expect(text).not.toContain('LUNAS (PAID)')
    })

    it('preserves PAID financial status for cancelled order that requires manual refund', async () => {
      const { order, token } = await createTestOrder({
        paymentMethod: 'CASH',
        paymentStatus: 'PAID',
        orderStatus: 'CANCELLED',
      })

      const req = new NextRequest(
        `http://localhost:3000/api/orders/${order.id}/receipt/download?format=txt&type=customer`,
        { headers: { 'x-order-secret-token': token } }
      )
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: order.id }) })
      const text = await res.text()
      expect(text).toContain('LUNAS (PAID)')
      expect(text).toContain('38.000')
    })
  })
})
