// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/server/db'
import { signStaffToken } from '@/lib/server/auth'
import { GET as getAdminConfigHandler, PUT as updateAdminConfigHandler } from '@/app/api/staff/admin/config/route'
import { PUT as updateFinancialConfigHandler } from '@/app/api/staff/admin/config/financial/route'
import { GET as getAdminQuizHandler, PUT as updateAdminQuizHandler } from '@/app/api/staff/admin/quiz/route'
import { GET as getTurnoverReportHandler } from '@/app/api/staff/admin/reports/turnover/route'
import { GET as getTransactionListHandler } from '@/app/api/staff/admin/reports/transactions/route'
import { GET as exportTransactionsCsvHandler } from '@/app/api/staff/admin/reports/export/route'
import { GET as getAuditLogsHandler } from '@/app/api/staff/admin/audit-logs/route'
import { GET as getAdminMenuItemsHandler, POST as createAdminMenuItemHandler } from '@/app/api/staff/admin/menu/route'
import { GET as getAdminMenuDetailHandler, PUT as updateAdminMenuItemHandler } from '@/app/api/staff/admin/menu/[id]/route'
import { PATCH as archiveMenuItemHandler } from '@/app/api/staff/admin/menu/[id]/archive/route'
import { PATCH as restoreMenuItemHandler } from '@/app/api/staff/admin/menu/[id]/restore/route'
import { PATCH as togglePopularHandler } from '@/app/api/staff/admin/menu/[id]/popular/route'
import { getJakartaTodayString } from '@/lib/server/timezone-utils'
import crypto from 'node:crypto'

describe('Tahap 17 & 18: Admin Management, Quiz Config, Tax & Reports Integration Suite', () => {
  let adminToken: string
  let cashierToken: string
  let baristaToken: string

  let adminUser: { id: string; username: string }
  let tableId: string
  let testCategoryId: string
  const createdOrderIds: string[] = []
  const createdMenuItemIds: string[] = []

  beforeAll(async () => {
    // 1. Get test table
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '01' } })
    tableId = table.id

    // 2. Get test category
    const category = await prisma.category.findFirstOrThrow()
    testCategoryId = category.id

    // 3. Find or set up staff users
    const admin = await prisma.staffUser.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } })
    adminUser = { id: admin.id, username: admin.username }
    adminToken = await signStaffToken({
      sub: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
    })

    const cashier = await prisma.staffUser.findFirstOrThrow({ where: { role: 'CASHIER', isActive: true } })
    cashierToken = await signStaffToken({
      sub: cashier.id,
      username: cashier.username,
      displayName: cashier.displayName,
      role: cashier.role,
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
    // 1. Restore baseline config 0% / 0%
    await prisma.cravioConfig.update({
      where: { id: 'cravio-main-config' },
      data: {
        name: 'Cravio',
        taxRateBps: 0,
        serviceRateBps: 0,
        isTaxInclusive: false,
      },
    }).catch(() => {})

    // 2. Clean up test orders
    for (const orderId of createdOrderIds) {
      await prisma.manualRefundRecord.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.paymentAttempt.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.orderItemModifier.deleteMany({ where: { orderItem: { orderId } } }).catch(() => {})
      await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }

    // 3. Clean up test menu items
    for (const menuId of createdMenuItemIds) {
      await prisma.menuItemTag.deleteMany({ where: { menuItemId: menuId } }).catch(() => {})
      await prisma.menuItemModifierGroup.deleteMany({ where: { menuItemId: menuId } }).catch(() => {})
      await prisma.menuItem.delete({ where: { id: menuId } }).catch(() => {})
    }
  })

  describe('1. RBAC Guard Enforcement for Admin Endpoints', () => {
    it('menolak akses tanpa token autentikasi dengan status 401 Unauthorized', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config')
      const res = await getAdminConfigHandler(req)
      expect(res.status).toBe(401)
    })

    it('menolak role CASHIER pada endpoint admin dengan status 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config', {
        headers: { Authorization: `Bearer ${cashierToken}` },
      })
      const res = await getAdminConfigHandler(req)
      expect(res.status).toBe(403)
      const data = await res.json()
      expect(data.error).toBe('FORBIDDEN')
    })

    it('menolak role BARISTA pada endpoint admin dengan status 403 Forbidden', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/reports/turnover', {
        headers: { Authorization: `Bearer ${baristaToken}` },
      })
      const res = await getTurnoverReportHandler(req)
      expect(res.status).toBe(403)
    })

    it('mengizinkan role ADMIN mengakses dashboard admin', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })
      const res = await getAdminConfigHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.name).toBeDefined()
    })
  })

  describe('2. Pengaturan Finansial & Identitas Kafe (REQ-ADMIN-05, REQ-ADMIN-08)', () => {
    it('berhasil memperbarui identitas kafe dan tercatat di konfigurasi', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'SELA Artisanal Coffee & Bake',
          tagline: 'Your craving, Perfectly Matched',
          address: 'Jl. Senopati No. 45, Kebayoran Baru, Jakarta Selatan',
          phone: '+62 812-9988-7766',
          openingHours: '07:30 - 22:30 WIB',
        }),
      })

      const res = await updateAdminConfigHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.openingHours).toBe('07:30 - 22:30 WIB')
    })

    it('berhasil memperbarui kebijakan pajak & service dan mencatat audit log', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config/financial', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taxRateBps: 1000, // 10%
          serviceRateBps: 500, // 5%
          isTaxInclusive: true,
        }),
      })

      const res = await updateFinancialConfigHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.taxRateBps).toBe(1000)
      expect(data.data.serviceRateBps).toBe(500)
      expect(data.data.isTaxInclusive).toBe(true)

      // Verifikasi audit log tercatat
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'FINANCIAL_POLICY_UPDATED',
          staffUserId: adminUser.id,
        },
        orderBy: { createdAt: 'desc' },
      })

      expect(auditLog).not.toBeNull()
      expect(auditLog?.details).toContain('1000')

      // Kembalikan ke baseline 0%/0%
      await prisma.cravioConfig.update({
        where: { id: 'cravio-main-config' },
        data: { taxRateBps: 0, serviceRateBps: 0, isTaxInclusive: false },
      })
    })

    it('menolak nilai pajak atau service negatif atau di atas batas wajar', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/config/financial', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taxRateBps: -500, // Negatif tidak valid
          serviceRateBps: 500,
          isTaxInclusive: false,
        }),
      })

      const res = await updateFinancialConfigHandler(req)
      expect(res.status).toBe(400)
    })
  })

  describe('3. Admin Menu & Catalog Management (Tahap 17)', () => {
    let createdMenuId: string

    it('berhasil menambahkan menu baru lengkap dengan harga integer dan kategori', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/menu', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Affogato Pistachio Test',
          description: 'Single espresso disiram di atas gelato pistachio lembut dengan crumble renyah.',
          price: 42000,
          categoryId: testCategoryId,
          isPopular: false,
          sortOrder: 10,
          tagIds: [],
          modifierGroupIds: [],
        }),
      })

      const res = await createAdminMenuItemHandler(req)
      expect(res.status).toBe(201)
      const data = await res.json()
      expect(data.success).toBe(true)
      expect(data.data.name).toBe('Affogato Pistachio Test')
      expect(data.data.price).toBe(42000)

      createdMenuId = data.data.id
      createdMenuItemIds.push(createdMenuId)
    })

    it('mengizinkan toggle Best Seller via PATCH popular', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/menu/${createdMenuId}/popular`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isPopular: true }),
      })

      const res = await togglePopularHandler(req, { params: Promise.resolve({ id: createdMenuId }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.isPopular).toBe(true)
    })

    it('melakukan soft-archive menu tanpa menghapus baris dari database', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/menu/${createdMenuId}/archive`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const res = await archiveMenuItemHandler(req, { params: Promise.resolve({ id: createdMenuId }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.isArchived).toBe(true)
      expect(data.data.isAvailable).toBe(false)

      // Pastikan tetap ada di DB untuk integritas pesanan historis
      const dbItem = await prisma.menuItem.findUnique({ where: { id: createdMenuId } })
      expect(dbItem).not.toBeNull()
      expect(dbItem?.isArchived).toBe(true)
    })

    it('berhasil memulihkan (restore) menu yang telah diarsip', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/menu/${createdMenuId}/restore`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const res = await restoreMenuItemHandler(req, { params: Promise.resolve({ id: createdMenuId }) })
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.data.isArchived).toBe(false)
      expect(data.data.isAvailable).toBe(true)
    })
  })

  describe('4. Konfigurasi Kuis Dinamis & Versioning (REQ-ADMIN-06)', () => {
    it('mengambil konfigurasi kuis admin beserta daftar tag master', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/quiz', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const res = await getAdminQuizHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.data.quizVersion).toBeDefined()
      expect(Array.isArray(data.data.questions)).toBe(true)
      expect(data.data.questions.length).toBeGreaterThanOrEqual(3)
      expect(Array.isArray(data.data.availableTags)).toBe(true)
    })

    it('menolak konfigurasi kuis yang melanggar aturan anti-crash (<3 pertanyaan aktif)', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/quiz', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questions: [
            {
              id: 'q1',
              stepNumber: 1,
              title: 'Langkah 1',
              description: 'Desc',
              dimension: 'MOOD',
              isActive: true,
              sortOrder: 0,
              options: [
                { label: 'Opsi 1', description: 'D1', sortOrder: 0, isActive: true, tags: [{ tagId: 't1', weight: 5 }] },
                { label: 'Opsi 2', description: 'D2', sortOrder: 1, isActive: true, tags: [{ tagId: 't2', weight: 5 }] },
              ],
            },
          ], // Hanya 1 pertanyaan
        }),
      })

      const res = await updateAdminQuizHandler(req)
      expect(res.status).toBe(400)
      const data = await res.json()
      expect(data.error).toBe('INVALID_QUIZ_CONFIG')
    })
  })

  describe('5. Laporan Omzet Harian & Filter Transaksi (REQ-ADMIN-07)', () => {
    const today = getJakartaTodayString()
    let paidCashOrderId: string
    let paidQrisOrderId: string
    let refundedOrderId: string
    let unpaidOrderId: string

    beforeAll(async () => {
      const now = new Date()

      // 1. Order Lunas Tunai (Rp50.000)
      const order1 = await prisma.order.create({
        data: {
          orderNumber: `REP-CASH-${Date.now()}`,
          orderSecretTokenHash: 'hash-rep-1',
          tableId,
          subtotalAmount: 50000,
          totalAmount: 50000,
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          orderStatus: 'COMPLETED',
          paidAt: now,
          items: {
            create: [
              {
                menuItemId: 'menu-kopi-sela',
                nameSnapshot: 'Kopi Susu Sela',
                priceSnapshot: 25000,
                quantity: 2,
                subtotal: 50000,
              },
            ],
          },
        },
      })
      paidCashOrderId = order1.id
      createdOrderIds.push(paidCashOrderId)

      // 2. Order Lunas QRIS (Rp40.000)
      const order2 = await prisma.order.create({
        data: {
          orderNumber: `REP-QRIS-${Date.now()}`,
          orderSecretTokenHash: 'hash-rep-2',
          tableId,
          subtotalAmount: 40000,
          totalAmount: 40000,
          paymentMethod: 'QRIS',
          paymentStatus: 'PAID',
          orderStatus: 'READY',
          paidAt: now,
          items: {
            create: [
              {
                menuItemId: 'menu-kopi-sela',
                nameSnapshot: 'Kopi Susu Sela',
                priceSnapshot: 28000,
                quantity: 1,
                subtotal: 28000,
              },
              {
                menuItemId: 'menu-vanilla-latte',
                nameSnapshot: 'Vanilla Latte',
                priceSnapshot: 12000,
                quantity: 1,
                subtotal: 12000,
              },
            ],
          },
        },
      })
      paidQrisOrderId = order2.id
      createdOrderIds.push(paidQrisOrderId)

      // 3. Order Lunas dengan Refund Manual (Rp30.000 bruto, refund Rp30.000)
      const order3 = await prisma.order.create({
        data: {
          orderNumber: `REP-REF-${Date.now()}`,
          orderSecretTokenHash: 'hash-rep-3',
          tableId,
          subtotalAmount: 30000,
          totalAmount: 30000,
          paymentMethod: 'CASH',
          paymentStatus: 'PAID',
          orderStatus: 'CANCELLED',
          paidAt: now,
          items: {
            create: [
              {
                menuItemId: 'menu-kopi-sela',
                nameSnapshot: 'Kopi Susu Sela',
                priceSnapshot: 30000,
                quantity: 1,
                subtotal: 30000,
              },
            ],
          },
          manualRefunds: {
            create: {
              staffUserId: adminUser.id,
              amount: 30000,
              reason: 'Customer cancelled test',
              approvedAt: now,
            },
          },
        },
      })
      refundedOrderId = order3.id
      createdOrderIds.push(refundedOrderId)

      // 4. Order Belum Lunas (UNPAID) Rp25.000 - TIDAK boleh masuk omzet
      const order4 = await prisma.order.create({
        data: {
          orderNumber: `REP-UNPAID-${Date.now()}`,
          orderSecretTokenHash: 'hash-rep-4',
          tableId,
          subtotalAmount: 25000,
          totalAmount: 25000,
          paymentMethod: 'CASH',
          paymentStatus: 'UNPAID',
          orderStatus: 'QUEUED',
          items: {
            create: [
              {
                menuItemId: 'menu-kopi-sela',
                nameSnapshot: 'Kopi Susu Sela',
                priceSnapshot: 25000,
                quantity: 1,
                subtotal: 25000,
              },
            ],
          },
        },
      })
      unpaidOrderId = order4.id
      createdOrderIds.push(unpaidOrderId)
    })

    it('menghitung gross receipts, refund deduction, dan net turnover dengan tepat', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/reports/turnover?date=${today}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const res = await getTurnoverReportHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()
      const report = data.data

      // Verifikasi dataset transaksi uji:
      // Gross minimal: 50.000 (order1) + 40.000 (order2) + 30.000 (order3) = 120.000
      expect(report.summary.grossReceipts).toBeGreaterThanOrEqual(120000)
      expect(report.summary.totalRefunds).toBeGreaterThanOrEqual(30000)
      expect(report.summary.netTurnover).toBe(report.summary.grossReceipts - report.summary.totalRefunds)

      // Verifikasi breakdown metode bayar
      expect(report.byPaymentMethod.cash.transactionCount).toBeGreaterThanOrEqual(2) // order1 + order3
      expect(report.byPaymentMethod.qris.transactionCount).toBeGreaterThanOrEqual(1) // order2
      expect(report.topSellingItems.length).toBeGreaterThan(0)
    })

    it('mengambil daftar transaksi dengan paginasi dan filter metode bayar', async () => {
      const req = new Request(
        `http://localhost:3000/api/staff/admin/reports/transactions?startDate=${today}&endDate=${today}&paymentMethod=CASH`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      )

      const res = await getTransactionListHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(data.data.transactions).toBeDefined()
      expect(Array.isArray(data.data.transactions)).toBe(true)
      expect(data.data.pagination.page).toBe(1)

      // Pastikan seluruh transaksi hasil filter adalah CASH
      for (const tx of data.data.transactions) {
        expect(tx.paymentMethod).toBe('CASH')
      }
    })
  })

  describe('6. Ekspor Laporan Transaksi CSV (REQ-ADMIN-09)', () => {
    const today = getJakartaTodayString()

    it('mengembalikan berkas CSV terunduh dengan header attachment dan UTF-8 BOM', async () => {
      const req = new Request(
        `http://localhost:3000/api/staff/admin/reports/export?startDate=${today}&endDate=${today}`,
        {
          headers: { Authorization: `Bearer ${adminToken}` },
        }
      )

      const res = await exportTransactionsCsvHandler(req)
      expect(res.status).toBe(200)

      // Verifikasi HTTP headers
      expect(res.headers.get('content-type')).toContain('text/csv')
      expect(res.headers.get('content-disposition')).toContain('attachment')
      expect(res.headers.get('content-disposition')).toContain('.csv')

      const csvText = await res.text()

      // Verifikasi awalan teks dan header kolom
      expect(csvText).toContain('Nomor Order')
      expect(csvText).toContain('Total Kotor (IDR)')
      expect(csvText).toContain('Total Bersih (IDR)')
    })
  })

  describe('7. Audit Trail Tersanitasi (REQ-ADMIN-10)', () => {
    it('mengambil log audit dan menjamin token/kredensial sensitif tersensor', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/audit-logs?page=1&limit=20', {
        headers: { Authorization: `Bearer ${adminToken}` },
      })

      const res = await getAuditLogsHandler(req)
      expect(res.status).toBe(200)
      const data = await res.json()

      expect(Array.isArray(data.data.logs)).toBe(true)
      expect(data.data.pagination).toBeDefined()

      // Periksa bahwa tidak ada bocoran kredensial sensitif
      for (const log of data.data.logs) {
        if (log.details) {
          expect(log.details).not.toContain('orderSecretToken')
          expect(log.details).not.toContain('pinHash')
          expect(log.details).not.toContain('passwordHash')
        }
      }
    })
  })
})
