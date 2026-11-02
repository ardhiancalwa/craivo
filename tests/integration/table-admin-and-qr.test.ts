// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import prisma from '@/lib/server/db'
import { signStaffToken } from '@/lib/server/auth'
import { GET as getTablesHandler, POST as createTableHandler } from '@/app/api/staff/admin/tables/route'
import {
  GET as getTableDetailHandler,
  PUT as updateTableHandler,
  PATCH as toggleTableActiveHandler,
} from '@/app/api/staff/admin/tables/[id]/route'
import { GET as getTableQrHandler } from '@/app/api/staff/admin/tables/[id]/qr/route'
import { GET as exportTablesZipHandler } from '@/app/api/staff/admin/tables/export/zip/route'
import { GET as exportTablesPdfHandler } from '@/app/api/staff/admin/tables/export/pdf/route'
import { createOrderQuote, QuoteServiceError } from '@/lib/server/quote-service'

describe('Tahap 19: Table Management & Master QR Generator Integration Suite', () => {
  let adminToken: string
  let cashierToken: string
  let baristaToken: string
  let createdTableId: string
  const testTableNumber = 'TEST-99'
  let sampleMenuItemId: string
  let sampleModifierOptionIds: string[] = []
  let originalProdDomain: string | null = null

  beforeAll(async () => {
    // 1. Setup staff tokens
    const admin = await prisma.staffUser.findFirstOrThrow({ where: { role: 'ADMIN', isActive: true } })
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

    // 2. Cache original production domain config
    const cfg = await prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } })
    originalProdDomain = cfg?.productionDomain || null

    // 3. Find a sample active menu item for quote tests
    const menuItem = await prisma.menuItem.findFirstOrThrow({
      where: { isAvailable: true, isArchived: false },
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
    sampleMenuItemId = menuItem.id
    sampleModifierOptionIds = menuItem.modifierGroups
      .filter((g) => g.group.isRequired && g.group.options.length > 0)
      .map((g) => g.group.options[0]!.id)

    // 4. Ensure test table doesn't already exist with foreign key safety
    const existingTestTable = await prisma.table.findUnique({ where: { tableNumber: testTableNumber } })
    if (existingTestTable) {
      await prisma.guestSession.deleteMany({ where: { tableId: existingTestTable.id } }).catch(() => {})
      await prisma.order.deleteMany({ where: { tableId: existingTestTable.id } }).catch(() => {})
      await prisma.table.delete({ where: { id: existingTestTable.id } }).catch(() => {})
    }
  })

  afterAll(async () => {
    // Cleanup created table safely
    if (createdTableId) {
      await prisma.guestSession.deleteMany({ where: { tableId: createdTableId } }).catch(() => {})
      await prisma.order.deleteMany({ where: { tableId: createdTableId } }).catch(() => {})
      await prisma.table.delete({ where: { id: createdTableId } }).catch(() => {})
    }
    const remTable = await prisma.table.findUnique({ where: { tableNumber: testTableNumber } })
    if (remTable) {
      await prisma.guestSession.deleteMany({ where: { tableId: remTable.id } }).catch(() => {})
      await prisma.order.deleteMany({ where: { tableId: remTable.id } }).catch(() => {})
      await prisma.table.delete({ where: { id: remTable.id } }).catch(() => {})
    }

    // Cleanup test audit logs
    await prisma.auditLog.deleteMany({
      where: { action: { in: ['CREATE_TABLE', 'UPDATE_TABLE', 'TOGGLE_TABLE_STATUS'] }, details: { contains: testTableNumber } },
    }).catch(() => {})

    // Restore original production domain
    await prisma.cravioConfig.update({
      where: { id: 'cravio-main-config' },
      data: { productionDomain: originalProdDomain },
    }).catch(() => {})
  })

  describe('1. RBAC Guard Enforcement for Table Admin Endpoints', () => {
    it('menolak akses tanpa token autentikasi (401 Unauthorized)', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables')
      const res = await getTablesHandler(req)
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('UNAUTHORIZED')
    })

    it('menolak akses role CASHIER (403 Forbidden)', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables', {
        headers: { Cookie: `cravio_staff_token=${cashierToken}` },
      })
      const res = await getTablesHandler(req)
      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json.error).toBe('FORBIDDEN')
    })

    it('menolak akses role BARISTA (403 Forbidden)', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables', {
        headers: { Cookie: `cravio_staff_token=${baristaToken}` },
      })
      const res = await getTablesHandler(req)
      expect(res.status).toBe(403)
    })

    it('mengizinkan akses role ADMIN (200 OK) dan mengembalikan daftar meja serta environment info', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables', {
        headers: { Cookie: `cravio_staff_token=${adminToken}` },
      })
      const res = await getTablesHandler(req)
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(Array.isArray(json.data.tables)).toBe(true)
      expect(json.data.environment).toBeDefined()
      expect(json.data.environment.stagingUrl).toBeDefined()
    })
  })

  describe('2. Table CRUD & Audit Trail', () => {
    it('berhasil membuat meja baru melalui POST /api/staff/admin/tables', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `cravio_staff_token=${adminToken}`,
        },
        body: JSON.stringify({
          tableNumber: testTableNumber,
          label: 'Area Rooftop Sunset',
          isActive: true,
        }),
      })

      const res = await createTableHandler(req)
      expect(res.status).toBe(201)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.tableNumber).toBe(testTableNumber)
      expect(json.data.label).toBe('Area Rooftop Sunset')
      expect(json.data.isActive).toBe(true)
      createdTableId = json.data.id

      // Verifikasi audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'CREATE_TABLE', details: { contains: testTableNumber } },
      })
      expect(audit).toBeDefined()
      expect(audit?.details).toContain('Area Rooftop Sunset')
    })

    it('menolak duplikasi nomor meja dengan status 400 Bad Request', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `cravio_staff_token=${adminToken}`,
        },
        body: JSON.stringify({
          tableNumber: testTableNumber,
          label: 'Duplikasi Meja',
          isActive: true,
        }),
      })

      const res = await createTableHandler(req)
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('DUPLICATE_TABLE')
    })

    it('berhasil memperbarui label dan status meja melalui PUT /api/staff/admin/tables/[id]', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/tables/${createdTableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `cravio_staff_token=${adminToken}`,
        },
        body: JSON.stringify({
          tableNumber: testTableNumber,
          label: 'Area Rooftop VIP Lounge',
          isActive: true,
        }),
      })

      const res = await updateTableHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.label).toBe('Area Rooftop VIP Lounge')

      // Verifikasi audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'UPDATE_TABLE', details: { contains: 'Area Rooftop VIP Lounge' } },
      })
      expect(audit).toBeDefined()
    })

    it('berhasil menonaktifkan meja via PATCH /api/staff/admin/tables/[id]', async () => {
      const req = new Request(`http://localhost:3000/api/staff/admin/tables/${createdTableId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `cravio_staff_token=${adminToken}`,
        },
        body: JSON.stringify({ isActive: false }),
      })

      const res = await toggleTableActiveHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.success).toBe(true)
      expect(json.data.isActive).toBe(false)

      // Verifikasi audit log
      const audit = await prisma.auditLog.findFirst({
        where: { action: 'TOGGLE_TABLE_STATUS', details: { contains: testTableNumber } },
      })
      expect(audit).toBeDefined()
    })
  })

  describe('3. Order & Checkout Protection on Inactive Table (DEC-014)', () => {
    it('menolak pembuatan quote pelanggan pada meja nonaktif dengan TABLE_INACTIVE (403)', async () => {
      await expect(
        createOrderQuote({
          tableNumber: testTableNumber,
          items: [{ menuItemId: sampleMenuItemId, quantity: 1, selectedModifierOptionIds: sampleModifierOptionIds }],
        })
      ).rejects.toThrowError(QuoteServiceError)

      try {
        await createOrderQuote({
          tableNumber: testTableNumber,
          items: [{ menuItemId: sampleMenuItemId, quantity: 1, selectedModifierOptionIds: sampleModifierOptionIds }],
        })
      } catch (err: any) {
        expect(err.code).toBe('TABLE_INACTIVE')
        expect(err.statusCode).toBe(403)
      }
    })

    it('mengaktifkan kembali meja dan mengizinkan quote normal', async () => {
      // Re-activate test table
      await prisma.table.update({
        where: { id: createdTableId },
        data: { isActive: true },
      })

      const quote = await createOrderQuote({
        tableNumber: testTableNumber,
        items: [{ menuItemId: sampleMenuItemId, quantity: 1, selectedModifierOptionIds: sampleModifierOptionIds }],
      })

      expect(quote).toBeDefined()
      expect(quote.tableNumber).toBe(testTableNumber)
      expect(quote.items.length).toBe(1)
    })
  })

  describe('4. Single QR Code Generation (PNG & SVG)', () => {
    it('menghasilkan stream PNG dengan resolusi tinggi dan header yang benar', async () => {
      const req = new Request(
        `http://localhost:3000/api/staff/admin/tables/${createdTableId}/qr?format=png&env=staging`,
        { headers: { Cookie: `cravio_staff_token=${adminToken}` } }
      )

      const res = await getTableQrHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('image/png')
      expect(res.headers.get('Content-Disposition')).toContain(`sela-meja-${testTableNumber}-staging.png`)

      const arrayBuffer = await res.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      // PNG signature: 0x89 0x50 0x4E 0x47
      expect(bytes[0]).toBe(0x89)
      expect(bytes[1]).toBe(0x50)
      expect(bytes[2]).toBe(0x4e)
      expect(bytes[3]).toBe(0x47)
    })

    it('menghasilkan stream SVG murni dengan header xml yang benar', async () => {
      const req = new Request(
        `http://localhost:3000/api/staff/admin/tables/${createdTableId}/qr?format=svg&env=staging`,
        { headers: { Cookie: `cravio_staff_token=${adminToken}` } }
      )

      const res = await getTableQrHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toContain('image/svg+xml')
      expect(res.headers.get('Content-Disposition')).toContain(`sela-meja-${testTableNumber}-staging.svg`)

      const svgText = await res.text()
      expect(svgText).toContain('<svg')
      expect(svgText).toContain('viewBox=')
      expect(svgText).toContain('</svg>')
    })
  })

  describe('5. Bulk Export ZIP Archive & PDF A4 Print Sheet', () => {
    it('menghasilkan arsip ZIP utuh berisi berkas PNG, SVG, dan panduan teks', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables/export/zip?env=staging', {
        headers: { Cookie: `cravio_staff_token=${adminToken}` },
      })

      const res = await exportTablesZipHandler(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/zip')
      expect(res.headers.get('Content-Disposition')).toContain('.zip')

      const arrayBuffer = await res.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      // ZIP magic bytes: PK (0x50, 0x4B)
      expect(bytes[0]).toBe(0x50)
      expect(bytes[1]).toBe(0x4b)
      expect(bytes.length).toBeGreaterThan(1000)
    }, 20000)

    it('menghasilkan dokumen PDF A4 siap potong dengan grid kartu meja', async () => {
      const req = new Request('http://localhost:3000/api/staff/admin/tables/export/pdf?env=staging', {
        headers: { Cookie: `cravio_staff_token=${adminToken}` },
      })

      const res = await exportTablesPdfHandler(req)
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('application/pdf')
      expect(res.headers.get('Content-Disposition')).toContain('.pdf')

      const arrayBuffer = await res.arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)
      // PDF signature: %PDF- (0x25 0x50 0x44 0x46 0x2D)
      const headerStr = String.fromCharCode(...bytes.slice(0, 5))
      expect(headerStr).toBe('%PDF-')
      expect(bytes.length).toBeGreaterThan(5000)
    }, 20000)
  })

  describe('6. Production Domain Guard (DEC-016)', () => {
    it('memblokir ekspor produksi jika domain produksi belum terkonfigurasi di database', async () => {
      // Clear production domain
      await prisma.cravioConfig.update({
        where: { id: 'cravio-main-config' },
        data: { productionDomain: null },
      })

      const req = new Request(
        `http://localhost:3000/api/staff/admin/tables/${createdTableId}/qr?format=png&env=production`,
        { headers: { Cookie: `cravio_staff_token=${adminToken}` } }
      )

      const res = await getTableQrHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json.error).toBe('QR_GENERATION_FAILED')
      expect(json.message).toContain('Domain produksi permanen belum dikonfigurasi')
    })

    it('mengizinkan ekspor produksi ketika domain resmi dikonfigurasi', async () => {
      await prisma.cravioConfig.update({
        where: { id: 'cravio-main-config' },
        data: { productionDomain: 'https://order.selacoffee.com' },
      })

      const req = new Request(
        `http://localhost:3000/api/staff/admin/tables/${createdTableId}/qr?format=png&env=production`,
        { headers: { Cookie: `cravio_staff_token=${adminToken}` } }
      )

      const res = await getTableQrHandler(req, { params: Promise.resolve({ id: createdTableId }) })
      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('image/png')
      expect(res.headers.get('Content-Disposition')).toContain(`sela-meja-${testTableNumber}-production.png`)
    })
  })
})
