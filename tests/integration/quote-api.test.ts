// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/server/db'
import { POST as postQuoteRoute } from '@/app/api/orders/quote/route'

describe('Server-Authoritative Quote API Integration Suite (Live DB)', () => {
  let sampleMenuItemId: string
  let sampleRequiredModifierOptionIds: string[]
  let sampleSingleModifierOptionId: string

  // Ambil menu dan modifier nyata dari database seeder
  it('setup: mengambil data menu dan modifier dari database', async () => {
    const item = await prisma.menuItem.findFirst({
      where: {
        isArchived: false,
        isAvailable: true,
        modifierGroups: {
          some: {
            group: {
              isRequired: true,
            },
          },
        },
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
    sampleMenuItemId = item!.id
    sampleSingleModifierOptionId = item!.modifierGroups[0]!.group.options[0]!.id
    sampleRequiredModifierOptionIds = item!.modifierGroups
      .filter((mg) => mg.group.isRequired)
      .map((mg) => mg.group.options[0]!.id)
  })

  it('1. POST /api/orders/quote: menghitung subtotal server resmi dan mengembalikan token 15 menit', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: sampleRequiredModifierOptionIds,
            quantity: 2,
            notes: 'Less sugar please',
          },
        ],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.quoteId).toBeDefined()
    expect(body.data.quoteToken).toBeTypeOf('string')
    expect(body.data.subtotalAmount).toBeGreaterThan(0)
    expect(body.data.taxAmount).toBe(0)
    expect(body.data.serviceAmount).toBe(0)
    expect(body.data.totalAmount).toBe(body.data.subtotalAmount)
    expect(Number.isInteger(body.data.totalAmount)).toBe(true)
    expect(body.data.expiresAt).toBeDefined()

    // Validasi masa berlaku (15 menit ke depan)
    const expiry = new Date(body.data.expiresAt).getTime()
    const now = Date.now()
    expect(expiry - now).toBeGreaterThan(13 * 60 * 1000) // ~15 menit
  })

  it('2. Penolakan meja fiktif: mengembalikan 404 TABLE_NOT_FOUND', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '99',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: sampleRequiredModifierOptionIds,
            quantity: 1,
          },
        ],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(404)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('TABLE_NOT_FOUND')
  })

  it('3. Penolakan keranjang kosong: mengembalikan 400 VALIDATION_FAILED', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_FAILED')
  })

  it('4. Penolakan modifier palsu / selundupan dari menu lain: mengembalikan 400 MODIFIER_INVALID', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: [
              ...sampleRequiredModifierOptionIds,
              'fake-modifier-option-id-999',
            ],
            quantity: 1,
          },
        ],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MODIFIER_INVALID')
  })

  it('5. Penolakan duplikasi opsi modifier pada baris yang sama: mengembalikan 400 MODIFIER_INVALID', async () => {
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: [
              ...sampleRequiredModifierOptionIds,
              sampleRequiredModifierOptionIds[0]!, // duplikat
            ],
            quantity: 1,
          },
        ],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MODIFIER_INVALID')
  })

  it('6. Penolakan saat grup wajib tidak dipilih: mengembalikan 400 MODIFIER_GROUP_REQUIRED', async () => {
    // Kirim tanpa opsi apa pun pada item yang memiliki grup wajib
    const req = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: [], // kosong padahal isRequired
            quantity: 1,
          },
        ],
      }),
    })

    const res = await postQuoteRoute(req)
    expect(res.status).toBe(400)

    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('MODIFIER_GROUP_REQUIRED')
  })

  it('7. Deteksi ITEM_STOCK_DEPLETED: menolak menu yang berstatus habis', async () => {
    // Cari atau buat item yang isAvailable: false
    const soldOutItem = await prisma.menuItem.findFirst({
      where: { isAvailable: false, isArchived: false },
    })

    if (soldOutItem) {
      const req = new NextRequest('http://localhost:3000/api/orders/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tableNumber: '07',
          items: [
            {
              menuItemId: soldOutItem.id,
              selectedModifierOptionIds: [],
              quantity: 1,
            },
          ],
        }),
      })

      const res = await postQuoteRoute(req)
      expect(res.status).toBe(409)

      const body = await res.json()
      expect(body.success).toBe(false)
      expect(body.error.code).toBe('ITEM_STOCK_DEPLETED')
    }
  })

  it('8. Deteksi PRICE_CHANGED: menolak diam-diam saat harga berbeda dengan token quote lama', async () => {
    // 1. Buat quote pertama dengan quantity 1
    const req1 = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: sampleRequiredModifierOptionIds,
            quantity: 1,
          },
        ],
      }),
    })

    const res1 = await postQuoteRoute(req1)
    expect(res1.status).toBe(200)
    const body1 = await res1.json()
    const firstQuoteToken = body1.data.quoteToken

    // 2. Minta quote kedua dengan token pertama tetapi quantity 2 (total harga berbeda)
    const req2 = new NextRequest('http://localhost:3000/api/orders/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableNumber: '07',
        items: [
          {
            menuItemId: sampleMenuItemId,
            selectedModifierOptionIds: sampleRequiredModifierOptionIds,
            quantity: 2, // Double total
          },
        ],
        previousQuoteToken: firstQuoteToken,
      }),
    })

    const res2 = await postQuoteRoute(req2)
    expect(res2.status).toBe(409)

    const body2 = await res2.json()
    expect(body2.success).toBe(false)
    expect(body2.error.code).toBe('PRICE_CHANGED')
    expect(body2.error.details.previousTotal).toBeDefined()
    expect(body2.error.details.updatedTotal).toBeDefined()
  })
})
