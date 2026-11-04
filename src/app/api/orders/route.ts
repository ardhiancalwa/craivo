import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/server/db'
import { ensureGuestSessionForTable } from '@/lib/server/guest-session'
import {
  computePayloadFingerprint,
  claimIdempotencyKey,
  failIdempotencyRecord,
  IdempotencyConflictError,
  IdempotencyInProgressError,
} from '@/lib/server/idempotency'
import { deriveOrderSecretToken } from '@/lib/server/order-capability'
import { createOrderFromQuote } from '@/lib/server/order-service'
import { QuoteServiceError } from '@/lib/server/quote-service'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { checkGuestCheckoutRateLimit } from '@/lib/server/rate-limiter'

export const dynamic = 'force-dynamic'

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const OrderItemInputSchema = z
  .object({
    menuItemId: z.string().min(1, 'ID menu wajib diisi.'),
    selectedModifierOptionIds: z.array(z.string()).default([]),
    quantity: z.number().int().min(1).max(50),
    notes: z.string().max(100).optional().default(''),
  })
  .strict()

const CreateOrderSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(10),
    paymentMethod: z.enum(['QRIS', 'CASH', 'MANUAL_QRIS', 'MANUAL_TRANSFER']),
    customerNotes: z.string().max(100).optional(),
    quoteToken: z.string().min(1, 'Quote token wajib disertakan.'),
    items: z.array(OrderItemInputSchema).min(1).max(50),
  })
  .strict()

export async function POST(req: NextRequest) {
  // 0. Verifikasi CSRF Origin
  if (!verifyCsrfOrigin(req)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'CSRF_REJECTED',
          message: 'Permintaan ditolak: Origin tidak sah.',
        },
      },
      { status: 403 }
    )
  }

  // 1. Validasi Header Idempotency-Key (Wajib UUID v4)
  const rawKey = req.headers.get('idempotency-key')
  const idempotencyKey = rawKey ? rawKey.trim() : ''

  if (!idempotencyKey || !UUID_REGEX.test(idempotencyKey)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_INVALID',
          message: 'Header Idempotency-Key wajib disertakan dalam format UUID valid.',
        },
      },
      { status: 400 }
    )
  }

  // 2. Validasi Body Request (Strict)
  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Format JSON payload tidak valid.',
        },
      },
      { status: 400 }
    )
  }

  const parsed = CreateOrderSchema.safeParse(rawBody)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: issue ? issue.message : 'Data checkout pesanan tidak valid.',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    )
  }

  const payload = parsed.data
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined

  // 3. Validasi & Auto-Recovery Sesi Tamu
  const ensured = await ensureGuestSessionForTable(
    payload.tableNumber,
    req,
    ipAddress,
    req.headers.get('user-agent') || undefined
  )

  if (!ensured) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TABLE_NOT_FOUND',
          message: `Meja ${payload.tableNumber} tidak ditemukan atau sedang tidak aktif di kafe.`,
        },
      },
      { status: 400 }
    )
  }

  const guestSession = ensured.session
  const newGuestSessionToken = ensured.isNewSession ? ensured.rawSessionToken : null

  if (!guestSession.table.isActive) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TABLE_INACTIVE',
          message: `Meja ${guestSession.table.tableNumber} sedang dinonaktifkan oleh staf kafe.`,
        },
      },
      { status: 403 }
    )
  }

  // 5. Klaim Idempotency Key
  const requestHash = computePayloadFingerprint(payload)

  try {
    const claim = await claimIdempotencyKey({
      key: idempotencyKey,
      scope: 'CREATE_ORDER',
      ownerId: guestSession.id,
      requestHash,
    })

    const isSecure = process.env.NODE_ENV === 'production'

    // Kasus A: Replay Respons Sukses Sebelumnya
    if (claim.status === 'COMPLETED') {
      const cached = JSON.parse(claim.record.responseBody || '{}')
      const orderId = claim.record.orderId

      let recomputedToken: string | null = null
      if (orderId) {
        const order = await prisma.order.findUnique({
          where: { id: orderId },
          select: { capabilityNonce: true },
        })
        if (order?.capabilityNonce) {
          recomputedToken = deriveOrderSecretToken(orderId, order.capabilityNonce)
        }
      }

      const replayResponse = NextResponse.json(
        {
          success: true,
          data: {
            ...cached,
            orderSecretToken: recomputedToken,
          },
        },
        { status: 200 }
      )

      replayResponse.headers.set('Idempotent-Replayed', 'true')

      if (orderId && recomputedToken) {
        replayResponse.cookies.set(`cravio_ot_${orderId}`, recomputedToken, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          maxAge: 24 * 60 * 60,
        })
      }

      if (newGuestSessionToken) {
        replayResponse.cookies.set('cravio_guest', newGuestSessionToken, {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: isSecure,
          maxAge: 12 * 60 * 60,
        })
        replayResponse.cookies.set('cravio_table', guestSession.table.tableNumber, {
          path: '/',
          httpOnly: false,
          sameSite: 'lax',
          maxAge: 12 * 60 * 60,
        })
      }

      return replayResponse
    }

    // Kasus B: Claim Baru Berhasil -> Eksekusi Pembuatan Order
    const ipAddress = req.headers.get('x-forwarded-for') || undefined
    const rateLimitResult = await checkGuestCheckoutRateLimit(guestSession.id, ipAddress)
    if (!rateLimitResult.allowed) {
      await failIdempotencyRecord({
        id: claim.record.id,
        responseStatus: 429,
        responseBody: JSON.stringify({
          error: 'RATE_LIMIT_EXCEEDED',
          message: rateLimitResult.message,
        }),
      }).catch(() => {})

      const rateLimitResponse = NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: rateLimitResult.message || 'Terlalu banyak permintaan pemesanan.',
          },
        },
        { status: 429 }
      )
      if (rateLimitResult.resetSeconds) {
        rateLimitResponse.headers.set('Retry-After', String(rateLimitResult.resetSeconds))
      }
      return rateLimitResponse
    }

    const result = await createOrderFromQuote({
      tableNumber: payload.tableNumber,
      paymentMethod: payload.paymentMethod,
      customerNotes: payload.customerNotes,
      quoteToken: payload.quoteToken,
      items: payload.items,
      guestSessionId: guestSession.id,
      idempotencyRecordId: claim.record.id,
      ipAddress,
    })

    const res = NextResponse.json(
      {
        success: true,
        data: {
          ...result.order,
          orderSecretToken: result.orderSecretToken,
        },
      },
      { status: 201 }
    )

    // Set HttpOnly capability cookie untuk navigasi aman tanpa token di URL
    res.cookies.set(`cravio_ot_${result.order.orderId}`, result.orderSecretToken, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      maxAge: 24 * 60 * 60,
    })

    if (newGuestSessionToken) {
      res.cookies.set('cravio_guest', newGuestSessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        maxAge: 12 * 60 * 60,
      })
      res.cookies.set('cravio_table', guestSession.table.tableNumber, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 12 * 60 * 60,
      })
    }

    return res
  } catch (error: unknown) {
    if (error instanceof IdempotencyConflictError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      )
    }

    if (error instanceof IdempotencyInProgressError) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        },
        { status: error.statusCode }
      )
      response.headers.set('Retry-After', String(error.retryAfterSeconds))
      return response
    }

    if (error instanceof QuoteServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: error.code,
            message: error.message,
            details: error.details || null,
          },
        },
        { status: error.statusCode }
      )
    }

    console.error('Unhandled order creation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan sistem saat memproses pesanan Anda.',
        },
      },
      { status: 500 }
    )
  }
}

