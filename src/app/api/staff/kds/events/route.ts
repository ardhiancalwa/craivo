import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { createSseStream } from '@/lib/server/realtime-bus'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // Authoritative RBAC check: Only BARISTA, CASHIER, and ADMIN allowed for KDS
  try {
    await requireStaffRole(['BARISTA', 'CASHIER', 'ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.status }
      )
    }
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Autentikasi staf gagal.' },
      { status: 401 }
    )
  }

  // Stream events published on KDS channel
  return createSseStream({
    request,
    channel: 'KDS',
  })
}

