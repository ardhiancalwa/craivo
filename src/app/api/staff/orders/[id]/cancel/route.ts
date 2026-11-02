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

  // 3. Parse and Validate Request Body
  let body: { reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Format data JSON tidak valid.' },
      { status: 400 }
    )
  }

  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (!reason || reason.length < 3) {
    return NextResponse.json(
      {
        error: 'INVALID_REASON',
        message: 'Alasan pembatalan pesanan wajib diisi (minimal 3 karakter).',
      },
      { status: 400 }
    )
  }

  // 4. Find Order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  })

  if (!order) {
    return NextResponse.json(
      { error: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (order.orderStatus === 'COMPLETED') {
    return NextResponse.json(
      {
        error: 'CANNOT_CANCEL_COMPLETED',
        message: 'Pesanan yang sudah selesai/disajikan tidak dapat dibatalkan.',
      },
      { status: 400 }
    )
  }

  if (order.orderStatus === 'CANCELLED') {
    return NextResponse.json(
      {
        error: 'ALREADY_CANCELLED',
        message: 'Pesanan ini sudah berstatus batal.',
      },
      { status: 400 }
    )
  }

  const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'
  const isPaid = order.paymentStatus === 'PAID'

  try {
    // 5. Atomic Cancellation Execution
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // INVARIAN FINANSIAL:
      // Jika pesanan sudah PAID, paymentStatus TETAP 'PAID' agar uang kas harian tidak terhapus.
      // Hanya orderStatus yang diubah menjadi 'CANCELLED'.
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          orderStatus: 'CANCELLED',
          version: { increment: 1 },
        },
      })

      // Catat AuditLog sesuai kondisi pembayaran
      await tx.auditLog.create({
        data: {
          orderId: order.id,
          staffUserId: staff.id,
          action: isPaid
            ? 'ORDER_CANCELLED_PAID_REFUND_PENDING'
            : 'ORDER_CANCELLED_UNPAID',
          details: JSON.stringify({
            reason,
            cancelledBy: staff.username,
            role: staff.role,
            orderNumber: order.orderNumber,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
            note: isPaid
              ? 'Pesanan lunas dibatalkan. Dana tetap tercatat di omzet penerimaan; catat refund manual jika uang fisik dikembalikan.'
              : 'Pesanan belum lunas berhasil dibatalkan.',
          }),
          ipAddress,
        },
      })

      // Terbitkan OutboxEvent untuk KDS agar tiket dapur segera dihapus/ditandai batal
      await tx.outboxEvent.create({
        data: {
          channel: 'KDS',
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'ORDER_CANCELLED',
          payload: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            reason,
            cancelledBy: staff.username,
          }),
        },
      })

      // Terbitkan event untuk pelacak pesanan pelanggan
      await tx.outboxEvent.create({
        data: {
          channel: `ORDER:${order.id}`,
          aggregateType: 'ORDER',
          aggregateId: order.id,
          eventType: 'ORDER_CANCELLED',
          payload: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            orderStatus: 'CANCELLED',
            reason,
          }),
        },
      })

      return updated
    })

    return NextResponse.json({
      success: true,
      message: isPaid
        ? 'Pesanan lunas berhasil dibatalkan. Silakan catat refund manual jika uang fisik dikembalikan ke pelanggan.'
        : 'Pesanan berhasil dibatalkan.',
      order: {
        id: updatedOrder.id,
        orderNumber: updatedOrder.orderNumber,
        orderStatus: updatedOrder.orderStatus,
        paymentStatus: updatedOrder.paymentStatus,
        requiresManualRefund: isPaid,
      },
    })
  } catch (error) {
    console.error('Failed to cancel order:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal membatalkan pesanan pada server.' },
      { status: 500 }
    )
  }
}

