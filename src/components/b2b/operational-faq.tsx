'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FaqItem {
  id: string
  category: string
  question: string
  answer: string
}

const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-app',
    category: 'Pelanggan',
    question: 'Apakah pelanggan perlu mengunduh aplikasi atau membuat akun?',
    answer:
      'Tidak. Pelanggan memindai QR meja dengan kamera ponsel dan langsung membuka halaman menu di peramban. Status pesanan dilindungi token unik per transaksi tanpa memerlukan pendaftaran akun.',
  },
  {
    id: 'faq-cash',
    category: 'Pembayaran',
    question: 'Bagaimana alur jika pelanggan memilih membayar tunai di kasir?',
    answer:
      'Pesanan tercatat dengan status menunggu konfirmasi kasir (WAITING_CASHIER) dan belum dikirim ke layar dapur. Setelah pelanggan membayar di kasir dan staf menekan konfirmasi di layar POS, pesanan baru diteruskan ke antrean dapur.',
  },
  {
    id: 'faq-qris',
    category: 'QRIS & Gateway',
    question: 'Bagaimana verifikasi QRIS bekerja dan ke mana dana masuk?',
    answer:
      'QRIS dinamis diterbitkan melalui Midtrans Core API untuk nominal pesanan tersebut dengan batas waktu 15 menit. Saat pembayaran selesai, webhook bertanda tangan SHA-512 memperbarui status pesanan secara otomatis. Pencairan dana mengikuti rekening merchant kafe yang terdaftar di Midtrans.',
  },
  {
    id: 'faq-printer',
    category: 'Cetak Struk',
    question: 'Bagaimana dukungan pencetakan untuk printer thermal 58 mm dan 80 mm?',
    answer:
      'Sistem menyediakan layout cetak monokrom CSS @media print ukuran 58 mm dan 80 mm untuk struk kasir serta tiket dapur (tanpa nominal harga) melalui dialog cetak peramban/sistem operasi. Kesesuaian margin tetap perlu diuji pada unit printer fisik yang digunakan kafe.',
  },
  {
    id: 'faq-connection',
    category: 'Koneksi',
    question: 'Apa yang terjadi jika koneksi Wi-Fi tablet dapur sempat terputus?',
    answer:
      'Kanal Server-Sent Events (SSE) pada layar POS dan KDS melakukan penyambungan ulang otomatis dengan penanda urutan event sehingga antrean pesanan tetap tersinkron saat koneksi kembali aktif.',
  },
  {
    id: 'faq-admin',
    category: 'Pengelolaan',
    question: 'Apakah staf admin dapat mengubah harga dan menandai menu habis sendiri?',
    answer:
      'Dapat. Melalui halaman Admin, peran yang berwenang dapat menambah/mengarsipkan menu, memperbarui harga Rupiah integer, mengatur opsi modifier, serta mengubah status menu habis yang langsung diterapkan pada katalog dan rekomendasi kuis.',
  },
]

export function OperationalFaq() {
  const [openIds, setOpenIds] = React.useState<string[]>(['faq-app', 'faq-cash'])

  const toggleItem = (id: string) => {
    setOpenIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  return (
    <section
      id="faq"
      aria-labelledby="heading-faq"
      className="border-t border-sand-200 bg-sand-50/50 py-20 md:py-28"
    >
      <div className="mx-auto max-w-4xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center mb-14 space-y-3"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-500 font-mono">
            Pertanyaan Umum
          </span>
          <h2
            id="heading-faq"
            className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950"
          >
            FAQ operasional kafe.
          </h2>
          <p className="text-sm text-stone-600 font-normal max-w-xl mx-auto leading-relaxed">
            Jawaban lugas dan faktual mengenai pengalaman meja pelanggan, alur tunai vs QRIS, pencetakan kertas thermal, dan pengelolaan menu harian.
          </p>
        </motion.div>

        {/* Clean Rounded-2xl Accordion Cards with Spring Motion */}
        <div className="space-y-3">
          {FAQ_ITEMS.map((faq, idx) => {
            const isOpen = openIds.includes(faq.id)
            return (
              <motion.div
                key={faq.id}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: idx * 0.05 }}
                className="rounded-2xl bg-white border border-sand-200 shadow-subtle overflow-hidden transition-colors hover:border-sand-300"
              >
                <h3>
                  <button
                    type="button"
                    onClick={() => toggleItem(faq.id)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${faq.id}`}
                    className="touch-target flex w-full items-start justify-between gap-4 p-5 sm:p-6 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset cursor-pointer"
                  >
                    <div className="space-y-1">
                      <span className="block font-mono text-[10px] uppercase tracking-wider text-terracotta-600 font-semibold">
                        {faq.category}
                      </span>
                      <span className="block font-semibold text-sm sm:text-base text-charcoal-950 leading-snug">
                        {faq.question}
                      </span>
                    </div>

                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        'mt-1 h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200',
                        isOpen && 'rotate-180 text-charcoal-950'
                      )}
                    />
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-panel-${faq.id}`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 text-xs sm:text-sm text-stone-600 leading-relaxed border-t border-sand-100 mt-1">
                        <p className="pt-3">{faq.answer}</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
