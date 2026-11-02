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

const UpdateCategorySchema = z.object({
  name: z.string().trim().min(2, 'Nama kategori minimal 2 karakter').max(50),
  slug: z.string().trim().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug hanya boleh huruf kecil, angka, dan strip'),
  sortOrder: z.number().int().default(0),
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

  const { id: categoryId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const existing = await prisma.category.findUnique({
      where: { id: categoryId },
    })

    if (!existing) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Kategori tidak ditemukan.' }, { status: 404 })
    }

    // Cek duplikasi slug/name pada kategori lain
    const duplicate = await prisma.category.findFirst({
      where: {
        id: { not: categoryId },
        OR: [{ name: data.name }, { slug: data.slug }],
      },
    })

    if (duplicate) {
      return NextResponse.json(
        { error: 'CONFLICT', message: 'Nama atau slug kategori sudah digunakan kategori lain.' },
        { status: 409 }
      )
    }

    const updated = await prisma.category.update({
      where: { id: categoryId },
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
        action: 'UPDATE_CATEGORY',
        details: JSON.stringify({
          categoryId,
          actor: staff.username,
          changes: {
            name: { old: existing.name, new: updated.name },
            sortOrder: { old: existing.sortOrder, new: updated.sortOrder },
          },
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'CATEGORY',
      aggregateId: categoryId,
      eventType: 'STOCK_TOGGLED',
      payload: { categoryId, action: 'UPDATED' },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update category:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui kategori.' },
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

  const { id: categoryId } = await params

  try {
    const countItems = await prisma.menuItem.count({
      where: { categoryId, isArchived: false },
    })

    if (countItems > 0) {
      return NextResponse.json(
        {
          error: 'CATEGORY_IN_USE',
          message: `Kategori tidak dapat dihapus karena masih memuat ${countItems} menu aktif. Silakan pindahkan atau arsipkan menu terlebih dahulu.`,
        },
        { status: 400 }
      )
    }

    await prisma.category.delete({
      where: { id: categoryId },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'DELETE_CATEGORY',
        details: JSON.stringify({ categoryId, actor: staff.username }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, message: 'Kategori berhasil dihapus.' })
  } catch (err) {
    console.error('Failed to delete category:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal menghapus kategori.' },
      { status: 500 }
    )
  }
}

