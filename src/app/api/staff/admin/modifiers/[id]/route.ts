import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

const UpdateModifierGroupSchema = z.object({
  name: z.string().trim().min(2, 'Nama grup minimal 2 karakter').max(50),
  isRequired: z.boolean(),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
})

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

  const { id: groupId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateModifierGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const existing = await prisma.modifierGroup.findUnique({
      where: { id: groupId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Grup kustomisasi tidak ditemukan.' }, { status: 404 })
    }

    const updated = await prisma.modifierGroup.update({
      where: { id: groupId },
      data: {
        name: data.name,
        isRequired: data.isRequired,
        minSelect: data.minSelect,
        maxSelect: data.maxSelect,
      },
      include: {
        options: {
          orderBy: { price: 'asc' },
        },
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'UPDATE_MODIFIER_GROUP',
        details: JSON.stringify({
          groupId: updated.id,
          name: updated.name,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER',
      aggregateId: updated.id,
      eventType: 'STOCK_TOGGLED',
      payload: { groupId: updated.id, action: 'UPDATED' },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update modifier group:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui grup kustomisasi.' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
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

  const { id: groupId } = await params

  try {
    const existing = await prisma.modifierGroup.findUnique({
      where: { id: groupId },
      include: {
        _count: {
          select: { menuItemMap: true },
        },
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Grup kustomisasi tidak ditemukan.' }, { status: 404 })
    }

    await prisma.modifierGroup.delete({
      where: { id: groupId },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'DELETE_MODIFIER_GROUP',
        details: JSON.stringify({
          groupId,
          name: existing.name,
          attachedMenuCount: existing._count.menuItemMap,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER',
      aggregateId: groupId,
      eventType: 'STOCK_TOGGLED',
      payload: { groupId, action: 'DELETED' },
    })

    return NextResponse.json({ success: true, message: 'Grup kustomisasi berhasil dihapus.' })
  } catch (err) {
    console.error('Failed to delete modifier group:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal menghapus grup kustomisasi.' },
      { status: 500 }
    )
  }
}

