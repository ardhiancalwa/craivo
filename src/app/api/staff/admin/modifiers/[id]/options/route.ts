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

const CreateOptionSchema = z.object({
  name: z.string().trim().min(1, 'Nama opsi minimal 1 karakter').max(50),
  price: z.number().int().min(0, 'Harga opsi tidak boleh negatif').default(0),
  isAvailable: z.boolean().default(true),
})

export async function POST(request: Request, { params }: RouteParams) {
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

  const { id: groupId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = CreateOptionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const data = parsed.data

  try {
    const group = await prisma.modifierGroup.findUnique({
      where: { id: groupId },
    })

    if (!group) {
      return NextResponse.json({ error: 'NOT_FOUND', message: 'Grup modifier tidak ditemukan.' }, { status: 404 })
    }

    const created = await prisma.modifierOption.create({
      data: {
        groupId,
        name: data.name,
        price: data.price,
        isAvailable: data.isAvailable,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'CREATE_MODIFIER_OPTION',
        details: JSON.stringify({
          groupId,
          optionId: created.id,
          name: created.name,
          price: created.price,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    await publishEvent({
      channel: 'CATALOG',
      aggregateType: 'MODIFIER_OPTION',
      aggregateId: created.id,
      eventType: 'STOCK_TOGGLED',
      payload: { optionId: created.id, isAvailable: created.isAvailable },
    })

    return NextResponse.json({ success: true, data: created })
  } catch (err) {
    console.error('Failed to create modifier option:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal membuat opsi modifier.' },
      { status: 500 }
    )
  }
}

