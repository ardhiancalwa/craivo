import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

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

  const currentItem = await prisma.menuItem.findUnique({
    where: { id: menuId },
  })

  if (!currentItem) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Menu tidak ditemukan.' }, { status: 404 })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Soft delete: isArchived true, isAvailable false, deletedAt timestamp
      // Tidak menghapus baris untuk menjaga keutuhan riwayat order & struk
      const res = await tx.menuItem.update({
        where: { id: menuId },
        data: {
          isArchived: true,
          isAvailable: false,
          deletedAt: new Date(),
        },
      })

      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
      await tx.auditLog.create({
        data: {
          staffUserId: staff.id,
          action: 'ARCHIVE_MENU_ITEM',
          details: JSON.stringify({
            menuId,
            menuName: currentItem.name,
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
      payload: { menuId, isAvailable: false, isArchived: true },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to archive menu item:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengarsipkan menu.' },
      { status: 500 }
    )
  }
}

