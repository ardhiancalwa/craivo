import { NextRequest, NextResponse } from 'next/server'
import { validateTableServer } from '@/lib/server/table-service'
import { createGuestSession } from '@/lib/server/guest-session'

export const dynamic = 'force-dynamic'

/**
 * Route Handler untuk memproses scan QR meja kafe (/order?table=...).
 * Berjalan sebagai Route Handler (bukan Server Component) agar dapat
 * memodifikasi cookie sesi tamu resmi (cravio_guest, cravio_table) secara valid
 * sesuai arsitektur Next.js App Router sebelum mengarahkan ke alur pemesanan (/quiz).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tableParam = searchParams.get('table')

  const result = await validateTableServer(tableParam)

  // 1. VALID TABLE: Buat Sesi Tamu resmi, set cookie cravio_guest (HttpOnly) & cravio_table, redirect ke /quiz
  if (result.status === 'VALID' && result.table) {
    const session = await createGuestSession(result.table.id)
    const isProduction = process.env.NODE_ENV === 'production'

    const targetUrl = new URL('/quiz', request.url)
    targetUrl.searchParams.set('table', result.table.tableNumber)

    const response = NextResponse.redirect(targetUrl, 307)

    response.cookies.set('cravio_guest', session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 60 * 60 * 12, // 12 jam
    })

    response.cookies.set('cravio_table', result.table.tableNumber, {
      path: '/',
      httpOnly: false, // Dibutuhkan klien untuk UI konteks meja
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 jam
    })

    return response
  }

  // 2. INVALID / INACTIVE / MISSING TABLE: Arahkan ke /order/status dengan pesan bantuan transparan
  const statusUrl = new URL('/order/status', request.url)
  statusUrl.searchParams.set('status', result.status)
  if (tableParam) {
    statusUrl.searchParams.set('table', tableParam)
  }
  if (result.message) {
    statusUrl.searchParams.set('message', result.message)
  }

  return NextResponse.redirect(statusUrl, 307)
}

