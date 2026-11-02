import Link from 'next/link'

interface PageProps {
  searchParams: Promise<{
    status?: string
    table?: string
    message?: string
  }>
}

export default async function OrderStatusPage({ searchParams }: PageProps) {
  const params = await searchParams
  const status = params.status || 'MISSING'
  const tableParam = params.table
  const message = params.message || 'Silakan pindai ulang stiker QR resmi di meja Anda.'

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center p-4 text-center select-none">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FEF3C7] text-[#D97706] mb-4">
        {status === 'INACTIVE' ? (
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
        {status === 'MISSING' && 'Nomor Meja Tidak Terdeteksi'}
        {status === 'NOT_FOUND' && `Meja "${tableParam || ''}" Tidak Terdaftar`}
        {status === 'INACTIVE' && `Meja "${tableParam || ''}" Sedang Tutup`}
        {status === 'INVALID_FORMAT' && 'Format Nomor Meja Tidak Valid'}
      </h1>

      <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        {message}
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

