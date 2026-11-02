'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { QrCode, Banknote, Printer } from 'lucide-react'

export function PaymentReceiptSection() {
  return (
    <section className="py-20 md:py-28 border-t border-sand-200 bg-white" id="pembayaran">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-14 space-y-3"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-500 font-mono">
            Transaksi &amp; Dokumentasi
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950">
            Pembayaran fleksibel dan bukti transaksi teratur.
          </h2>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
            Mendukung pembayaran mandiri non-tunai maupun penerimaan tunai konvensional di meja kasir.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Dynamic QRIS */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            whileHover={{ y: -4 }}
            className="p-6 rounded-2xl bg-sand-50 border border-sand-200 shadow-subtle space-y-3"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-sand-200 text-stone-900 flex items-center justify-center font-bold text-xs shadow-sm">
              <QrCode className="w-5 h-5 text-terracotta-600" />
            </div>
            <h3 className="font-semibold text-sm text-charcoal-950">
              QRIS Dinamis Otomatis
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Integrasi payment gateway resmi (Midtrans). Setiap order memiliki nominal pas dengan timer batas bayar 15 menit untuk mencegah order gantung.
            </p>
            <div className="pt-3 border-t border-sand-200/80 text-[11px] font-mono text-stone-500">
              Webhook verifikasi otomatis
            </div>
          </motion.div>

          {/* Card 2: Cash Option */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            whileHover={{ y: -4 }}
            className="p-6 rounded-2xl bg-sand-50 border border-sand-200 shadow-subtle space-y-3"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-sand-200 text-stone-900 flex items-center justify-center font-bold text-xs shadow-sm">
              <Banknote className="w-5 h-5 text-emerald-700" />
            </div>
            <h3 className="font-semibold text-sm text-charcoal-950">
              Opsi Bayar Tunai di Kasir
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Pelanggan memilih bayar tunai → tiket masuk ke kasir dengan status <em>&ldquo;Menunggu Kasir&rdquo;</em>. Staf menerima uang lalu menekan konfirmasi untuk meneruskan ke dapur.
            </p>
            <div className="pt-3 border-t border-sand-200/80 text-[11px] font-mono text-stone-500">
              Mencegah pesanan fiktif
            </div>
          </motion.div>

          {/* Card 3: Thermal Receipt 58/80mm */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            whileHover={{ y: -4 }}
            className="p-6 rounded-2xl bg-sand-50 border border-sand-200 shadow-subtle space-y-3"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-sand-200 text-stone-900 flex items-center justify-center font-bold text-xs shadow-sm">
              <Printer className="w-5 h-5 text-charcoal-950" />
            </div>
            <h3 className="font-semibold text-sm text-charcoal-950">
              Struk Digital &amp; Thermal 58/80 mm
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Pelanggan mendapatkan e-receipt di ponsel. Kasir dapat mencetak struk fisik via printer thermal 58mm atau 80mm yang kompatibel via protokol ESC/POS standar.
            </p>
            <div className="pt-3 border-t border-sand-200/80 text-[11px] font-mono text-stone-500">
              Layout monospaced ESC/POS
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

