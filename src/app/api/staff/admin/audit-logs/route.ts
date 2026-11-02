import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { getSanitizedAuditLogs } from '@/lib/server/audit-service'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || undefined
  const staffUserId = searchParams.get('staffUserId') || undefined
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '20', 10)

  try {
    const logs = await getSanitizedAuditLogs({
      action,
      staffUserId,
      page,
      limit,
    })
    return NextResponse.json({ success: true, data: logs })
  } catch (err) {
    console.error('Failed to get audit logs:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengambil log audit aktivitas.' },
      { status: 500 }
    )
  }
}
