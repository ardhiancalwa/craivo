import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  // 1. CSRF Origin Verification
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  // 2. Authoritative Server-Side RBAC Check: Only CASHIER and ADMIN allowed
  let staff
  try {
    staff = await requireStaffRole(['CASHIER', 'ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      )
    }
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Autentikasi gagal.' },
      { status: 401 }
    )
  }

  const { id: orderId } = await params

  // 3. Initial check on Order existence and method
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      table: true,
    },
  })

  if (!order) {
    return NextResponse.json(
      { error: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
      { status: 404 }
    )
  }

  // Validasi metode pembayaran: Hanya pesanan CASH, MANUAL_QRIS, dan MANUAL_TRANSFER yang dapat dikonfirmasi kasir secara manual
  const manualPaymentMethods = ['CASH', 'MANUAL_QRIS', 'MANUAL_TRANSFER']
  if (!manualPaymentMethods.includes(order.paymentMethod)) {
    return NextResponse.json(
      {
        error: 'INVALID_PAYMENT_METHOD',
        message: 'Hanya pesanan Tunai, QRIS Manual Toko, atau Transfer Bank yang dapat dikonfirmasi kasir.',
      },
      { status: 400 }
    )
  }

  // Validasi status pembatalan
  if (order.orderStatus === 'CANCELLED') {
    return NextResponse.json(
      {
        error: 'ORDER_CANCELLED',
        message: 'Pesanan telah dibatalkan dan tidak dapat dikonfirmasi.',
      },
      { status: 400 }
    )
  }

  // Jika pesanan sudah berstatus PAID (Idempoten)
  if (order.paymentStatus === 'PAID') {
    return NextResponse.json({
      success: true,
      message: 'Pesanan ini sudah berstatus lunas.',
      idempotent: true,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        paidAt: order.paidAt,
      },
    })
  }

  const now = new Date()
  const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'

  try {
    // 4. Atomic Transaction with Concurrency & Double-Click Protection
    const result = await prisma.$transaction(async (tx) => {
      // Menggunakan conditional updateMany sebagai row-level atomic lock.
      // Hanya 1 request bersamaan yang akan berhasil mengupdate record (count === 1).
      // Request bersamaan lainnya akan mendapatkan count === 0 dan masuk ke cabang idempoten.
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          paymentMethod: 'CASH',
          paymentStatus: { not: 'PAID' },
          orderStatus: { not: 'CANCELLED' },
        },
        data: {
          paymentStatus: 'PAID',
          paidAt: now,
          orderStatus: 'QUEUED',
          version: { increment: 1 },
        },
      })

      if (updateResult.count === 0) {
        // Cek apakah order sudah diselesaikan oleh transaksi paralel lain atau dibatalkan
        const freshOrder = await tx.order.findUnique({
          where: { id: orderId },
        })

        if (!freshOrder) {
          throw new Error('ORDER_NOT_FOUND')
        }

        if (freshOrder.orderStatus === 'CANCELLED') {
          throw new Error('ORDER_CANCELLED')
        }

        if (freshOrder.paymentStatus === 'PAID') {
          return {
            idempotent: true,
            order: freshOrder,
          }
        }

        throw new Error('ORDER_STATE_CONFLICT')
      }

      // Berhasil menang dalam concurrency race! Ambil data pesanan lengkap
      const freshOrder = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: true,
          table: true,
        },
      })

      // Catat PaymentAttempt untuk histori pembayaran CASH
      const cashAttemptSuffix = Date.now().toString(36)
      await tx.paymentAttempt.create({
        data: {
          orderId: freshOrder.id,
          merchantOrderId: `${freshOrder.orderNumber}-CASH-${cashAttemptSuffix}`,
          gateway: 'MANUAL_CASH',
          grossAmount: freshOrder.totalAmount,
          status: 'PAID',
          expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          rawResponse: JSON.stringify({
            confirmedBy: staff.username,
            staffId: staff.id,
            role: staff.role,
            paidAt: now.toISOString(),
          }),
        },
      })

      // Increment soldCount pada setiap item menu
      for (const item of freshOrder.items) {
        if (item.menuItemId) {
          await tx.menuItem
            .update({
              where: { id: item.menuItemId },
              data: {
                soldCount: { increment: item.quantity },
              },
            })
            .catch(() => {})
        }
      }

      // Terbitkan tepat SATU durable OutboxEvent untuk sinkronisasi KDS
      await tx.outboxEvent.create({
        data: {
          channel: 'KDS',
          aggregateType: 'ORDER',
          aggregateId: freshOrder.id,
          eventType: 'ORDER_PAID',
          payload: JSON.stringify({
            orderId: freshOrder.id,
            orderNumber: freshOrder.orderNumber,
            tableNumber: freshOrder.table?.tableNumber || '',
            totalAmount: freshOrder.totalAmount,
            paidAt: now.toISOString(),
            paymentMethod: 'CASH',
            confirmedBy: staff.username,
          }),
        },
      })

      // Terbitkan event untuk pelacak pesanan pelanggan
      await tx.outboxEvent.create({
        data: {
          channel: `ORDER:${freshOrder.id}`,
          aggregateType: 'ORDER',
          aggregateId: freshOrder.id,
          eventType: 'PAYMENT_CONFIRMED',
          payload: JSON.stringify({
            orderId: freshOrder.id,
            orderNumber: freshOrder.orderNumber,
            paymentStatus: 'PAID',
            paidAt: now.toISOString(),
          }),
        },
      })

      // Catat AuditLog
      await tx.auditLog.create({
        data: {
          orderId: freshOrder.id,
          staffUserId: staff.id,
          action: 'CONFIRM_CASH',
          details: JSON.stringify({
            confirmedBy: staff.username,
            role: staff.role,
            amount: freshOrder.totalAmount,
            orderNumber: freshOrder.orderNumber,
          }),
          ipAddress,
        },
      })

      return {
        idempotent: false,
        order: freshOrder,
      }
    })

    return NextResponse.json({
      success: true,
      message: result.idempotent
        ? 'Pesanan ini sudah dikonfirmasi lunas.'
        : 'Pembayaran tunai berhasil dikonfirmasi kasir.',
      idempotent: result.idempotent,
      order: {
        id: result.order.id,
        orderNumber: result.order.orderNumber,
        paymentStatus: result.order.paymentStatus,
        orderStatus: result.order.orderStatus,
        paidAt: result.order.paidAt,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'ORDER_CANCELLED') {
      return NextResponse.json(
        {
          error: 'ORDER_CANCELLED',
          message: 'Pesanan telah dibatalkan dan tidak dapat dikonfirmasi.',
        },
        { status: 400 }
      )
    }

    console.error('Failed to confirm cash order:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal mengonfirmasi pembayaran tunai pada server.' },
      { status: 500 }
    )
  }
}
