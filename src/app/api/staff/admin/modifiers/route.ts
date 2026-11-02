import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { publishEvent } from '@/lib/server/realtime-bus'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateModifierGroupSchema = z.object({
  name: z.string().trim().min(2, 'Nama grup minimal 2 karakter').max(50),
  isRequired: z.boolean().default(false),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).default(1),
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

  const groups = await prisma.modifierGroup.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      options: {
        orderBy: { price: 'asc' },
      },
      _count: {
        select: {
          menuItemMap: true,
        },
      },
    },
  })

  return NextResponse.json({
    success: true,
    data: groups.map((g) => ({
      id: g.id,
      name: g.name,
      isRequired: g.isRequired,
      minSelect: g.minSelect,
      maxSelect: g.maxSelect,
      attachedMenuCount: g._count.menuItemMap,
      options: g.options.map((opt) => ({
        id: opt.id,
        name: opt.name,
        price: opt.price,
        isAvailable: opt.isAvailable,
      })),
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

  const parsed = CreateModifierGroupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const created = await prisma.modifierGroup.create({
      data: {
        name: data.name,
        isRequired: data.isRequired,
        minSelect: data.minSelect,
        maxSelect: data.maxSelect,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'CREATE_MODIFIER_GROUP',
        details: JSON.stringify({
          groupId: created.id,
          name: created.name,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER',
      aggregateId: created.id,
      eventType: 'STOCK_TOGGLED',
      payload: { groupId: created.id, action: 'CREATED' },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    console.error('Failed to create modifier group:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal membuat grup kustomisasi.' },
      { status: 500 }
    )
  }
}

