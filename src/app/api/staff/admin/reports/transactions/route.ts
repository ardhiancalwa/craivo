import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { getTransactionList } from '@/lib/server/report-service'
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
  const paymentMethod = searchParams.get('paymentMethod') || undefined
  const paymentStatus = searchParams.get('paymentStatus') || undefined
  const orderStatus = searchParams.get('orderStatus') || undefined
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '10', 10)

  try {
    const list = await getTransactionList({
      startDate,
      endDate,
      paymentMethod,
      paymentStatus,
      orderStatus,
      page,
      limit,
    })
    return NextResponse.json({ success: true, data: list })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gagal mengambil riwayat transaksi.'
    console.error('Failed to get transactions list:', err)
    return NextResponse.json(
      { error: 'REPORT_ERROR', message: errorMessage },
      { status: 400 }
    )
  }
}
