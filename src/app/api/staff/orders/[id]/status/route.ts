import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'
import type { OrderStatus } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

const TargetStatusSchema = z.object({
  status: z.enum(['COOKING', 'READY', 'COMPLETED']),
})

export async function PATCH(request: Request, { params }: RouteParams) {
  // 1. CSRF Verification
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  // 2. Authoritative RBAC check: BARISTA, CASHIER, and ADMIN allowed
  let staff
  try {
    staff = await requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      )
    }
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Autentikasi staf gagal.' },
      { status: 401 }
    )
  }

  const { id: orderId } = await params

  // 3. Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Format JSON payload tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = TargetStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: 'Status target harus salah satu dari: COOKING, READY, COMPLETED.',
        details: parsed.error.format(),
      },
      { status: 400 }
    )
  }

  const targetStatus = parsed.data.status

  // 4. Find order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true },
  })

  if (!order) {
    return NextResponse.json(
      { error: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
      { status: 404 }
    )
  }

  // 5. Kitchen Gate Policy (DEC-013):
  // Dapur HANYA boleh memproses pesanan yang sudah berstatus PAID!
  if (order.paymentStatus !== 'PAID') {
    return NextResponse.json(
      {
        error: 'ORDER_NOT_PAID',
        message: 'Hanya pesanan yang sudah berstatus lunas (PAID) yang dapat diproses oleh dapur.',
      },
      { status: 400 }
    )
  }

  // 6. State transition validation
  const currentStatus = order.orderStatus
  const isValidTransition =
    (currentStatus === 'QUEUED' && targetStatus === 'COOKING') ||
    (currentStatus === 'COOKING' && targetStatus === 'READY') ||
    (currentStatus === 'READY' && targetStatus === 'COMPLETED') ||
    // Idempotent retry: transition to the same status is accepted cleanly
    currentStatus === targetStatus

  if (!isValidTransition) {
    return NextResponse.json(
      {
        error: 'INVALID_STATUS_TRANSITION',
        message: `Transisi status tidak valid dari '${currentStatus}' ke '${targetStatus}'.`,
        currentStatus,
        targetStatus,
      },
      { status: 400 }
    )
  }

  // If already at target status (idempotent)
  if (currentStatus === targetStatus) {
    return NextResponse.json({
      success: true,
      message: `Pesanan sudah berada di status ${targetStatus}.`,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        version: order.version,
      },
    })
  }

  const now = new Date()
  const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'

  try {
    // 7. Atomic update with optimistic lock (version + currentStatus check)
    const txResult = await prisma.$transaction(async (tx) => {
      const updateData: {
        orderStatus: OrderStatus
        version: { increment: number }
        completedAt?: Date
      } = {
        orderStatus: targetStatus,
        version: { increment: 1 },
      }

      if (targetStatus === 'COMPLETED') {
        updateData.completedAt = now
      }

      // Conditional update enforcing version counter and currentStatus lock
      const updateCount = await tx.order.updateMany({
        where: {
          id: orderId,
          orderStatus: currentStatus,
          paymentStatus: 'PAID',
          version: order.version,
        },
        data: updateData,
      })

      if (updateCount.count === 0) {
        // Race condition / version mismatch detected!
        const latest = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, orderStatus: true, version: true, paymentStatus: true, orderNumber: true },
        })

        if (!latest) {
          throw new Error('ORDER_NOT_FOUND')
        }

        // If another staff already updated it to targetStatus, return as clean idempotent
        if (latest.orderStatus === targetStatus) {
          return {
            conflict: false,
            idempotent: true,
            order: latest,
          }
        }

        // Concurrent update by another staff to another state
        return {
          conflict: true,
          currentStatus: latest.orderStatus,
          order: latest,
        }
      }

      const updated = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { table: true },
      })

      // Emit event for KDS channel
      await publishEvent({
        channel: 'KDS',
        aggregateType: 'ORDER',
        aggregateId: order.id,
        eventType: 'ORDER_STATUS_CHANGED',
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          tableNumber: order.table?.tableNumber || '',
          previousStatus: currentStatus,
          newStatus: targetStatus,
          updatedBy: staff.username,
          updatedAt: now.toISOString(),
        },
        tx,
      })

      // Emit event for customer tracker channel
      await publishEvent({
        channel: `ORDER:${order.id}`,
        aggregateType: 'ORDER',
        aggregateId: order.id,
        eventType: 'ORDER_STATUS_CHANGED',
        payload: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          previousStatus: currentStatus,
          orderStatus: targetStatus,
          updatedAt: now.toISOString(),
        },
        tx,
      })

      // Record AuditLog
      await tx.auditLog.create({
        data: {
          orderId: order.id,
          staffUserId: staff.id,
          action: 'ORDER_STATUS_TRANSITION',
          details: JSON.stringify({
            previousStatus: currentStatus,
            newStatus: targetStatus,
            staffUsername: staff.username,
            role: staff.role,
            version: updated.version,
          }),
          ipAddress,
        },
      })

      return {
        conflict: false,
        idempotent: false,
        order: updated,
      }
    })

    if (txResult.conflict) {
      return NextResponse.json(
        {
          error: 'CONCURRENT_MODIFICATION',
          message: `Status pesanan telah diperbarui oleh staf lain menjadi '${txResult.currentStatus}'.`,
          currentStatus: txResult.currentStatus,
          targetStatus,
        },
        { status: 409 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Status pesanan ${order.orderNumber} berhasil diperbarui menjadi ${targetStatus}.`,
      order: {
        id: txResult.order.id,
        orderNumber: txResult.order.orderNumber,
        orderStatus: txResult.order.orderStatus,
        paymentStatus: txResult.order.paymentStatus,
        version: txResult.order.version,
      },
    })
  } catch (error) {
    console.error('Failed to update order status:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal memperbarui status pesanan pada database.' },
      { status: 500 }
    )
  }
}
