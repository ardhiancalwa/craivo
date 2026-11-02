import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { getTurnoverReport } from '@/lib/server/report-service'
import { getJakartaTodayString } from '@/lib/server/timezone-utils'

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
  const today = getJakartaTodayString()
  const startDate = searchParams.get('startDate') || today
  const endDate = searchParams.get('endDate') || startDate

  try {
    const report = await getTurnoverReport(startDate, endDate)
    return NextResponse.json({ success: true, data: report })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gagal menghasilkan laporan omzet.'
    console.error('Failed to generate turnover report:', err)
    return NextResponse.json(
      { error: 'REPORT_ERROR', message: errorMessage },
      { status: 400 }
    )
  }
}
