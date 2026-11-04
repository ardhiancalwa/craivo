import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createOrderQuote, QuoteServiceError } from '@/lib/server/quote-service'
import { resolveGuestSession, ensureGuestSessionForTable } from '@/lib/server/guest-session'
import { verifyCsrfOrigin } from '@/lib/server/csrf'

export const dynamic = 'force-dynamic'

const OrderItemInputSchema = z
  .object({
    menuItemId: z.string().min(1, 'ID menu wajib diisi.'),
    selectedModifierOptionIds: z.array(z.string()).default([]),
    quantity: z.number().int().min(1).max(50),
    notes: z.string().max(100).optional().default(''),
  })
  .strict()

const QuoteRequestSchema = z
  .object({
    tableNumber: z.string().trim().min(1).max(10),
    items: z.array(OrderItemInputSchema).min(1, 'Keranjang belanja tidak boleh kosong.'),
    previousQuoteToken: z.string().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
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

  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: 'Format request JSON tidak valid.',
          },
        },
        { status: 400 }
      )
    }

    const parsed = QuoteRequestSchema.safeParse(body)
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: issue ? issue.message : 'Data permohonan quote tidak valid.',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      )
    }

    // Resolve sesi tamu (dengan auto-recovery untuk meja valid)
    const ensured = await ensureGuestSessionForTable(parsed.data.tableNumber, req)
    const guestSession = ensured?.session || (await resolveGuestSession(req))

    const quote = await createOrderQuote({
      ...parsed.data,
      guestSessionId: guestSession?.id,
    })

    const response = NextResponse.json({
      success: true,
      data: quote,
    })

    if (ensured?.isNewSession && ensured.rawSessionToken) {
      const isProduction = process.env.NODE_ENV === 'production'
      response.cookies.set('cravio_guest', ensured.rawSessionToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProduction,
        maxAge: 60 * 60 * 12,
      })
      response.cookies.set('cravio_table', ensured.session.table.tableNumber, {
        path: '/',
        httpOnly: false,
        sameSite: 'lax',
        maxAge: 60 * 60 * 12,
      })
    }

    return response
  } catch (error) {
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

    console.error('Unhandled quote calculation error:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Terjadi kesalahan internal saat menghitung quote harga.',
        },
      },
      { status: 500 }
    )
  }
}
