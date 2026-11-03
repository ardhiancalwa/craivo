import { NextRequest, NextResponse } from 'next/server'
import { extractOrderSecretToken, verifyOrderAccess, OrderAccessError } from '@/lib/server/order-access'
import { checkAndUpdatePaymentStatus } from '@/lib/server/payment-service'
import { simulateSandboxQrisPayment, MidtransGatewayError } from '@/lib/server/midtrans'
import { getServerEnv } from '@/lib/server/env'
import { prisma } from '@/lib/server/db'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/orders/[id]/pay/simulate
 * Endpoint helper khusus Sandbox / Development untuk mensimulasikan pembayaran lunas QRIS secara otomatis
 * tanpa perlu navigasi manual ke simulator web Midtrans.
 * 
 * ATURAN KEAMANAN:
 * - Diblokir seketika dengan 403 Forbidden bila MIDTRANS_IS_PRODUCTION=true.
 * - Memerlukan orderSecretToken valid dari pembuat order.
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id } = await params

  try {
    const env = getServerEnv()
    if (env.MIDTRANS_IS_PRODUCTION) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN_IN_PRODUCTION',
            message: 'Simulasi pembayaran dinonaktifkan di environment produksi.',
          },
        },
        { status: 403 }
      )
    }

    const token = await extractOrderSecretToken(id, req)
    const order = await verifyOrderAccess(id, token)

    if (order.paymentStatus === 'PAID') {
      return NextResponse.json({
        success: true,
        message: 'Pesanan ini sudah berstatus lunas.',
        data: { paymentStatus: 'PAID' },
      })
    }

    // Cari attempt pembayaran aktif yang memiliki QR URL
    const activeAttempt = await prisma.paymentAttempt.findFirst({
      where: {
        orderId: id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })

    if (!activeAttempt || !activeAttempt.qrisUrl) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_ACTIVE_QRIS',
            message: 'Tidak ada kode QRIS aktif yang dapat disimulasikan. Silakan buka halaman pembayaran terlebih dahulu.',
          },
        },
        { status: 400 }
      )
    }

    // Eksekusi simulasi ke Midtrans Simulator OpenAPI v2
    const simResult = await simulateSandboxQrisPayment(activeAttempt.qrisUrl)

    if (!simResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SIMULATION_REJECTED',
            message: simResult.error || 'Simulasi pembayaran ditolak oleh simulator Midtrans.',
          },
        },
        { status: 422 }
      )
    }

    // Verifikasi dan sinkronkan status pesanan secara resmi melalui API status Midtrans
    const syncResult = await checkAndUpdatePaymentStatus(id, token)

    return NextResponse.json({
      success: true,
      message: 'Simulasi pembayaran QRIS berhasil diselesaikan di Midtrans Sandbox.',
      data: syncResult,
    })
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

    if (err instanceof MidtransGatewayError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: err.midtransCode || 'GATEWAY_ERROR',
            message: err.message,
          },
        },
        { status: err.statusCode }
      )
    }

    console.error('Unhandled POST /api/orders/[id]/pay/simulate error:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Terjadi kesalahan saat memproses simulasi pembayaran.',
        },
      },
      { status: 500 }
    )
  }
}
