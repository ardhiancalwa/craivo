import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CategorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(50),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  sortOrder: z.number().int().default(0),
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

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: {
        select: {
          items: {
            where: { isArchived: false },
          },
        },
      },
    },
  })

  return NextResponse.json({
    success: true,
    data: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      sortOrder: c.sortOrder,
      activeItemCount: c._count.items,
    })),
  })
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

  const parsed = CategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const existing = await prisma.category.findFirst({
      where: {
        OR: [{ name: data.name }, { slug: data.slug }],
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'CONFLICT', message: 'Nama atau slug kategori sudah digunakan.' },
        { status: 409 }
      )
    }

    const created = await prisma.category.create({
      data: {
        name: data.name,
        slug: data.slug,
        sortOrder: data.sortOrder,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'CREATE_CATEGORY',
        details: JSON.stringify({
          categoryId: created.id,
          name: created.name,
          slug: created.slug,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'CATEGORY',
      aggregateId: created.id,
      eventType: 'STOCK_TOGGLED',
      payload: { categoryId: created.id, action: 'CREATED' },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    console.error('Failed to create category:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal membuat kategori baru.' },
      { status: 500 }
    )
  }
}

