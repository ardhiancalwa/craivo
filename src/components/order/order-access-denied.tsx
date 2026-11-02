import Link from 'next/link'

export function OrderAccessDenied() {
  return (
    <main className="min-h-[70vh] p-6 max-w-md mx-auto text-center flex flex-col justify-center items-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-error/10 text-error mb-4">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m0 0v2m0-2h2m-2 0H10m7-7V7a5 5 0 00-10 0v4m-1 0h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z"
          />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-on-surface font-display mb-2">
        Akses Pesanan Terbatas
      </h1>

      <p className="text-sm text-on-surface-variant max-w-sm mb-6 leading-relaxed">
        Rincian dan pelacakan pesanan dilindungi secara aman. Halaman ini hanya dapat dibuka dari peramban atau perangkat yang digunakan saat membuat pesanan.
      </p>

      <div className="flex w-full max-w-xs flex-col gap-2.5">
        <Link
          href="/menu"
          className="flex min-h-touch items-center justify-center rounded-DEFAULT bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-container active:scale-[0.98] transition-all"
        >
          Kembali ke Menu Utama
        </Link>
      </div>
    </main>
  )
}

