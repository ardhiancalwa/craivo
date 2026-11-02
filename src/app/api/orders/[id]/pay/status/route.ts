import { NextRequest, NextResponse } from 'next/server'
import { extractOrderSecretToken, OrderAccessError } from '@/lib/server/order-access'
import {
  checkAndUpdatePaymentStatus,
  PaymentServiceError,
} from '@/lib/server/payment-service'
import { MidtransGatewayError, MidtransTimeoutError } from '@/lib/server/midtrans'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/orders/[id]/pay/status
 * Memeriksa status pembayaran resmi ke Midtrans Core API dan memperbarui status pesanan jika settlement.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const token = await extractOrderSecretToken(id, req)
    const result = await checkAndUpdatePaymentStatus(id, token)

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    )
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
          },
        },
        { status: err.statusCode }
      )
    }

    if (err instanceof PaymentServiceError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      )
    }

    if (err instanceof MidtransTimeoutError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GATEWAY_TIMEOUT',
            message: 'Batas waktu koneksi ke Midtrans saat memeriksa status transaksi.',
            details: { merchantOrderId: err.merchantOrderId },
          },
        },
        { status: 504 }
      )
    }

    if (err instanceof MidtransGatewayError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.midtransCode || 'GATEWAY_ERROR',
            message: err.message,
            details: err.details,
          },
        },
        { status: err.statusCode }
      )
    }

    console.error('Unhandled GET /api/orders/[id]/pay/status error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan saat memeriksa status pembayaran.',
        },
      },
      { status: 500 }
    )
  }
}

