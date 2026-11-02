'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

interface FrictionRow {
  code: string
  situation: string
  resolutionTitle: string
  resolutionDetail: string
}

const OPERATIONAL_FRICTIONS: FrictionRow[] = [
  {
    code: '01',
    situation: 'Antrean menumpuk di depan kasir saat pelanggan baru mulai membaca menu.',
    resolutionTitle: 'Pemilihan menu langsung dari meja',
    resolutionDetail:
      'Setiap meja memiliki QR publik (/order?table=XX) yang membuka katalog di peramban ponsel tanpa unduh aplikasi dan tanpa login.',
  },
  {
    code: '02',
    situation: 'Permintaan takaran gula, es, atau catatan khusus terlewat saat dicatat lisan.',
    resolutionTitle: 'Modifier terstruktur hingga tiket dapur',
    resolutionDetail:
      'Pilihan radio/checkbox modifier serta catatan khusus (maks. 100 karakter) divalidasi server dan disimpan sebagai snapshot permanen untuk struk kasir dan KDS.',
  },
  {
    code: '03',
    situation: 'Barista terlanjur menyeduh pesanan yang belum selesai dibayar.',
    resolutionTitle: 'Pemisahan status bayar dan antrean masak',
    resolutionDetail:
      'Layar dapur hanya menampilkan pesanan dengan status finansial PAID — setelah verifikasi webhook QRIS atau setelah kasir mengonfirmasi penerimaan uang tunai.',
  },
]

interface ProcessStep {
  step: string
  actor: string
  title: string
  detail: string
  artifact: string
}

const PROCESS_DIAGRAM_STEPS: ProcessStep[] = [
  {
    step: 'Tahap 01',
    actor: 'Pelanggan di meja',
    title: 'Pindai QR & pilih menu',
    detail:
      'Membuka menu sesuai nomor meja, menyaring kategori atau mencoba kuis preferensi 3 langkah, lalu mengatur modifier item.',
    artifact: 'Rute: /order?table=07',
  },
  {
    step: 'Tahap 02',
    actor: 'Server aplikasi',
    title: 'Hitung harga & kunci snapshot',
    detail:
      'Total dihitung di server dalam satuan Rupiah integer. Jika harga katalog berubah sebelum bayar, sistem meminta persetujuan ulang.',
    artifact: 'Idempotency-Key + Price Quote',
  },
  {
    step: 'Tahap 03',
    actor: 'Midtrans QRIS / Kasir POS',
    title: 'Verifikasi pembayaran',
    detail:
      'QRIS dinamis diverifikasi otomatis via tanda tangan SHA-512 (batas 15 menit). Pembayaran tunai dikonfirmasi kasir di layar POS (batas 20 menit).',
    artifact: 'Status: PAID',
  },
  {
    step: 'Tahap 04',
    actor: 'Barista & Kasir',
    title: 'Antrean KDS & cetak struk',
    detail:
      'Pesanan lunas masuk antrean dapur berurutan (QUEUED → COOKING → READY → COMPLETED), disertai e-receipt pelanggan dan cetak 58/80 mm.',
    artifact: 'SSE Stream + Print 58/80mm',
  },
]

export function WorkflowStorytelling() {
  return (
    <section
      id="alur-kerja"
      aria-labelledby="heading-alur-kerja"
      className="border-t border-sand-200 bg-surface"
    >
      {/* Part A: Editorial Split — Operational Context */}
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-24">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-4 space-y-4"
          >
            <p className="font-mono text-xs uppercase tracking-wider text-terracotta-500 font-semibold">
              01 / Konteks Operasional
            </p>
            <h2
              id="heading-alur-kerja"
              className="font-display text-2xl font-bold tracking-tight text-charcoal-950 sm:text-3xl leading-snug"
            >
              Menjaga koordinasi antara meja, kasir, dan bar kopi.
            </h2>
            <p className="text-sm leading-relaxed text-stone-600">
              Sistem dirancang untuk alur kerja kafe harian: mengurangi pencatatan berulang tanpa menghilangkan kendali kasir terhadap pembayaran tunai maupun antrean dapur.
            </p>
          </motion.div>

          <div className="lg:col-span-8 border-t border-sand-200 divide-y divide-sand-200">
            {OPERATIONAL_FRICTIONS.map((row, idx) => (
              <motion.div
                key={row.code}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                className="grid grid-cols-1 gap-4 py-6 sm:grid-cols-12 sm:gap-6"
              >
                <div className="sm:col-span-5 space-y-1.5">
                  <span className="font-mono text-xs text-stone-400 font-semibold tabular-nums">
                    Situasi {row.code}
                  </span>
                  <p className="text-sm font-medium text-charcoal-950 leading-relaxed">
                    {row.situation}
                  </p>
                </div>

                <div className="sm:col-span-7 space-y-1.5 sm:border-l sm:border-sand-200 sm:pl-6">
                  <h3 className="font-display text-base font-bold text-charcoal-950">
                    {row.resolutionTitle}
                  </h3>
                  <p className="text-sm text-stone-600 leading-relaxed">
                    {row.resolutionDetail}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Part B: Horizontal Process Diagram Strip with Staggered Motion */}
      <div className="border-t border-sand-200 bg-sand-50/50">
        <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 md:py-20 space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"
          >
            <div className="space-y-1.5">
              <p className="font-mono text-xs uppercase tracking-wider text-terracotta-500 font-semibold">
                02 / Alur Penggunaan
              </p>
              <h3 className="font-display text-xl font-bold tracking-tight text-charcoal-950 sm:text-2xl">
                Empat tahap berurutan dari meja hingga penyajian.
              </h3>
            </div>
            <p className="font-mono text-xs text-stone-500">
              Urutan tegas: pembayaran diverifikasi sebelum masuk dapur
            </p>
          </motion.div>

          <ol className="grid grid-cols-1 rounded-2xl border border-sand-200 bg-white shadow-subtle divide-y divide-sand-200 md:grid-cols-4 md:divide-y-0 md:divide-x overflow-hidden">
            {PROCESS_DIAGRAM_STEPS.map((item, idx) => (
              <motion.li
                key={item.step}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.1 }}
                whileHover={{ backgroundColor: '#FDFBF7' }}
                className="flex flex-col justify-between p-5 sm:p-6 gap-5 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold text-terracotta-600">
                      {item.step}
                    </span>
                    <span className="font-mono text-[11px] text-stone-400">
                      {item.actor}
                    </span>
                  </div>
                  <h4 className="font-display text-base font-bold text-charcoal-950">
                    {item.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    {item.detail}
                  </p>
                </div>

                <div className="border-t border-sand-100 pt-3">
                  <span className="font-mono text-[11px] text-stone-700 bg-sand-100 px-2 py-0.5 rounded">
                    {item.artifact}
                  </span>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
