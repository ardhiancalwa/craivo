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

const ToggleStockSchema = z.object({
  isAvailable: z.boolean(),
})

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

  const parsed = ToggleStockSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const option = await prisma.modifierOption.findUnique({
    where: { id: optionId },
  })

  if (!option) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Opsi modifier tidak ditemukan.' }, { status: 404 })
  }

  try {
    const updated = await prisma.modifierOption.update({
      where: { id: optionId },
      data: { isAvailable: parsed.data.isAvailable },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'TOGGLE_MODIFIER_STOCK',
        details: JSON.stringify({
          optionId,
          name: option.name,
          isAvailable: parsed.data.isAvailable,
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
      payload: { optionId, isAvailable: parsed.data.isAvailable },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to toggle modifier stock:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengubah stok opsi modifier.' },
      { status: 500 }
    )
  }
}

