import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Authoritative RBAC check: Only BARISTA, CASHIER, and ADMIN allowed for KDS
  try {
    await requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)
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

  try {
    // KITCHEN GATE POLICY (DEC-013):
    // Layar KDS Dapur HANYA menampilkan pesanan yang:
    // paymentStatus === 'PAID' AND orderStatus IN ('QUEUED', 'COOKING', 'READY')
    const rawOrders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        orderStatus: { in: ['QUEUED', 'COOKING', 'READY'] },
      },
      orderBy: [
        { paidAt: 'asc' }, // FIFO: pesanan yang paling awal dibayar diproses lebih dulu
      ],
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
      },
    })

    const orders = rawOrders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.table?.tableNumber || '-',
      customerNotes: order.customerNotes,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paidAt: order.paidAt?.toISOString() || null,
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      items: order.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        quantity: it.quantity,
        notes: it.notes,
        modifiers: it.modifiers.map((m) => ({
          id: m.id,
          name: m.nameSnapshot,
        })),
      })),
    }))

    return NextResponse.json({
      success: true,
      count: orders.length,
      orders,
    })
  } catch (error) {
    console.error('Failed to fetch KDS orders:', error)
    return NextResponse.json(
      { error: 'SERVER_ERROR', message: 'Gagal memuat antrean pesanan dapur.' },
      { status: 500 }
    )
  }
}

