import 'server-only'
import { cookies } from 'next/headers'
import prisma from '@/lib/server/db'
import { verifyStaffToken, STAFF_COOKIE_NAME, type StaffJWTPayload } from '@/lib/server/auth'
import type { StaffUser, StaffRole } from '@prisma/client'

export class AuthError extends Error {
  status: number
  code: string

  constructor(message: string, status: number = 401, code: string = 'UNAUTHORIZED') {
    super(message)
    this.name = 'AuthError'
    this.status = status
    this.code = code
  }
}

/**
 * Extracts and verifies the staff token from either the incoming request or next/headers cookies.
 */
export async function getAuthenticatedStaff(
  request?: Request
): Promise<StaffJWTPayload | null> {
  let token: string | undefined

  if (request) {
    // 1. Check Authorization Bearer header
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim()
    }

    // 2. Check Cookie header from request
    if (!token) {
      const cookieHeader = request.headers.get('cookie')
      if (cookieHeader) {
        const match = cookieHeader
          .split(';')
          .map((c) => c.trim())
          .find((c) => c.startsWith(`${STAFF_COOKIE_NAME}=`))
        if (match) {
          token = match.substring(`${STAFF_COOKIE_NAME}=`.length)
        }
      }
    }
  }

  // 3. Fallback to next/headers cookies() in Server Components / Route Handlers
  if (!token) {
    try {
      const cookieStore = await cookies()
      token = cookieStore.get(STAFF_COOKIE_NAME)?.value
    } catch {
      // Outside of Next request context (e.g. standalone test)
    }
  }

  if (!token) {
    return null
  }

  return verifyStaffToken(token)
}

/**
 * Authoritatively verifies staff session against the database:
 * 1. Validates JWT signature and expiration.
 * 2. Checks StaffUser in database to guarantee account is ACTIVE (deactivated staff blocked immediately).
 * 3. Enforces that staff user possesses one of the allowed roles.
 */
export async function requireStaffRole(
  allowedRoles: StaffRole[],
  request?: Request
): Promise<StaffUser> {
  const payload = await getAuthenticatedStaff(request)

  if (!payload) {
    throw new AuthError(
      'Sesi tidak valid atau telah berakhir. Silakan login kembali.',
      401,
      'UNAUTHORIZED'
    )
  }

  // Authoritative DB check: verify user exists and is actively employed
  const staff = await prisma.staffUser.findUnique({
    where: { id: payload.sub },
  })

  if (!staff) {
    throw new AuthError(
      'Identitas staf tidak ditemukan pada sistem.',
      401,
      'USER_NOT_FOUND'
    )
  }

  if (!staff.isActive) {
    throw new AuthError(
      'Akun staf dinonaktifkan oleh manajemen. Seluruh akses mutasi dibatalkan.',
      403,
      'ACCOUNT_DEACTIVATED'
    )
  }

  // RBAC enforcement: Check if staff's actual DB role is permitted
  if (!allowedRoles.includes(staff.role)) {
    throw new AuthError(
      `Akses ditolak: Peran ${staff.role} tidak memiliki wewenang untuk tindakan ini.`,
      403,
      'FORBIDDEN'
    )
  }

  return staff
}

