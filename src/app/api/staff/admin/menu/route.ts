import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateMenuItemSchema = z.object({
  name: z.string().trim().min(3, 'Nama menu minimal 3 karakter').max(100),
  description: z.string().trim().min(10, 'Deskripsi menu minimal 10 karakter').max(500),
  price: z.number().int().min(1000, 'Harga menu minimal Rp1.000'),
  categoryId: z.string().min(1, 'Kategori menu wajib dipilih'),
  image: z.string().trim().optional().nullable(),
  isPopular: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  tagIds: z.array(z.string()).default([]),
  modifierGroupIds: z.array(z.string()).default([]),
})

export async function GET(request: Request) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('includeArchived') === 'true'
  const categoryId = searchParams.get('categoryId') || undefined

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}
  if (!includeArchived) {
    where.isArchived = false
  }
  if (categoryId && categoryId !== 'all') {
    where.categoryId = categoryId
  }

  try {
    const items = await prisma.menuItem.findMany({
      where,
      include: {
        category: true,
        tags: {
          include: {
            tag: true,
          },
        },
        modifierGroups: {
          include: {
            group: true,
          },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    })

    const transformed = items.map((it) => ({
      id: it.id,
      name: it.name,
      description: it.description,
      price: it.price,
      image: it.image,
      categoryId: it.categoryId,
      categoryName: it.category.name,
      isAvailable: it.isAvailable,
      isPopular: it.isPopular,
      soldCount: it.soldCount,
      isArchived: it.isArchived,
      sortOrder: it.sortOrder,
      tags: it.tags.map((t) => ({ id: t.tag.id, name: t.tag.name, dimension: t.tag.dimension })),
      modifierGroupIds: it.modifierGroups.map((mg) => mg.groupId),
    }))

    return NextResponse.json({ success: true, data: transformed })
  } catch (err) {
    console.error('Failed to fetch menu items:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memuat katalog menu.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
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

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = CreateMenuItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const created = await prisma.$transaction(async (tx) => {
      const newItem = await tx.menuItem.create({
        data: {
          name: data.name,
          description: data.description,
          price: data.price,
          categoryId: data.categoryId,
          image: data.image || null,
          isPopular: data.isPopular,
          sortOrder: data.sortOrder,
          isAvailable: true,
          isArchived: false,
        },
      })

      // Hubungkan Tags
      if (data.tagIds.length > 0) {
        await tx.menuItemTag.createMany({
          data: data.tagIds.map((tagId) => ({
            menuItemId: newItem.id,
            tagId,
          })),
        })
      }

      // Hubungkan Modifier Groups
      if (data.modifierGroupIds.length > 0) {
        await tx.menuItemModifierGroup.createMany({
          data: data.modifierGroupIds.map((groupId) => ({
            menuItemId: newItem.id,
            groupId,
          })),
        })
      }

      const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
      await tx.auditLog.create({
        data: {
          staffUserId: staff.id,
          action: 'CREATE_MENU_ITEM',
          details: JSON.stringify({
            menuId: newItem.id,
            name: newItem.name,
            price: newItem.price,
            categoryId: newItem.categoryId,
            actor: staff.username,
          }),
          ipAddress,
        },
      })

      return newItem
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MENU',
      aggregateId: created.id,
      eventType: 'STOCK_TOGGLED',
      payload: { menuId: created.id, isAvailable: true },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err) {
    console.error('Failed to create menu item:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal membuat menu baru.' },
      { status: 500 }
    )
  }
}
