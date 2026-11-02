import * as React from 'react'
import { Check, MessageSquare } from 'lucide-react'

interface PricingProps {
  whatsappUrl: string
  hasValidWhatsapp: boolean
  confirmedPrice?: string | null
}

const INCLUDED_SCOPE = [
  'Aplikasi web pemesanan meja pelanggan, katalog kategori, dan kuis preferensi 3 langkah deterministik',
  'Integrasi pembayaran Midtrans Core API QRIS dinamis beserta verifikasi tanda tangan webhook SHA-512',
  'Dashboard Kasir POS untuk konfirmasi pembayaran tunai, pembatalan terkendali, dan pencatatan refund manual',
  'Layar KDS Dapur real-time (SSE) dengan kebijakan PAID-only, penanda usia tiket, dan pengingat suara',
  'Template e-receipt pelanggan serta struk kasir & tiket dapur ukuran 58 mm dan 80 mm (@media print)',
  'Panel Admin untuk pengelolaan menu, stok habis, konfigurasi kuis, pengaturan pajak/service, laporan WIB, dan ekspor CSV',
  'Generator kode QR meja satuan (PNG/SVG) dan lembar cetak PDF/ZIP dengan pemisahan domain staging vs produksi',
  'Konfigurasi awal domain & layanan cloud tahun pertama sesuai kontrak serta pendampingan uji operasional (UAT)',
]

const BOUNDARIES_AND_EXCLUSIONS = [
  {
    title: 'Perangkat keras disediakan pihak kafe',
    detail:
      'Tablet kasir, layar KDS dapur, jaringan internet/Wi-Fi lokasi, serta unit printer thermal 58/80 mm tidak termasuk dalam paket perangkat lunak.',
  },
  {
    title: 'Akun merchant Midtrans & biaya transaksi (MDR)',
    detail:
      'Aktivasi QRIS produksi memerlukan kelengkapan dokumen KYC pemilik usaha ke Midtrans. Besaran potongan MDR mengikuti ketentuan resmi penyedia pembayaran yang berlaku, bukan tarif tunggal seragam.',
  },
  {
    title: 'Perpanjangan domain & infrastruktur lanjutan',
    detail:
      'Tidak menjanjikan hosting gratis selamanya. Setelah masa tahun pertama berakhir, perpanjangan domain dan layanan cloud/database mengikuti pemakaian komersial kafe.',
  },
  {
    title: 'Jadwal go-live & batasan operasional',
    detail:
      'Waktu penayangan produksi bergantung pada kesiapan data menu, persetujuan KYC gateway, dan uji perangkat di lokasi kafe — tanpa janji jadwal instan tanpa syarat atau jaminan bebas kendala mutlak.',
  },
]

export function PricingBreakdown({
  whatsappUrl,
  hasValidWhatsapp,
  confirmedPrice,
}: PricingProps) {
  return (
    <section
      id="paket"
      aria-labelledby="heading-paket"
      className="border-t border-outline-variant bg-surface py-16 md:py-24"
    >
      <div className="mx-auto max-w-7xl px-4 md:px-8 space-y-10">
        {/* Section Header + Price Status */}
        <div className="grid grid-cols-1 gap-6 border-b border-outline-variant pb-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7 space-y-3">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
              05 / Rincian Paket & Batas Layanan
            </p>
            <h2
              id="heading-paket"
              className="font-display text-2xl font-bold tracking-tight text-on-surface sm:text-3xl"
            >
              Ruang lingkup implementasi dan pembagian tanggung jawab.
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">
              Cakupan teknis disusun transparan agar pemilik kafe mengetahui komponen yang disiapkan pengembang sejak awal serta kebutuhan operasional yang dikelola langsung oleh kafe.
            </p>
          </div>

          <div className="lg:col-span-5 lg:text-right space-y-1">
            <span className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant block">
              Status Penawaran Komersial
            </span>
            {confirmedPrice ? (
              <p className="font-display text-3xl font-bold text-on-surface tabular-nums">
                {confirmedPrice}
              </p>
            ) : (
              <div className="space-y-1">
                <p className="font-display text-lg font-bold text-on-surface">
                  Harga publik menunggu konfirmasi resmi
                </p>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Nominal penawaran disesuaikan berdasarkan konfirmasi pemilik produk dan jumlah meja/kebutuhan implementasi kafe.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Two-Column Specification Ledger */}
        <div className="grid grid-cols-1 border border-outline-variant bg-surface-lowest divide-y divide-outline-variant lg:grid-cols-12 lg:divide-y-0 lg:divide-x">
          {/* Included */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-status-paid font-semibold">
                Termasuk dalam ruang lingkup
              </span>
              <h3 className="font-display text-lg font-bold text-on-surface">
                Komponen perangkat lunak & pendampingan tahun pertama
              </h3>
            </div>

            <ul className="divide-y divide-outline-variant border-t border-outline-variant">
              {INCLUDED_SCOPE.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3 py-3 text-xs sm:text-sm text-on-surface">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-status-paid"
                    aria-hidden="true"
                  />
                  <span className="leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Excluded / Cafe Responsibilities */}
          <div className="lg:col-span-5 bg-surface-low/60 p-6 sm:p-8 space-y-5">
            <div className="space-y-1">
              <span className="font-mono text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                Batas klaim & tanggung jawab kafe
              </span>
              <h3 className="font-display text-lg font-bold text-on-surface">
                Ketentuan perangkat, gateway, dan biaya lanjutan
              </h3>
            </div>

            <dl className="divide-y divide-outline-variant border-t border-outline-variant">
              {BOUNDARIES_AND_EXCLUSIONS.map((row) => (
                <div key={row.title} className="py-3.5 space-y-1">
                  <dt className="font-display text-sm font-bold text-on-surface">
                    {row.title}
                  </dt>
                  <dd className="text-xs text-on-surface-variant leading-relaxed">
                    {row.detail}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Consultation Strip */}
        <div className="flex flex-col justify-between gap-4 border-t border-outline-variant pt-6 sm:flex-row sm:items-center">
          <p className="text-xs sm:text-sm text-on-surface-variant">
            Diskusikan kesiapan jaringan, jumlah meja, dan alur kasir kafe sebelum implementasi dimulai.
          </p>

          {hasValidWhatsapp ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="touch-target inline-flex shrink-0 items-center justify-center gap-2 rounded-DEFAULT bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              <span>Hubungi via WhatsApp</span>
            </a>
          ) : (
            <span
              role="status"
              className="inline-flex shrink-0 items-center rounded-DEFAULT border border-outline-variant bg-surface-low px-4 py-2.5 font-mono text-xs text-on-surface-variant"
            >
              Kontak WhatsApp resmi belum dikonfigurasi
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
