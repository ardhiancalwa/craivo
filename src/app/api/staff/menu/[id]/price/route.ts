import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UpdatePriceSchema = z.object({
  price: z.number().int().positive('Harga harus berupa bilangan bulat positif'),
})

export async function PATCH(request: Request, { params }: RouteParams) {
  // 1. CSRF Origin Verification
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  // 2. Authoritative Server-Side RBAC Check: STRICTLY ADMIN ONLY
  let staff
  try {
    staff = await requireStaffRole(['ADMIN'], request)
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

  const { id: menuId } = await params

  // 3. Input validation
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Format JSON payload tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdatePriceSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.format() },
      { status: 400 }
    )
  }

  // 4. Update Price & Audit
  const menu = await prisma.menuItem.findUnique({
    where: { id: menuId },
  })

  if (!menu) {
    return NextResponse.json(
      { error: 'MENU_NOT_FOUND', message: 'Menu tidak ditemukan.' },
      { status: 404 }
    )
  }

  const oldPrice = menu.price
  const updatedMenu = await prisma.menuItem.update({
    where: { id: menuId },
    data: { price: parsed.data.price },
  })

  await prisma.auditLog.create({
    data: {
      staffUserId: staff.id,
      action: 'UPDATE_MENU_PRICE',
      details: JSON.stringify({
        menuId: menu.id,
        menuName: menu.name,
        oldPrice,
        newPrice: parsed.data.price,
      }),
      ipAddress: request.headers.get('x-forwarded-for') || '127.0.0.1',
    },
  })

  // Siarkan event pembaharuan harga ke kanal publik CATALOG
  await publishEvent({
    channel: 'CATALOG',
    aggregateType: 'MENU',
    aggregateId: menu.id,
    eventType: 'PRICE_CHANGED',
    payload: {
      menuItemId: menu.id,
      menuName: menu.name,
      oldPrice,
      newPrice: parsed.data.price,
      updatedAt: new Date().toISOString(),
    },
  })

  return NextResponse.json({
    success: true,
    message: 'Harga menu berhasil diperbarui oleh Administrator.',
    menuItem: {
      id: updatedMenu.id,
      name: updatedMenu.name,
      price: updatedMenu.price,
    },
  })
}

