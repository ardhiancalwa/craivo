import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { prisma } from '@/lib/server/db'
import { logger } from '@/lib/server/logger'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID()
  const log = logger.withCorrelation(correlationId)

  // 1. Otorisasi ketat: Khusus role ADMIN
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  try {
    // 2. Uji latensi roundtrip database
    const dbStart = performance.now()
    await prisma.$queryRawUnsafe('SELECT 1;')
    const dbLatencyMs = Math.round(performance.now() - dbStart)

    // 3. Metrik antrean & transaksi tertunda
    const now = new Date()
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000)
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000)

    const [
      pendingPaymentCount,
      staleQueueCount,
      activeTablesCount,
      totalOrdersToday,
    ] = await Promise.all([
      // Order dengan status PENDING berumur > 15 menit (mendekati batas kedaluwarsa)
      prisma.order.count({
        where: {
          paymentStatus: 'PENDING',
          createdAt: {
            lt: fifteenMinutesAgo,
          },
        },
      }),

      // Order QUEUED yang belum diproses dapur > 30 menit
      prisma.order.count({
        where: {
          orderStatus: 'QUEUED',
          paymentStatus: 'PAID',
          createdAt: {
            lt: thirtyMinutesAgo,
          },
        },
      }),

      // Meja aktif terdaftar
      prisma.table.count({
        where: {
          isActive: true,
        },
      }),

      // Total order hari ini
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          },
        },
      }),
    ])

    // Sanitasi info host database
    let sanitizedDbHost = 'unknown'
    try {
      const url = new URL(process.env.DATABASE_URL || '')
      sanitizedDbHost = url.host
    } catch {
      // Ignored
    }

    const memoryUsage = process.memoryUsage()

    const diagnostics = {
      status: 'healthy',
      timestamp: now.toISOString(),
      correlationId,
      environment: {
        appEnv: process.env.APP_ENV || 'development',
        isProductionGateway: process.env.MIDTRANS_IS_PRODUCTION === 'true',
        databaseHost: sanitizedDbHost,
        nodeVersion: process.version,
      },
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
        healthy: dbLatencyMs < 2000,
      },
      operations: {
        pendingPaymentsAging15m: pendingPaymentCount,
        staleKitchenQueues30m: staleQueueCount,
        activeOccupiedTables: activeTablesCount,
        totalOrdersToday,
      },
      system: {
        uptimeSeconds: Math.round(process.uptime()),
        rssMemoryMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
    }

    log.info('SYSTEM_DIAGNOSTICS_ACCESSED', {
      dbLatencyMs,
      pendingPaymentCount,
      staleQueueCount,
    })

    return NextResponse.json({
      success: true,
      diagnostics,
    })
  } catch (err: unknown) {
    const errorObj = err instanceof Error ? err : new Error(String(err))
    log.error('SYSTEM_DIAGNOSTICS_FAILED', errorObj)
    return NextResponse.json(
      {
        success: false,
        status: 'degraded',
        error: errorObj.message || 'Gagal mengambil diagnostik sistem.',
      },
      { status: 500 }
    )
  }
}
