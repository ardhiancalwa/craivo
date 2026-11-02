import { NextRequest, NextResponse } from 'next/server'
import { extractOrderSecretToken, OrderAccessError } from '@/lib/server/order-access'
import {
  getOrInitiateQrisPayment,
  PaymentServiceError,
} from '@/lib/server/payment-service'
import { MidtransGatewayError, MidtransTimeoutError } from '@/lib/server/midtrans'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/orders/[id]/pay/qris
 * Menginisialisasi pembayaran QRIS melalui Midtrans Core API secara aman.
 * Menggunakan nominal snapshot server dan mencegah charge ganda.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const token = await extractOrderSecretToken(id, req)
    const result = await getOrInitiateQrisPayment(id, token)

    return NextResponse.json({
      success: true,
      data: result,
    }, { status: result.reused ? 200 : 201 })
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
            message: 'Koneksi ke gateway pembayaran Midtrans mengalami batas waktu. Sedang memulihkan status.',
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

    console.error('Unhandled POST /api/orders/[id]/pay/qris error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan internal saat inisialisasi pembayaran.',
        },
      },
      { status: 500 }
    )
  }
}

