import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

const UpdateTableSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .min(1, 'Nomor meja minimal 1 karakter.')
    .max(15, 'Nomor meja maksimal 15 karakter.')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Nomor meja hanya boleh berisi huruf, angka, tanda hubung (-), atau spasi.'),
  label: z.string().trim().max(100, 'Label meja maksimal 100 karakter.').optional().nullable(),
  isActive: z.boolean(),
})

const ToggleStatusSchema = z.object({
  isActive: z.boolean(),
})

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { id } = await params
  const table = await prisma.table.findUnique({
    where: { id },
    include: {
      _count: { select: { orders: true } },
    },
  })

  if (!table) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Meja tidak ditemukan.' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      ...table,
      totalOrders: table._count.orders,
    },
  })
}

export async function PUT(request: Request, { params }: RouteParams) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  let staff
  try {
    staff = await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { id } = await params
  const currentTable = await prisma.table.findUnique({ where: { id } })
  if (!currentTable) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Meja tidak ditemukan.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateTableSchema.safeParse(body)
  if (!parsed.success) {
    const firstErrorMessage = parsed.error.issues[0]?.message || 'Validasi data meja gagal.'
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: firstErrorMessage, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { tableNumber, label, isActive } = parsed.data
  const cleanNumber = tableNumber.trim().replace(/\s+/g, '-').toUpperCase()

  // Jika nomor meja diubah, pastikan nomor baru tidak konflik dengan meja lain
  if (cleanNumber !== currentTable.tableNumber) {
    const existing = await prisma.table.findUnique({
      where: { tableNumber: cleanNumber },
    })
    if (existing && existing.id !== id) {
      return NextResponse.json(
        { error: 'DUPLICATE_TABLE', message: `Nomor meja "${cleanNumber}" sudah digunakan.` },
        { status: 400 }
      )
    }
  }

  try {
    const updated = await prisma.table.update({
      where: { id },
      data: {
        tableNumber: cleanNumber,
        label: label || `Meja ${cleanNumber}`,
        qrSlug: `sela-table-${cleanNumber.toLowerCase()}`,
        isActive,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'UPDATE_TABLE',
        details: JSON.stringify({
          tableId: id,
          previous: {
            tableNumber: currentTable.tableNumber,
            label: currentTable.label,
            isActive: currentTable.isActive,
          },
          new: {
            tableNumber: updated.tableNumber,
            label: updated.label,
            isActive: updated.isActive,
          },
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update table:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui data meja.' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  let staff
  try {
    staff = await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { id } = await params
  const currentTable = await prisma.table.findUnique({ where: { id } })
  if (!currentTable) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Meja tidak ditemukan.' }, { status: 404 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = ToggleStatusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const updated = await prisma.table.update({
      where: { id },
      data: {
        isActive: parsed.data.isActive,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'TOGGLE_TABLE_STATUS',
        details: JSON.stringify({
          tableId: id,
          tableNumber: updated.tableNumber,
          isActive: updated.isActive,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to toggle table status:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengubah status aktif meja.' },
      { status: 500 }
    )
  }
}

