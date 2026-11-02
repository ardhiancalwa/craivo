import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { getTransactionsForExport } from '@/lib/server/report-service'
import { generateTransactionsCsv } from '@/lib/server/csv-exporter'
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

  try {
    const rows = await getTransactionsForExport(startDate, endDate, paymentMethod)
    const csvContent = generateTransactionsCsv(rows)

    const filename = `cravio-transaksi-${startDate}-sd-${endDate}.csv`

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gagal mengekspor laporan transaksi.'
    console.error('Failed to export transactions CSV:', err)
    return NextResponse.json(
      { error: 'EXPORT_ERROR', message: errorMessage },
      { status: 400 }
    )
  }
}
