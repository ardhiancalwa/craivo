import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { validateTableServer } from '@/lib/server/table-service'
import { createGuestSession } from '@/lib/server/guest-session'

interface PageProps {
  searchParams: Promise<{ table?: string }>
}

export default async function OrderTableResolverPage({ searchParams }: PageProps) {
  const params = await searchParams
  const tableParam = params.table

  const result = await validateTableServer(tableParam)

  // 1. VALID TABLE: Buat Sesi Tamu resmi, set cookie cravio_guest (HttpOnly) & cravio_table, redirect ke /menu
  if (result.status === 'VALID' && result.table) {
    const session = await createGuestSession(result.table.id)
    const isProduction = process.env.NODE_ENV === 'production'

    const cookieStore = await cookies()
    cookieStore.set('cravio_guest', session.token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 60 * 60 * 12, // 12 jam
    })

    cookieStore.set('cravio_table', result.table.tableNumber, {
      path: '/',
      httpOnly: false, // Dibutuhkan klien untuk UI konteks meja
      sameSite: 'lax',
      maxAge: 60 * 60 * 12, // 12 jam
    })

    redirect(`/quiz?table=${encodeURIComponent(result.table.tableNumber)}`)
  }

  // 2. INVALID / INACTIVE / MISSING TABLE: Render honest, helpful guidance screen
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center select-none">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706] mb-4">
        {result.status === 'INACTIVE' ? (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
            />
          </svg>
        ) : (
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        )}
      </div>

      <h1 className="text-xl font-bold text-on-surface font-sans mb-2">
        {result.status === 'MISSING' && 'Nomor Meja Tidak Terdeteksi'}
        {result.status === 'NOT_FOUND' && `Meja "${tableParam}" Tidak Terdaftar`}
        {result.status === 'INACTIVE' && `Meja "${tableParam}" Sedang Tutup`}
        {result.status === 'INVALID_FORMAT' && 'Format Nomor Meja Tidak Valid'}
      </h1>

      <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        {result.message}
      </p>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <Link
          href="/menu"
          className="flex min-h-touch items-center justify-center rounded-DEFAULT bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all"
        >
          Lihat Katalog (Mode Baca)
        </Link>

        <p className="text-[11px] text-on-surface-variant pt-2">
          Catatan: Untuk melakukan pemesanan dan pembayaran, silakan pindai ulang stiker QR resmi di meja Anda.
        </p>
      </div>
    </div>
  )
}
