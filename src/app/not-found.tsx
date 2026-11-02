import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center text-accent font-serif text-2xl font-bold mb-4">
        404
      </div>
      <h1 className="text-2xl font-serif font-bold text-brand mb-2">
        Halaman Tidak Ditemukan
      </h1>
      <p className="text-sm text-brand/70 max-w-md mb-6">
        Halaman yang Anda tuju tidak tersedia atau tautan QR code meja mungkin tidak valid.
      </p>
      <Link
        href="/order?table=01"
        className="touch-target inline-flex items-center justify-center px-6 py-3 rounded-xl bg-brand text-cream text-sm font-medium hover:bg-brand/90 transition-colors"
      >
        Buka Menu Meja 01
      </Link>
    </main>
  )
}

