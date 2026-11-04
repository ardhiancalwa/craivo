import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { hashCredential } from '@/lib/server/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const CreateStaffSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(30, 'Username maksimal 30 karakter')
    .regex(/^[a-z0-9_-]+$/, 'Username hanya boleh huruf kecil, angka, garis bawah, dan tanda hubung'),
  displayName: z.string().trim().min(2, 'Nama tampilan minimal 2 karakter').max(50),
  role: z.enum(['CASHIER', 'BARISTA'], {
    errorMap: () => ({ message: 'Role harus berupa CASHIER atau BARISTA' }),
  }),
  pin: z
    .string()
    .trim()
    .min(4, 'PIN minimal 4 digit angka')
    .max(6, 'PIN maksimal 6 digit angka')
    .regex(/^\d{4,6}$/, 'PIN harus berupa 4 hingga 6 digit angka'),
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
    const staffList = await prisma.staffUser.findMany({
      where: {
        role: { in: ['CASHIER', 'BARISTA'] },
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [
        { role: 'asc' },
        { createdAt: 'desc' },
      ],
    })

    return NextResponse.json({ success: true, data: staffList })
  } catch (err) {
    console.error('Failed to get staff users:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal mengambil data staf.' },
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

  let adminUser
  try {
    adminUser = await requireStaffRole(['ADMIN'], request)
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
      { error: 'BAD_REQUEST', message: 'Format JSON payload tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = CreateStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Data tidak valid' },
      { status: 400 }
    )
  }

  const { username, displayName, role, pin } = parsed.data

  // Periksa apakah username sudah dipakai
  const existing = await prisma.staffUser.findUnique({
    where: { username: username.toLowerCase() },
  })

  if (existing) {
    return NextResponse.json(
      { error: 'USERNAME_TAKEN', message: 'Username sudah digunakan oleh akun lain.' },
      { status: 409 }
    )
  }

  try {
    const pinHash = await hashCredential(pin)

    const created = await prisma.staffUser.create({
      data: {
        username: username.toLowerCase(),
        displayName,
        role,
        pinHash,
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    })

    // Audit Log
    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: adminUser.id,
        action: 'STAFF_USER_CREATED',
        details: JSON.stringify({
          createdStaffId: created.id,
          username: created.username,
          role: created.role,
        }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, data: created }, { status: 201 })
  } catch (err) {
    console.error('Failed to create staff user:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal membuat akun staf baru.' },
      { status: 500 }
    )
  }
}

