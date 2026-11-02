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

const TogglePopularSchema = z.object({
  isPopular: z.boolean(),
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

  const { id: menuId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = TogglePopularSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const currentItem = await prisma.menuItem.findUnique({
    where: { id: menuId },
  })

  if (!currentItem) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Menu tidak ditemukan.' }, { status: 404 })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.menuItem.update({
        where: { id: menuId },
        data: {
          isPopular: parsed.data.isPopular,
        },
      })

      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
      await tx.auditLog.create({
        data: {
          staffUserId: staff.id,
          action: 'TOGGLE_BEST_SELLER',
          details: JSON.stringify({
            menuId,
            menuName: currentItem.name,
            isPopular: parsed.data.isPopular,
            actor: staff.username,
          }),
          ipAddress,
        },
      })

      return res
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MENU',
      aggregateId: menuId,
      eventType: 'STOCK_TOGGLED',
      payload: { menuId, isPopular: parsed.data.isPopular },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to toggle popular status:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengubah status Best Seller.' },
      { status: 500 }
    )
  }
}

