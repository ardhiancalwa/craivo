import 'server-only'
import crypto from 'node:crypto'
import { prisma } from './db'

export const GUEST_SESSION_COOKIE = 'cravio_guest'
export const TABLE_COOKIE = 'cravio_table'
export const GUEST_SESSION_MAX_AGE = 12 * 60 * 60 // 12 jam (dalam detik)

export interface GuestSessionWithTable {
  id: string
  tableId: string
  sessionTokenHash: string
  expiresAt: Date
  createdAt: Date
  table: {
    id: string
    tableNumber: string
    qrSlug: string
    isActive: boolean
  }
}

/**
 * Membuat sesi tamu baru yang terikat ke meja tertentu dan menghasilkan token rahasia acak 256-bit.
 * Database HANYA menyimpan SHA-256 hash dari token tersebut.
 */
export async function createGuestSession(
  tableId: string,
  ipAddress?: string,
  userAgent?: string
): Promise<{
  id: string
  token: string
  guestSessionId: string
  rawSessionToken: string
  tableNumber: string
  expiresAt: Date
}> {
  const rawSessionToken = crypto.randomBytes(32).toString('hex')
  const sessionTokenHash = crypto
    .createHash('sha256')
    .update(rawSessionToken)
    .digest('hex')

  const expiresAt = new Date(Date.now() + GUEST_SESSION_MAX_AGE * 1000)

  const session = await prisma.guestSession.create({
    data: {
      tableId,
      sessionTokenHash,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      expiresAt,
    },
    include: {
      table: true,
    },
  })

  return {
    id: session.id,
    token: rawSessionToken,
    guestSessionId: session.id,
    rawSessionToken,
    tableNumber: session.table.tableNumber,
    expiresAt: session.expiresAt,
  }
}

/**
 * Memvalidasi token sesi tamu dari cookie pemanggil (cravio_guest) atau string mentah.
 * Menghitung SHA-256 hash dan mencari sesi aktif di PostgreSQL yang belum kedaluwarsa.
 */
export async function resolveGuestSession(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tokenOrRequest: any
): Promise<GuestSessionWithTable | null> {
  if (!tokenOrRequest) {
    return null
  }

  let rawSessionToken: string | null = null

  if (typeof tokenOrRequest === 'string') {
    rawSessionToken = tokenOrRequest
  } else if (
    tokenOrRequest &&
    typeof tokenOrRequest.cookies?.get === 'function'
  ) {
    rawSessionToken = tokenOrRequest.cookies.get(GUEST_SESSION_COOKIE)?.value || null
  } else if (tokenOrRequest && tokenOrRequest.headers) {
    const cookieHeader =
      typeof tokenOrRequest.headers.get === 'function'
        ? tokenOrRequest.headers.get('cookie') || ''
        : ''
    const match = cookieHeader.match(
      new RegExp(`(?:^|;\\s*)${GUEST_SESSION_COOKIE}=([^;]*)`)
    )
    rawSessionToken = match ? decodeURIComponent(match[1]) : null
  }

  if (!rawSessionToken || typeof rawSessionToken !== 'string' || rawSessionToken.trim() === '') {
    return null
  }

  const tokenHash = crypto
    .createHash('sha256')
    .update(rawSessionToken.trim())
    .digest('hex')

  const session = await prisma.guestSession.findFirst({
    where: {
      sessionTokenHash: tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: {
      table: true,
    },
  })

  if (!session || !session.table.isActive) {
    return null
  }

  return session
}
