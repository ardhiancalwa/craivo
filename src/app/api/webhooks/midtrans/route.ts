import { NextRequest, NextResponse } from 'next/server'
import {
  processMidtransWebhook,
  WebhookSecurityError,
  WebhookValidationError,
} from '@/lib/server/webhook-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/webhooks/midtrans
 * Endpoint publik penerima notifikasi callback transaksi pembayaran Midtrans Core API.
 */
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'Format payload webhook harus berupa JSON valid.',
        },
      },
      { status: 400 }
    )
  }

  try {
    const result = await processMidtransWebhook(body)

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: 200 })
  } catch (err: unknown) {
    if (err instanceof WebhookSecurityError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: err.message,
          },
        },
        { status: err.statusCode }
      )
    }

    if (err instanceof WebhookValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      )
    }

    console.error('Unhandled webhook error (retryable):', err)
    // Kembalikan 500 Internal Server Error agar Midtrans menjadwalkan retry pengiriman webhook
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR_RETRYABLE',
          message: 'Gagal memproses webhook pada database server. Silakan coba lagi.',
        },
      },
      { status: 500 }
    )
  }
}

