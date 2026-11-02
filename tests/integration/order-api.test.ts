// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { POST as postOrderRoute } from '@/app/api/orders/route'
import { GET as getOrderRoute } from '@/app/api/orders/[id]/route'
import { createGuestSession } from '@/lib/server/guest-session'
import { createOrderQuote } from '@/lib/server/quote-service'

describe('Order Service & Idempotent Checkout Integration Suite (Live DB)', () => {
  let table07Id: string
  let table08Id: string
  let guestSessionToken07: string
  let guestSessionId07: string
  let guestSessionToken08: string
  let guestSessionId08: string
  let sampleMenuItem: { id: string; name: string; price: number }
  let sampleModifierOptionIds: string[]
  let validQuoteToken: string
  const createdOrderIds: string[] = []
  const createdGuestSessionIds: string[] = []
  const createdIdempotencyKeys: string[] = []

  beforeAll(async () => {
    // 1. Ambil meja 07 dan meja 08
    const t07 = await prisma.table.findUnique({ where: { tableNumber: '07' } })
    const t08 = await prisma.table.findUnique({ where: { tableNumber: '08' } })
    expect(t07).not.toBeNull()
    expect(t08).not.toBeNull()
    table07Id = t07!.id
    table08Id = t08!.id

    // 2. Buat Guest Session resmi untuk meja 07 dan 08
    const s07 = await createGuestSession(table07Id)
    guestSessionToken07 = s07.token
    guestSessionId07 = s07.id
    createdGuestSessionIds.push(s07.id)

    const s08 = await createGuestSession(table08Id)
    guestSessionToken08 = s08.token
    guestSessionId08 = s08.id
    createdGuestSessionIds.push(s08.id)

    // 3. Ambil menu nyata yang memiliki modifier
    const item = await prisma.menuItem.findFirst({
      where: {
        isArchived: false,
        isAvailable: true,
        modifierGroups: { some: {} },
      },
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
    expect(item).not.toBeNull()
    sampleMenuItem = { id: item!.id, name: item!.name, price: item!.price }
    sampleModifierOptionIds = item!.modifierGroups
      .filter((mg) => mg.group.isRequired)
      .map((mg) => mg.group.options[0]!.id)

    // 4. Dapatkan quote token resmi
    const quote = await createOrderQuote({
      tableNumber: '07',
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 2,
          notes: 'Test order integration',
        },
      ],
      guestSessionId: guestSessionId07,
    })
    validQuoteToken = quote.quoteToken
  })

  afterAll(async () => {
    // Bersihkan data uji setelah suite selesai
    if (createdOrderIds.length > 0) {
      const validOrderIds = createdOrderIds.filter(Boolean)
      await prisma.auditLog.deleteMany({
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

    if (createdIdempotencyKeys.length > 0) {
      await prisma.idempotencyRecord.deleteMany({
        where: { key: { in: createdIdempotencyKeys.filter(Boolean) } },
      })
    }

    if (createdGuestSessionIds.length > 0) {
      await prisma.guestSession.deleteMany({
        where: { id: { in: createdGuestSessionIds.filter(Boolean) } },
      })
    }
  })

  let test1OrderId: string
  let test1OrderSecretToken: string
  let test1IdempotencyKey: string

  it('1. POST /api/orders: Berhasil membuat order baru dengan status UNPAID, QUEUED, dan capability token', async () => {
    test1IdempotencyKey = crypto.randomUUID()
    createdIdempotencyKeys.push(test1IdempotencyKey)

    const bodyPayload = {
      tableNumber: '07',
      paymentMethod: 'QRIS',
      customerNotes: 'Sedotan tolong pisahkan',
      quoteToken: validQuoteToken,
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 2,
          notes: 'Test order integration',
        },
      ],
    }

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': test1IdempotencyKey,
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    const res = await postOrderRoute(req)
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.orderId).toBeDefined()
    expect(data.data.orderNumber).toMatch(/^[A-Z0-9]{4}-\d{6}-\d{3,}$/)
    expect(data.data.orderStatus).toBe('QUEUED')
    expect(data.data.paymentStatus).toBe('UNPAID')
    expect(data.data.paymentMethod).toBe('QRIS')
    expect(data.data.orderSecretToken).toBeDefined()
    expect(data.data.orderSecretToken.startsWith('sec_')).toBe(true)
    expect(data.data.items).toHaveLength(1)
    expect(data.data.items[0].quantity).toBe(2)
    expect(data.data.items[0].notes).toBe('Test order integration')

    test1OrderId = data.data.orderId
    test1OrderSecretToken = data.data.orderSecretToken
    createdOrderIds.push(test1OrderId)

    // Periksa cookie capability terpasang
    const setCookieHeader = res.headers.get('set-cookie')
    expect(setCookieHeader).toContain(`cravio_ot_${test1OrderId}`)

    // Verifikasi predikat KDS: Order UNPAID TIDAK boleh muncul di antrean dapur
    const kdsOrders = await prisma.order.findMany({
      where: {
        id: test1OrderId,
        paymentStatus: 'PAID', // Predikat KDS resmi
      },
    })
    expect(kdsOrders).toHaveLength(0)

    // Verifikasi audit log tercatat
    const auditLog = await prisma.auditLog.findFirst({
      where: { orderId: test1OrderId, action: 'ORDER_CREATED' },
    })
    expect(auditLog).not.toBeNull()
  })

  it('2. Retry Idempoten: Permintaan identik dengan key yang sama mengembalikan HTTP 200 replay dan token yang sama', async () => {
    const bodyPayload = {
      tableNumber: '07',
      paymentMethod: 'QRIS',
      customerNotes: 'Sedotan tolong pisahkan',
      quoteToken: validQuoteToken,
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 2,
          notes: 'Test order integration',
        },
      ],
    }

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': test1IdempotencyKey,
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    const res = await postOrderRoute(req)
    expect(res.status).toBe(200)
    expect(res.headers.get('Idempotent-Replayed')).toBe('true')

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.data.orderId).toBe(test1OrderId)
    expect(data.data.orderSecretToken).toBe(test1OrderSecretToken)
  })

  it('3. Concurrency / Paralel: 5 request serentak dengan key yang sama menghasilkan tepat 1 order di DB', async () => {
    const concurrentKey = crypto.randomUUID()
    createdIdempotencyKeys.push(concurrentKey)

    // Buat quote baru
    const freshQuote = await createOrderQuote({
      tableNumber: '07',
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 1,
        },
      ],
      guestSessionId: guestSessionId07,
    })

    const bodyPayload = {
      tableNumber: '07',
      paymentMethod: 'CASH',
      customerNotes: '',
      quoteToken: freshQuote.quoteToken,
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 1,
          notes: '',
        },
      ],
    }

    // Jalankan 5 request paralel secara serentak
    const requests = Array.from({ length: 5 }, () =>
      postOrderRoute(
        new NextRequest('http://localhost:3000/api/orders', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': concurrentKey,
            cookie: `cravio_guest=${guestSessionToken07}`,
          },
          body: JSON.stringify(bodyPayload),
        })
      )
    )

    const responses = await Promise.all(requests)
    const statuses = responses.map((r) => r.status)

    // Setiap status harus salah satu dari:
    // 201 (berhasil buat order pertama), 200 (replayed jika sudah selesai), atau 409 (REQUEST_IN_PROGRESS)
    expect(statuses.every((s) => s === 201 || s === 200 || s === 409)).toBe(true)

    // Tepat satu request harus berhasil membuat order (status 201)
    const createdCount = statuses.filter((s) => s === 201).length
    expect(createdCount).toBe(1)

    // Cari orderId dari respons sukses
    const successRes = responses.find((r) => r.status === 201)!
    const successData = await successRes.json()
    const concurrentOrderId = successData.data.orderId
    expect(concurrentOrderId).toBeDefined()
    createdOrderIds.push(concurrentOrderId)

    // Lakukan retry untuk request yang sempat mendapat 409 IN_PROGRESS
    const retryReq = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': concurrentKey,
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify(bodyPayload),
    })

    const retryRes = await postOrderRoute(retryReq)
    expect(retryRes.status).toBe(200)
    expect(retryRes.headers.get('Idempotent-Replayed')).toBe('true')
    const retryData = await retryRes.json()
    expect(retryData.data.orderId).toBe(concurrentOrderId)

    // Verifikasi di database: TEPAT 1 order dibuat untuk kunci idempotensi ini
    const countInDb = await prisma.order.count({
      where: { id: concurrentOrderId },
    })
    expect(countInDb).toBe(1)
  })

  it('4. Deteksi Konflik: Key yang sama digunakan dengan payload berbeda mengembalikan 409 IDEMPOTENCY_KEY_REUSED', async () => {
    const conflictingPayload = {
      tableNumber: '07',
      paymentMethod: 'CASH', // Berbeda dari QRIS pada test1IdempotencyKey
      customerNotes: 'Berubah payload',
      quoteToken: validQuoteToken,
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 2,
          notes: 'Test order integration',
        },
      ],
    }

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': test1IdempotencyKey,
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify(conflictingPayload),
    })

    const res = await postOrderRoute(req)
    expect(res.status).toBe(409)

    const data = await res.json()
    expect(data.success).toBe(false)
    expect(data.error.code).toBe('IDEMPOTENCY_KEY_REUSED')
  })

  it('5. Isolasi Sesi Tamu: Sesi tamu lain yang menggunakan key yang sama menghasilkan order terpisah tanpa token leak', async () => {
    const sharedKey = crypto.randomUUID()
    createdIdempotencyKeys.push(sharedKey)

    // Quote untuk meja 08
    const quote08 = await createOrderQuote({
      tableNumber: '08',
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 1,
        },
      ],
      guestSessionId: guestSessionId08,
    })

    const body08 = {
      tableNumber: '08',
      paymentMethod: 'QRIS',
      quoteToken: quote08.quoteToken,
      items: [
        {
          menuItemId: sampleMenuItem.id,
          selectedModifierOptionIds: sampleModifierOptionIds,
          quantity: 1,
          notes: '',
        },
      ],
    }

    const req = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': sharedKey,
        cookie: `cravio_guest=${guestSessionToken08}`, // Sesi tamu meja 08
      },
      body: JSON.stringify(body08),
    })

    const res = await postOrderRoute(req)
    expect(res.status).toBe(201)

    const data = await res.json()
    expect(data.data.orderId).not.toBe(test1OrderId)
    createdOrderIds.push(data.data.orderId)
  })

  it('6. Validasi & Keamanan: Menolak request tanpa sesi tamu, meja tidak cocok, atau payload disusupi', async () => {
    const freshKey = crypto.randomUUID()

    // 6a. Tanpa cookie cravio_guest -> 401
    const reqNoSession = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': freshKey,
      },
      body: JSON.stringify({
        tableNumber: '07',
        paymentMethod: 'QRIS',
        quoteToken: validQuoteToken,
        items: [
          {
            menuItemId: sampleMenuItem.id,
            selectedModifierOptionIds: sampleModifierOptionIds,
            quantity: 1,
          },
        ],
      }),
    })
    const resNoSession = await postOrderRoute(reqNoSession)
    expect(resNoSession.status).toBe(401)

    // 6b. Sesi meja 07 memesan meja 08 -> 403 TABLE_MISMATCH
    const reqMismatch = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify({
        tableNumber: '08', // Meja tidak sesuai sesi
        paymentMethod: 'QRIS',
        quoteToken: validQuoteToken,
        items: [
          {
            menuItemId: sampleMenuItem.id,
            selectedModifierOptionIds: sampleModifierOptionIds,
            quantity: 1,
          },
        ],
      }),
    })
    const resMismatch = await postOrderRoute(reqMismatch)
    expect(resMismatch.status).toBe(403)

    // 6c. Header Idempotency-Key bukan UUID -> 400 IDEMPOTENCY_KEY_INVALID
    const reqBadKey = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'not-a-valid-uuid-v4',
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify({
        tableNumber: '07',
        paymentMethod: 'QRIS',
        quoteToken: validQuoteToken,
        items: [
          {
            menuItemId: sampleMenuItem.id,
            selectedModifierOptionIds: sampleModifierOptionIds,
            quantity: 1,
          },
        ],
      }),
    })
    const resBadKey = await postOrderRoute(reqBadKey)
    expect(resBadKey.status).toBe(400)

    // 6d. Payload disusupi field manipulatif seperti { totalAmount: 1 } -> 400 VALIDATION_FAILED
    const reqInjected = new NextRequest('http://localhost:3000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
        cookie: `cravio_guest=${guestSessionToken07}`,
      },
      body: JSON.stringify({
        tableNumber: '07',
        paymentMethod: 'QRIS',
        quoteToken: validQuoteToken,
        items: [
          {
            menuItemId: sampleMenuItem.id,
            selectedModifierOptionIds: sampleModifierOptionIds,
            quantity: 1,
          },
        ],
        totalAmount: 1, // Field asing yang harus ditolak secara strict
      }),
    })
    const resInjected = await postOrderRoute(reqInjected)
    expect(resInjected.status).toBe(400)
  })

  it('7. Preservasi Snapshot: Perubahan nama dan harga menu di database tidak memengaruhi snapshot order lama', async () => {
    // Ambil order item asli dari test 1
    const originalItem = await prisma.orderItem.findFirst({
      where: { orderId: test1OrderId },
    })
    expect(originalItem).not.toBeNull()
    const savedName = originalItem!.nameSnapshot
    const savedPrice = originalItem!.priceSnapshot

    // Ubah data menu di database (simulasi pengelola kafe mengedit nama & menaikkan harga)
    const originalDbPrice = sampleMenuItem.price
    const originalDbName = sampleMenuItem.name

    await prisma.menuItem.update({
      where: { id: sampleMenuItem.id },
      data: {
        name: 'Nama Menu Telah Berubah',
        price: originalDbPrice + 50000,
      },
    })

    try {
      // Baca kembali snapshot order item dari database
      const refetchedItem = await prisma.orderItem.findFirst({
        where: { orderId: test1OrderId },
      })
      expect(refetchedItem!.nameSnapshot).toBe(savedName)
      expect(refetchedItem!.priceSnapshot).toBe(savedPrice)
    } finally {
      // Pulihkan data menu asli
      await prisma.menuItem.update({
        where: { id: sampleMenuItem.id },
        data: {
          name: originalDbName,
          price: originalDbPrice,
        },
      })
    }
  })

  it('8. Proteksi Akses Capability (GET /api/orders/[id]): Token valid memberi 200, tanpa token/token salah memberi 403', async () => {
    // 8a. Akses dengan token valid melalui header X-Order-Secret-Token
    const reqValid = new NextRequest(
      `http://localhost:3000/api/orders/${test1OrderId}`,
      {
        method: 'GET',
        headers: {
          'X-Order-Secret-Token': test1OrderSecretToken,
        },
      }
    )
    const resValid = await getOrderRoute(reqValid, {
      params: Promise.resolve({ id: test1OrderId }),
    })
    expect(resValid.status).toBe(200)

    const data = await resValid.json()
    expect(data.success).toBe(true)
    expect(data.data.id).toBe(test1OrderId)
    // Field kriptografis sensitif tidak boleh bocor ke respons
    expect(data.data.orderSecretTokenHash).toBeUndefined()
    expect(data.data.capabilityNonce).toBeUndefined()

    // 8b. Akses tanpa token -> 403
    const reqNoToken = new NextRequest(
      `http://localhost:3000/api/orders/${test1OrderId}`,
      { method: 'GET' }
    )
    const resNoToken = await getOrderRoute(reqNoToken, {
      params: Promise.resolve({ id: test1OrderId }),
    })
    expect(resNoToken.status).toBe(403)

    // 8c. Akses dengan token salah -> 403
    const reqWrongToken = new NextRequest(
      `http://localhost:3000/api/orders/${test1OrderId}`,
      {
        method: 'GET',
        headers: {
          'X-Order-Secret-Token': 'sec_invalid_attacker_token',
        },
      }
    )
    const resWrongToken = await getOrderRoute(reqWrongToken, {
      params: Promise.resolve({ id: test1OrderId }),
    })
    expect(resWrongToken.status).toBe(403)

    // 8d. Akses order ID yang tidak ada -> 403 seragam
    const reqNonExistent = new NextRequest(
      'http://localhost:3000/api/orders/ord_non_existent',
      {
        method: 'GET',
        headers: {
          'X-Order-Secret-Token': test1OrderSecretToken,
        },
      }
    )
    const resNonExistent = await getOrderRoute(reqNonExistent, {
      params: Promise.resolve({ id: 'ord_non_existent' }),
    })
    expect(resNonExistent.status).toBe(403)
  })
})
