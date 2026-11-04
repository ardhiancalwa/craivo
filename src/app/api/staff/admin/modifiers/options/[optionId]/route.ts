import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ optionId: string }>
}

export const dynamic = 'force-dynamic'

const UpdateOptionSchema = z.object({
  name: z.string().trim().min(1, 'Nama opsi minimal 1 karakter').max(50),
  price: z.number().int().min(0, 'Harga opsi tidak boleh negatif'),
  isAvailable: z.boolean().optional(),
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

  const { optionId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateOptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const existing = await prisma.modifierOption.findUnique({
      where: { id: optionId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Opsi kustomisasi tidak ditemukan.' }, { status: 404 })
    }

    const updated = await prisma.modifierOption.update({
      where: { id: optionId },
      data: {
        name: data.name,
        price: data.price,
        ...(typeof data.isAvailable === 'boolean' ? { isAvailable: data.isAvailable } : {}),
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'UPDATE_MODIFIER_OPTION',
        details: JSON.stringify({
          optionId: updated.id,
          name: updated.name,
          price: updated.price,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER_OPTION',
      aggregateId: updated.id,
      eventType: 'STOCK_TOGGLED',
      payload: { optionId: updated.id, name: updated.name, price: updated.price, isAvailable: updated.isAvailable },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update modifier option:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui opsi kustomisasi.' },
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

  const { optionId } = await params

  try {
    const existing = await prisma.modifierOption.findUnique({
      where: { id: optionId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Opsi kustomisasi tidak ditemukan.' }, { status: 404 })
    }

    await prisma.modifierOption.delete({
      where: { id: optionId },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'DELETE_MODIFIER_OPTION',
        details: JSON.stringify({
          optionId,
          name: existing.name,
          groupId: existing.groupId,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER_OPTION',
      aggregateId: optionId,
      eventType: 'STOCK_TOGGLED',
      payload: { optionId, action: 'DELETED' },
    })

    return NextResponse.json({ success: true, message: 'Opsi kustomisasi berhasil dihapus.' })
  } catch (err) {
    console.error('Failed to delete modifier option:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal menghapus opsi kustomisasi.' },
      { status: 500 }
    )
  }
}

