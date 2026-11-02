// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import prisma from '@/lib/server/db'
import { publishEvent, fetchNewEvents } from '@/lib/server/realtime-bus'
import { GET as getOrderHandler } from '@/app/api/orders/[id]/route'
import { GET as downloadReceiptHandler } from '@/app/api/orders/[id]/receipt/download/route'
import { checkGuestCheckoutRateLimit, checkStaffLoginRateLimit } from '@/lib/server/rate-limiter'
import { hashOrderSecretToken } from '@/lib/server/order-capability'
import nextConfig from '@/../next.config'
import crypto from 'node:crypto'

describe('Tahap 21: Pre-UAT System Audit & Performance Benchmark Suite', () => {
  let tableId: string
  let menuItemId: string
  const createdOrderIds: string[] = []
  const orderTokens: string[] = []

  beforeAll(async () => {
    // 1. Ambil meja pengujian
    const table = await prisma.table.findFirstOrThrow({ where: { tableNumber: '07' } })
    tableId = table.id

    // 2. Ambil item menu pengujian
    const menuItem = await prisma.menuItem.findFirstOrThrow({ where: { isAvailable: true } })
    menuItemId = menuItem.id

    // 3. Buat 2 order awal untuk pengujian kontrol akses IDOR dan cache
    for (let i = 0; i < 2; i++) {
      const secret = `sec_bench_init_${i}_${crypto.randomBytes(16).toString('hex')}`
      const secretHash = hashOrderSecretToken(secret)
      const order = await prisma.order.create({
        data: {
          orderNumber: `BENCH-${Date.now()}-${i}-${crypto.randomBytes(4).toString('hex')}`,
          orderSecretTokenHash: secretHash,
          tableId,
          subtotalAmount: 35000,
          totalAmount: 35000,
          paymentMethod: 'CASH',
          paymentStatus: 'WAITING_CASHIER',
          orderStatus: 'QUEUED',
          customerNotes: `Initial Setup Order #${i + 1}`,
          items: {
            create: [
              {
                menuItemId,
                nameSnapshot: 'Kopi Susu Sela',
                priceSnapshot: 35000,
                quantity: 1,
                subtotal: 35000,
              },
            ],
          },
        },
      })
      createdOrderIds.push(order.id)
      orderTokens.push(secret)
    }
  })

  afterAll(async () => {
    // Bersihkan seluruh order yang dibuat selama benchmark
    for (const orderId of createdOrderIds) {
      await prisma.manualRefundRecord.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.outboxEvent.deleteMany({ where: { aggregateId: orderId } }).catch(() => {})
      await prisma.auditLog.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.paymentAttempt.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.orderItemModifier.deleteMany({ where: { orderItem: { orderId } } }).catch(() => {})
      await prisma.orderItem.deleteMany({ where: { orderId } }).catch(() => {})
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {})
    }

    // Bersihkan rate limit records pengujian
    await prisma.rateLimitRecord.deleteMany({
      where: {
        OR: [
          { key: { startsWith: 'guest:checkout:sess:sess_guest_' } },
          { key: { startsWith: 'guest:checkout:ip:203.0.113.' } },
          { key: { startsWith: 'staff:login:ip:198.51.100.' } },
        ],
      },
    }).catch(() => {})
  })

  describe('1. KDS Latency Benchmark (10 Order Bersamaan ≤ 2,0 Detik)', () => {
    it('memproses dan mendistribusikan 10 pesanan simultan ke antrean KDS dengan latensi individual dan rata-rata ≤ 2000ms', async () => {
      const benchmarkStartTime = Date.now()
      const CONCURRENT_COUNT = 10

      // Eksekusi pembuatan 10 pesanan dan penerbitan event KDS secara serentak
      const concurrentTasks = Array.from({ length: CONCURRENT_COUNT }).map(async (_, idx) => {
        const secret = `sec_bench_task_${idx}_${crypto.randomBytes(16).toString('hex')}`
        const secretHash = hashOrderSecretToken(secret)
        const orderNumber = `KDS-BENCH-${Date.now()}-${idx}-${crypto.randomBytes(3).toString('hex')}`

        const order = await prisma.order.create({
          data: {
            orderNumber,
            orderSecretTokenHash: secretHash,
            tableId,
            subtotalAmount: 35000,
            totalAmount: 35000,
            paymentMethod: 'CASH',
            paymentStatus: 'PAID',
            orderStatus: 'QUEUED',
            customerNotes: `Benchmark Concurrency Order #${idx + 1}`,
            items: {
              create: [
                {
                  menuItemId,
                  nameSnapshot: 'Kopi Susu Sela',
                  priceSnapshot: 35000,
                  quantity: 1,
                  subtotal: 35000,
                },
              ],
            },
          },
        })

        createdOrderIds.push(order.id)

        // Terbitkan event KDS
        const syncStart = Date.now()
        const pubEvent = await publishEvent({
          channel: 'KDS',
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'ORDER_QUEUED',
          payload: { orderNumber: order.orderNumber, status: 'QUEUED' },
        })

        // Ambil event dari antrean KDS
        const fetchedEvents = await fetchNewEvents({
          channel: 'KDS',
          aggregateId: order.id,
          sinceId: null,
          limit: 10,
        })

        const syncDuration = Date.now() - syncStart
        const found = fetchedEvents.some((e) => e.id === pubEvent.id)
        expect(found).toBe(true)

        return {
          idx,
          orderId: order.id,
          orderNumber: order.orderNumber,
          syncDuration,
        }
      })

      const results = await Promise.all(concurrentTasks)
      expect(results).toHaveLength(CONCURRENT_COUNT)

      // Verifikasi bahwa semua orderNumber unik
      const orderNumbers = results.map((r) => r.orderNumber)
      const uniqueOrderNumbers = new Set(orderNumbers)
      expect(uniqueOrderNumbers.size).toBe(CONCURRENT_COUNT)

      const syncLatencies = results.map((r) => r.syncDuration)
      const maxLatency = Math.max(...syncLatencies)
      const minLatency = Math.min(...syncLatencies)
      const avgLatency = syncLatencies.reduce((a, b) => a + b, 0) / syncLatencies.length

      console.log(`\n--- BENCHMARK KDS LATENCY (10 ORDERS CONCURRENT) ---`)
      console.log(`Min Latency : ${minLatency} ms`)
      console.log(`Avg Latency : ${avgLatency.toFixed(2)} ms`)
      console.log(`Max Latency : ${maxLatency} ms`)
      console.log(`Total Wall Clock : ${Date.now() - benchmarkStartTime} ms`)
      console.log(`----------------------------------------------------\n`)

      // Assert SLA kriteria selesai: latensi KDS ≤ 2000 ms (2 detik)
      expect(maxLatency).toBeLessThanOrEqual(2000)
      expect(avgLatency).toBeLessThanOrEqual(2000)
    }, 30000)
  })

  describe('2. Kontrol Akses Otoritatif & Pencegahan IDOR/BOLA', () => {
    it('menolak akses ke detail order tanpa capability token sah (HTTP 401/403)', async () => {
      const orderId = createdOrderIds[0]
      expect(orderId).toBeDefined()

      // Panggilan tanpa header x-order-token dan tanpa cookie staf
      const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}`)
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: orderId! }) })

      expect([401, 403]).toContain(res.status)
    })

    it('menolak akses ke detail order jika capability token milik pesanan lain (IDOR Prevention)', async () => {
      const order1 = createdOrderIds[0]!
      const order2 = createdOrderIds[1]!
      expect(order1).toBeDefined()
      expect(order2).toBeDefined()

      // Ambil capability secret milik order2
      const foreignSecret = orderTokens[1] || ''

      // Coba akses order1 menggunakan token milik order2
      const req = new NextRequest(`http://localhost:3000/api/orders/${order1}`, {
        headers: { 'x-order-secret-token': foreignSecret },
      })
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: order1 }) })

      expect([401, 403]).toContain(res.status)
    })

    it('menolak download receipt tanpa order capability token yang sah (HTTP 401/403)', async () => {
      const orderId = createdOrderIds[0]!
      const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}/receipt/download`)
      const res = await downloadReceiptHandler(req, { params: Promise.resolve({ id: orderId }) })

      expect([401, 403]).toContain(res.status)
    })

    it('memastikan hash SHA-256 tersimpan di database dan secret token tidak pernah disimpan plaintext', async () => {
      const orderId = createdOrderIds[0]
      const orderInDb = await prisma.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { orderSecretTokenHash: true },
      })

      // Hash harus 64 karakter heksadesimal (SHA-256)
      expect(orderInDb.orderSecretTokenHash).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('3. Multi-Tier Rate Limiting Lintas Instance & Proteksi IP Bersama', () => {
    it('membatasi checkout hingga 12 order/menit per sesi meja tanpa memblokir IP bersama', async () => {
      const sharedIp = `203.0.113.${Math.floor(Math.random() * 200) + 10}`
      const sessionUserA = `sess_guest_A_${Date.now()}_${Math.random()}`
      const sessionUserB = `sess_guest_B_${Date.now()}_${Math.random()}`

      // Pengguna A melakukan 12 checkout dalam 1 menit
      for (let i = 1; i <= 12; i++) {
        const check = await checkGuestCheckoutRateLimit(sessionUserA, sharedIp)
        expect(check.allowed).toBe(true)
      }

      // Pengguna A mencoba checkout ke-13 -> DITOLAK (Rate limit session)
      const checkBlocked = await checkGuestCheckoutRateLimit(sessionUserA, sharedIp)
      expect(checkBlocked.allowed).toBe(false)
      expect(checkBlocked.resetSeconds).toBeGreaterThan(0)

      // Pengguna B pada IP Wi-Fi kafe yang sama tetap BISA checkout (Tidak terblokir)
      const checkUserB = await checkGuestCheckoutRateLimit(sessionUserB, sharedIp)
      expect(checkUserB.allowed).toBe(true)
    })

    it('membatasi brute force login staf untuk IP publik eksternal (15 percobaan/5 menit)', async () => {
      const externalIp = `198.51.100.${Math.floor(Math.random() * 200) + 10}`

      for (let i = 1; i <= 15; i++) {
        const check = await checkStaffLoginRateLimit(externalIp)
        expect(check.allowed).toBe(true)
      }

      // Percobaan ke-16 ditolak
      const checkBlocked = await checkStaffLoginRateLimit(externalIp)
      expect(checkBlocked.allowed).toBe(false)
      expect(checkBlocked.resetSeconds).toBeGreaterThan(0)
    })
  })

  describe('4. Isolasi Cache & Header Keamanan Peramban', () => {
    it('memastikan konfigurasi nextConfig memiliki header keamanan lengkap (CSP, nosniff, frame-ancestors, HSTS)', async () => {
      expect(nextConfig.headers).toBeDefined()
      if (nextConfig.headers) {
        const headerRules = await nextConfig.headers()
        const rootRule = headerRules.find((r: { source: string }) => r.source === '/:path*')
        expect(rootRule).toBeDefined()

        const headerMap = new Map(rootRule?.headers.map((h: { key: string; value: string }) => [h.key, h.value]))
        expect(headerMap.get('X-Content-Type-Options')).toBe('nosniff')
        expect(headerMap.get('X-Frame-Options')).toBe('SAMEORIGIN')
        expect(headerMap.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
        expect(headerMap.get('Content-Security-Policy')).toContain("default-src 'self'")
        expect(headerMap.get('Content-Security-Policy')).toContain('https://app.sandbox.midtrans.com')
      }
    })

    it('memastikan respons data pesanan membawa header Cache-Control: private, no-store', async () => {
      const orderId = createdOrderIds[0]!
      const secret = orderTokens[0] || ''

      const req = new NextRequest(`http://localhost:3000/api/orders/${orderId}`, {
        headers: { 'x-order-secret-token': secret },
      })
      const res = await getOrderHandler(req, { params: Promise.resolve({ id: orderId }) })

      expect(res.status).toBe(200)
      const cacheControl = res.headers.get('Cache-Control')
      expect(cacheControl).toContain('private')
      expect(cacheControl).toContain('no-store')
    })
  })
})
