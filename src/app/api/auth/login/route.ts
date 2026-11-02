import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import {
  signStaffToken,
  verifyCredential,
  STAFF_COOKIE_NAME,
} from '@/lib/server/auth'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { checkStaffLoginRateLimit } from '@/lib/server/rate-limiter'
import { StaffLoginInputSchema } from '@/validation/schemas'

export async function POST(request: Request) {
  // 1. CSRF Origin Verification
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  // 2. Input Validation
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Format JSON payload tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = StaffLoginInputSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const { username, pinOrPassword } = parsed.data
  const ipAddress = request.headers.get('x-forwarded-for') || '127.0.0.1'

  // 3. Rate Limit per IP lintas instance (Mencegah brute force credential stuffing)
  const rateLimitResult = await checkStaffLoginRateLimit(ipAddress)
  if (!rateLimitResult.allowed) {
    const res = NextResponse.json(
      {
        error: 'TOO_MANY_REQUESTS',
        message: rateLimitResult.message || 'Terlalu banyak percobaan login. Silakan tunggu.',
      },
      { status: 429 }
    )
    if (rateLimitResult.resetSeconds) {
      res.headers.set('Retry-After', String(rateLimitResult.resetSeconds))
    }
    return res
  }

  // 4. Find User & Check Lockout
  const staff = await prisma.staffUser.findUnique({
    where: { username: username.toLowerCase().trim() },
  })

  if (!staff) {
    // Audit attempt without leaking existence of username
    await prisma.auditLog.create({
      data: {
        action: 'STAFF_LOGIN_FAILED',
        details: JSON.stringify({ attemptedUsername: username, reason: 'INVALID_CREDENTIALS' }),
        ipAddress,
      },
    })
    return NextResponse.json(
      { error: 'INVALID_CREDENTIALS', message: 'Username atau PIN/Password tidak sesuai.' },
      { status: 401 }
    )
  }

  // 4. Check if account is deactivated
  if (!staff.isActive) {
    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: 'STAFF_LOGIN_DEACTIVATED',
        details: JSON.stringify({ reason: 'ACCOUNT_DEACTIVATED' }),
        ipAddress,
      },
    })
    return NextResponse.json(
      { error: 'ACCOUNT_DEACTIVATED', message: 'Akun dinonaktifkan oleh manajemen.' },
      { status: 403 }
    )
  }

  // 5. Check Persistent Lockout
  const now = new Date()
  if (staff.lockedUntil && staff.lockedUntil > now) {
    const minutesLeft = Math.ceil((staff.lockedUntil.getTime() - now.getTime()) / 60000)
    return NextResponse.json(
      {
        error: 'ACCOUNT_LOCKED',
        message: `Akun terkunci sementara karena 5 kali percobaan gagal. Coba lagi dalam ${minutesLeft} menit.`,
      },
      { status: 429 }
    )
  }

  // 6. Verify Credentials against PasswordHash or PinHash
  let isValid = false
  if (staff.role === 'ADMIN' && staff.passwordHash) {
    isValid = await verifyCredential(pinOrPassword, staff.passwordHash)
  }
  if (!isValid && staff.pinHash) {
    isValid = await verifyCredential(pinOrPassword, staff.pinHash)
  }

  if (!isValid) {
    const failedCount = staff.failedLoginAttempts + 1
    const shouldLock = failedCount >= 5
    const lockDuration = 15 * 60 * 1000 // 15 minutes
    const lockedUntil = shouldLock ? new Date(now.getTime() + lockDuration) : null

    await prisma.staffUser.update({
      where: { id: staff.id },
      data: {
        failedLoginAttempts: failedCount,
        lockedUntil,
      },
    })

    await prisma.auditLog.create({
      data: {
        staffUserId: staff.id,
        action: shouldLock ? 'STAFF_ACCOUNT_LOCKED' : 'STAFF_LOGIN_FAILED',
        details: JSON.stringify({ failedAttempts: failedCount, locked: shouldLock }),
        ipAddress,
      },
    })

    if (shouldLock) {
      return NextResponse.json(
        {
          error: 'ACCOUNT_LOCKED',
          message: 'Akun terkunci sementara selama 15 menit karena 5 kali percobaan gagal.',
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'INVALID_CREDENTIALS', message: 'Username atau PIN/Password tidak sesuai.' },
      { status: 401 }
    )
  }

  // 7. Login Success: Reset lockout & attempts
  await prisma.staffUser.update({
    where: { id: staff.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  })

  // 8. Sign JWT Token
  const token = await signStaffToken({
    sub: staff.id,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role,
  })

  // 9. Audit Success
  await prisma.auditLog.create({
    data: {
      staffUserId: staff.id,
      action: 'STAFF_LOGIN_SUCCESS',
      details: JSON.stringify({ role: staff.role }),
      ipAddress,
    },
  })

  // 10. Issue HTTP-Only Cookie
  const response = NextResponse.json({
    success: true,
    user: {
      id: staff.id,
      username: staff.username,
      displayName: staff.displayName,
      role: staff.role,
    },
  })

  response.cookies.set({
    name: STAFF_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 8 * 60 * 60, // 8 hours
  })

  return response
}

