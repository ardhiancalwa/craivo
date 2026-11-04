import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 1. Authoritative Server-Side RBAC Check: Only CASHIER and ADMIN allowed
  try {
    await requireStaffRole(['CASHIER', 'ADMIN'], request)
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

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') || 'cash_queue'

  try {
    // Hitung badge counter untuk masing-masing tab secara paralel
    const [cashQueueCount, paidCount, cancelledCount] = await Promise.all([
      prisma.order.count({
        where: {
          paymentMethod: { in: ['CASH', 'MANUAL_QRIS', 'MANUAL_TRANSFER'] },
          paymentStatus: 'WAITING_CASHIER',
          orderStatus: { not: 'CANCELLED' },
        },
      }),
      prisma.order.count({
        where: {
          paymentStatus: 'PAID',
        },
      }),
      prisma.order.count({
        where: {
          orderStatus: 'CANCELLED',
        },
      }),
    ])

    // Filter query berdasarkan tab
    let whereClause: Record<string, unknown> = {}
    let orderByClause: Record<string, 'asc' | 'desc'> = { createdAt: 'desc' }

    if (tab === 'cash_queue') {
      whereClause = {
        paymentMethod: { in: ['CASH', 'MANUAL_QRIS', 'MANUAL_TRANSFER'] },
        paymentStatus: 'WAITING_CASHIER',
        orderStatus: { not: 'CANCELLED' },
      }
      // FIFO: Pesanan yang menunggu paling lama diletakkan di paling atas
      orderByClause = { createdAt: 'asc' }
    } else if (tab === 'paid_history') {
      whereClause = {
        paymentStatus: 'PAID',
      }
      // LIFO: Transaksi lunas terbaru di urutan teratas
      orderByClause = { paidAt: 'desc' }
    } else if (tab === 'cancelled_history') {
      whereClause = {
        orderStatus: 'CANCELLED',
      }
      orderByClause = { updatedAt: 'desc' }
    }

    const rawOrders = await prisma.order.findMany({
      where: whereClause,
      orderBy: orderByClause,
      take: 50,
      include: {
        table: {
          select: {
            id: true,
            tableNumber: true,
          },
        },
        items: {
          include: {
            modifiers: true,
          },
        },
        manualRefunds: {
          include: {
            staffUser: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
          orderBy: { approvedAt: 'desc' },
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            createdAt: true,
            details: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    })

    const orders = rawOrders.map((order) => {
      const totalRefunded = order.manualRefunds.reduce((acc, r) => acc + r.amount, 0)
      return {
        id: order.id,
        orderNumber: order.orderNumber,
        tableNumber: order.table?.tableNumber || '-',
        tableLabel: null,
        customerNotes: order.customerNotes,
        subtotalAmount: order.subtotalAmount,
        taxAmount: order.taxAmount,
        serviceAmount: order.serviceAmount,
        totalAmount: order.totalAmount,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        paymentProofUrl: order.paymentProofUrl || null,
        createdAt: order.createdAt.toISOString(),
        paidAt: order.paidAt?.toISOString() || null,
        updatedAt: order.updatedAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          name: item.nameSnapshot,
          price: item.priceSnapshot,
          quantity: item.quantity,
          notes: item.notes,
          subtotal: item.subtotal,
          modifiers: item.modifiers.map((m) => ({
            id: m.id,
            name: m.nameSnapshot,
            price: m.priceSnapshot,
          })),
        })),
        manualRefunds: order.manualRefunds.map((r) => ({
          id: r.id,
          amount: r.amount,
          reason: r.reason,
          refundMethod: r.refundMethod,
          approvedAt: r.approvedAt.toISOString(),
          notes: r.notes,
          staffUsername: r.staffUser.username,
        })),
        totalRefunded,
        remainingRefundable: Math.max(0, order.totalAmount - totalRefunded),
        auditLogs: order.auditLogs.map((log) => ({
          id: log.id,
          action: log.action,
          createdAt: log.createdAt.toISOString(),
          details: log.details,
        })),
      }
    })

    return NextResponse.json({
      success: true,
      tab,
      counts: {
        cashQueue: cashQueueCount,
        paidHistory: paidCount,
        cancelledHistory: cancelledCount,
      },
      orders,
    })
  } catch (error) {
    console.error('Failed to fetch staff orders:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal memuat data pesanan POS.' },
      { status: 500 }
    )
  }
}
