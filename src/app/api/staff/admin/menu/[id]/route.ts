import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { cleanupOldImage } from '@/lib/server/storage-service'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

const UpdateMenuItemSchema = z.object({
  name: z.string().trim().min(3, 'Nama menu minimal 3 karakter').max(100),
  description: z.string().trim().min(10, 'Deskripsi menu minimal 10 karakter').max(500),
  price: z.number().int().min(1000, 'Harga menu minimal Rp1.000'),
  categoryId: z.string().min(1, 'Kategori menu wajib dipilih'),
  image: z.string().trim().optional().nullable(),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  tagIds: z.array(z.string()).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
  modifierPriceOverrides: z.record(z.string(), z.number().int().min(0)).optional().default({}),
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

  const { id: menuId } = await params

  const item = await prisma.menuItem.findUnique({
    where: { id: menuId },
    include: {
      tags: { include: { tag: true } },
      modifierGroups: true,
    },
  })

  if (!item) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Menu tidak ditemukan.' }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    data: {
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      categoryId: item.categoryId,
      image: item.image,
      isAvailable: item.isAvailable,
      isPopular: item.isPopular,
      sortOrder: item.sortOrder,
      tagIds: item.tags.map((t) => t.tagId),
      modifierGroupIds: item.modifierGroups.map((mg) => mg.groupId),
      modifierPriceOverrides: (item.modifierPriceOverrides as Record<string, number> | null) || {},
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

  const parsed = UpdateMenuItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  const currentItem = await prisma.menuItem.findUnique({
    where: { id: menuId },
  })

  if (!currentItem) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Menu tidak ditemukan.' }, { status: 404 })
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Update MenuItem
      const res = await tx.menuItem.update({
        where: { id: menuId },
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          categoryId: data.categoryId,
          image: data.image || null,
          isPopular: data.isPopular,
          sortOrder: data.sortOrder,
          modifierPriceOverrides: data.modifierPriceOverrides || {},
        },
      })

      // 2. Sync Tags
      await tx.menuItemTag.deleteMany({ where: { menuItemId: menuId } })
      if (data.tagIds.length > 0) {
        await tx.menuItemTag.createMany({
          data: data.tagIds.map((tagId) => ({
            menuItemId: menuId,
            tagId,
          })),
        })
      }

      // 3. Sync Modifier Groups
      await tx.menuItemModifierGroup.deleteMany({ where: { menuItemId: menuId } })
      if (data.modifierGroupIds.length > 0) {
        await tx.menuItemModifierGroup.createMany({
          data: data.modifierGroupIds.map((groupId) => ({
            menuItemId: menuId,
            groupId,
          })),
        })
      }

      // 4. Audit Log
      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
      await tx.auditLog.create({
        data: {
          staffUserId: staff.id,
          action: 'UPDATE_MENU_ITEM',
          details: JSON.stringify({
            menuId,
            actor: staff.username,
            changes: {
              name: { old: currentItem.name, new: data.name },
              price: { old: currentItem.price, new: data.price },
              image: { old: currentItem.image, new: data.image },
            },
          }),
          ipAddress,
        },
      })

      return res
    })

    // Bersihkan foto lama jika diganti
    if (currentItem.image && currentItem.image !== data.image) {
      await cleanupOldImage(currentItem.image)
    }

    // Publish realtime event
    if (currentItem.price !== data.price) {
      await publishEvent({
        channel: 'CATALOG',
        aggregateType: 'MENU',
        aggregateId: menuId,
        eventType: 'PRICE_CHANGED',
        payload: { menuId, oldPrice: currentItem.price, newPrice: data.price },
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update menu item:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui menu.' },
      { status: 500 }
    )
  }
}

