import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { hashCredential } from '@/lib/server/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

const UpdateStaffSchema = z.object({
  displayName: z.string().trim().min(2, 'Nama tampilan minimal 2 karakter').max(50).optional(),
  role: z.enum(['CASHIER', 'BARISTA']).optional(),
  isActive: z.boolean().optional(),
  pin: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, 'PIN harus berupa 4 hingga 6 digit angka')
    .optional(),
  unlockLockout: z.boolean().optional(),
})

export async function PATCH(request: Request, { params }: RouteParams) {
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

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Format JSON payload tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdateStaffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Data tidak valid' },
      { status: 400 }
    )
  }

  const target = await prisma.staffUser.findUnique({
    where: { id },
  })

  if (!target) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Akun staf tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (target.role === 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Manajemen akun Admin tidak diperkenankan melalui menu ini.' },
      { status: 403 }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {}

  if (parsed.data.displayName !== undefined) {
    updateData.displayName = parsed.data.displayName
  }

  if (parsed.data.role !== undefined) {
    updateData.role = parsed.data.role
  }

  if (parsed.data.isActive !== undefined) {
    updateData.isActive = parsed.data.isActive
  }

  if (parsed.data.pin) {
    updateData.pinHash = await hashCredential(parsed.data.pin)
  }

  if (parsed.data.unlockLockout) {
    updateData.failedLoginAttempts = 0
    updateData.lockedUntil = null
  }

  try {
    const updated = await prisma.staffUser.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        failedLoginAttempts: true,
        lockedUntil: true,
        updatedAt: true,
      },
    })

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: adminUser.id,
        action: 'STAFF_USER_UPDATED',
        details: JSON.stringify({
          targetStaffId: updated.id,
          username: updated.username,
          updatedFields: Object.keys(updateData),
        }),
        ipAddress,
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update staff user:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal memperbarui akun staf.' },
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

  let adminUser
  try {
    adminUser = await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { id } = await params

  const target = await prisma.staffUser.findUnique({
    where: { id },
  })

  if (!target) {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Akun staf tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (target.role === 'ADMIN') {
    return NextResponse.json(
      { error: 'FORBIDDEN', message: 'Tidak dapat menghapus akun Admin.' },
      { status: 403 }
    )
  }

  try {
    // Soft deactivation jika memiliki riwayat transaksi/audit
    await prisma.staffUser.update({
      where: { id },
      data: { isActive: false },
    })

    const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'
    await prisma.auditLog.create({
      data: {
        staffUserId: adminUser.id,
        action: 'STAFF_USER_DEACTIVATED',
        details: JSON.stringify({ targetStaffId: id, username: target.username }),
        ipAddress,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Akun staf berhasil dinonaktifkan.',
    })
  } catch (err) {
    console.error('Failed to deactivate staff user:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal menghapus/menonaktifkan akun staf.' },
      { status: 500 }
    )
  }
}

