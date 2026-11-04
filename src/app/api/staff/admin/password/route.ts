import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { verifyCredential, hashCredential } from '@/lib/server/auth'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Password saat ini wajib diisi'),
    newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
    confirmNewPassword: z.string().min(1, 'Konfirmasi password baru wajib diisi'),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: 'Konfirmasi password baru tidak cocok dengan password baru',
    path: ['confirmNewPassword'],
  })

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

  const parsed = ChangePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'VALIDATION_ERROR',
        message: parsed.error.issues[0]?.message || 'Data tidak valid.',
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const { currentPassword, newPassword } = parsed.data

  const target = await prisma.staffUser.findUnique({
    where: { id: adminUser.id },
  })

  if (!target || target.role !== 'ADMIN') {
    return NextResponse.json(
      { error: 'NOT_FOUND', message: 'Akun Admin tidak ditemukan.' },
      { status: 404 }
    )
  }

  if (!target.passwordHash) {
    return NextResponse.json(
      { error: 'INVALID_AUTH_METHOD', message: 'Akun ini tidak menggunakan otentikasi password.' },
      { status: 400 }
    )
  }

  // Verifikasi password saat ini
  const isMatch = await verifyCredential(currentPassword, target.passwordHash)
  if (!isMatch) {
    return NextResponse.json(
      { error: 'INCORRECT_PASSWORD', message: 'Password saat ini yang Anda masukkan salah.' },
      { status: 400 }
    )
  }

  // Hash password baru
  const newHash = await hashCredential(newPassword)

  // Update password & catat audit log
  const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

  await prisma.$transaction([
    prisma.staffUser.update({
      where: { id: target.id },
      data: {
        passwordHash: newHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    prisma.auditLog.create({
      data: {
        staffUserId: target.id,
        action: 'ADMIN_PASSWORD_CHANGED',
        details: JSON.stringify({
          username: target.username,
          timestamp: new Date().toISOString(),
        }),
        ipAddress,
      },
    }),
  ])

  return NextResponse.json({
    success: true,
    message: 'Password akun Admin berhasil diperbarui.',
  })
}

