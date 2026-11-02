import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { resolveTableTargetUrl } from '@/lib/server/qr-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateTableSchema = z.object({
  tableNumber: z
    .string()
    .trim()
    .min(1, 'Nomor meja minimal 1 karakter.')
    .max(15, 'Nomor meja maksimal 15 karakter.')
    .regex(/^[a-zA-Z0-9_\-\s]+$/, 'Nomor meja hanya boleh berisi huruf, angka, tanda hubung (-), atau spasi.'),
  label: z.string().trim().max(100, 'Label meja maksimal 100 karakter.').optional().nullable(),
  isActive: z.boolean().default(true),
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

  try {
    const [tables, config] = await Promise.all([
      prisma.table.findMany({
        orderBy: { tableNumber: 'asc' },
        include: {
          _count: {
            select: { orders: true },
          },
        },
      }),
      prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } }),
    ])

    // Hitung active orders (QUEUED, COOKING, READY) per meja
    const activeOrders = await prisma.order.groupBy({
      by: ['tableId'],
      where: {
        orderStatus: { in: ['QUEUED', 'COOKING', 'READY'] },
      },
      _count: { id: true },
    })

    const activeOrderMap = new Map<string, number>()
    for (const ao of activeOrders) {
      activeOrderMap.set(ao.tableId, ao._count.id)
    }

    const sampleTableNumber = tables[0]?.tableNumber || '01'
    const stagingStatus = await resolveTableTargetUrl(sampleTableNumber, 'staging')
    const productionStatus = await resolveTableTargetUrl(sampleTableNumber, 'production')

    const data = tables.map((t) => ({
      id: t.id,
      tableNumber: t.tableNumber,
      label: t.label || `Meja ${t.tableNumber}`,
      qrSlug: t.qrSlug,
      isActive: t.isActive,
      totalOrders: t._count.orders,
      activeOrders: activeOrderMap.get(t.id) || 0,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }))

    return NextResponse.json({
      success: true,
      data: {
        tables: data,
        environment: {
          stagingUrl: stagingStatus.baseUrl,
          productionDomain: config?.productionDomain || null,
          isProductionConfigured: productionStatus.status === 'READY',
          staging: {
            baseUrl: stagingStatus.baseUrl,
            status: stagingStatus.status,
          },
          production: {
            baseUrl: productionStatus.baseUrl,
            status: productionStatus.status,
            reason: productionStatus.reason,
            configuredDomain: config?.productionDomain || null,
          },
        },
      },
    })
  } catch (err) {
    console.error('Failed to get tables list:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memuat daftar meja.' },
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

  const parsed = CreateTableSchema.safeParse(body)
  if (!parsed.success) {
    const firstErrorMessage = parsed.error.issues[0]?.message || 'Validasi data meja gagal.'
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: firstErrorMessage, details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { tableNumber, label, isActive } = parsed.data
  const cleanNumber = tableNumber.trim().replace(/\s+/g, '-').toUpperCase()

  // Cek duplikasi nomor meja
  const existing = await prisma.table.findUnique({
    where: { tableNumber: cleanNumber },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'DUPLICATE_TABLE', message: `Nomor meja "${cleanNumber}" sudah digunakan.` },
      { status: 400 }
    )
  }

  try {
    const qrSlug = `sela-table-${cleanNumber.toLowerCase()}`
    const newTable = await prisma.table.create({
      data: {
        tableNumber: cleanNumber,
        label: label || `Meja ${cleanNumber}`,
        qrSlug,
        isActive,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'CREATE_TABLE',
        details: JSON.stringify({
          tableId: newTable.id,
          tableNumber: newTable.tableNumber,
          label: newTable.label,
          actor: staff.username,
        }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, data: newTable }, { status: 201 })
  } catch (err) {
    console.error('Failed to create table:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal membuat meja baru.' },
      { status: 500 }
    )
  }
}
