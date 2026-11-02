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
  let body: { amount?: unknown; reason?: unknown; notes?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Format payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const { amount, reason, notes } = body

  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount <= 0) {
    return NextResponse.json(
      {
        error: 'INVALID_AMOUNT',
        message: 'Nominal refund harus berupa bilangan bulat positif dalam Rupiah (integer IDR).',
      },
      { status: 400 }
    )
  }

  if (typeof reason !== 'string' || reason.trim().length < 3) {
    return NextResponse.json(
      {
        error: 'INVALID_REASON',
        message: 'Alasan refund wajib diisi (minimal 3 karakter).',
      },
      { status: 400 }
    )
  }

  // 4. Find Order along with existing refunds
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      manualRefunds: true,
    },
  })

  if (!order) {
    return NextResponse.json(
      { error: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (order.orderStatus !== 'CANCELLED') {
    return NextResponse.json(
      {
        error: 'ORDER_NOT_CANCELLED',
        message: 'Pencatatan refund manual hanya berlaku untuk pesanan yang telah dibatalkan.',
      },
      { status: 400 }
    )
  }

  if (order.paymentStatus !== 'PAID') {
    return NextResponse.json(
      {
        error: 'ORDER_NOT_PAID',
        message: 'Pesanan belum berstatus lunas sehingga tidak ada dana fisik untuk direfund.',
      },
      { status: 400 }
    )
  }

  // Hitung akumulasi refund sebelumnya
  const totalExistingRefunds = order.manualRefunds.reduce((acc, r) => acc + r.amount, 0)
  const remainingRefundable = order.totalAmount - totalExistingRefunds

  if (amount > remainingRefundable) {
    return NextResponse.json(
      {
        error: 'REFUND_EXCEEDS_TOTAL',
        message: `Nominal refund (Rp${amount.toLocaleString('id-ID')}) melebihi sisa dana yang dapat direfund (Rp${remainingRefundable.toLocaleString('id-ID')}).`,
        totalAmount: order.totalAmount,
        alreadyRefunded: totalExistingRefunds,
        remainingRefundable,
      },
      { status: 400 }
    )
  }

  const cleanReason = reason.trim()
  const cleanNotes = typeof notes === 'string' && notes.trim() ? notes.trim() : null
  const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'

  try {
    // 5. Atomic Creation of ManualRefundRecord and AuditLog
    const { refundRecord, newTotalRefunded, newRemaining } = await prisma.$transaction(
      async (tx) => {
        // Re-read existing refunds in transaction to prevent race conditions
        const freshRefunds = await tx.manualRefundRecord.findMany({
          where: { orderId: order.id },
        })

        const freshExistingTotal = freshRefunds.reduce((acc, r) => acc + r.amount, 0)
        const freshRemaining = order.totalAmount - freshExistingTotal

        if (amount > freshRemaining) {
          throw new Error('REFUND_EXCEEDED_CONCURRENT')
        }

        const newRecord = await tx.manualRefundRecord.create({
          data: {
            orderId: order.id,
            staffUserId: staff.id,
            amount,
            reason: cleanReason,
            refundMethod: 'MANUAL_CASH',
            notes: cleanNotes,
          },
        })

        await tx.auditLog.create({
          data: {
            orderId: order.id,
            staffUserId: staff.id,
            action: 'MANUAL_REFUND_COMPLETED',
            details: JSON.stringify({
              refundRecordId: newRecord.id,
              amount,
              reason: cleanReason,
              orderNumber: order.orderNumber,
              cashier: staff.username,
              totalRefundedNow: freshExistingTotal + amount,
              remainingRefundableNow: freshRemaining - amount,
            }),
            ipAddress,
          },
        })

        return {
          refundRecord: newRecord,
          newTotalRefunded: freshExistingTotal + amount,
          newRemaining: freshRemaining - amount,
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Pencatatan refund manual berhasil disimpan.',
      refund: {
        id: refundRecord.id,
        amount: refundRecord.amount,
        reason: refundRecord.reason,
        refundMethod: refundRecord.refundMethod,
        approvedAt: refundRecord.approvedAt,
        notes: refundRecord.notes,
        staffUsername: staff.username,
      },
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        totalAmount: order.totalAmount,
        totalRefunded: newTotalRefunded,
        remainingRefundable: newRemaining,
      },
    })
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'REFUND_EXCEEDED_CONCURRENT') {
      return NextResponse.json(
        {
          error: 'REFUND_EXCEEDS_TOTAL',
          message: 'Nominal refund melebihi sisa dana yang dapat direfund karena mutasi lain baru saja dicatat.',
        },
        { status: 400 }
      )
    }

    console.error('Failed to record manual refund:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal mencatat refund manual pada server.' },
      { status: 500 }
    )
  }
}

