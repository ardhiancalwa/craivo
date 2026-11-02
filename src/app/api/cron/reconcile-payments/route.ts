import { NextRequest, NextResponse } from 'next/server'
import { getServerEnv } from '@/lib/server/env'
import { reconcilePendingAndExpiredOrders } from '@/lib/server/reconciliation-service'

export const dynamic = 'force-dynamic'

function isAuthorizedCron(req: NextRequest): boolean {
  const env = getServerEnv()
  const authHeader = req.headers.get('authorization')

  if (!authHeader) {
    return false
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()
  return token === env.CRON_SECRET
}

/**
 * POST /api/cron/reconcile-payments
 * Endpoint terjadwal untuk merekonsiliasi pembayaran QRIS yang pending dan kedaluwarsa.
 * Terautentikasi melalui header Authorization: Bearer <CRON_SECRET>.
 */
export async function POST(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Akses ditolak. Header Authorization Bearer token tidak valid.',
        },
      },
      { status: 401 }
    )
  }

  try {
    const result = await reconcilePendingAndExpiredOrders({ dryRun: false, limit: 50 })

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    })
  } catch (err: unknown) {
    console.error('Error during scheduled payment reconciliation:', err)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RECONCILIATION_FAILED',
          message: err instanceof Error ? err.message : 'Terjadi kegagalan saat rekonsiliasi pembayaran.',
        },
      },
      { status: 500 }
    )
  }
}

/**
 * Mendukung pemanggilan GET untuk fleksibilitas runner pihak ketiga (misal cron job service).
 */
export async function GET(req: NextRequest) {
  return POST(req)
}

