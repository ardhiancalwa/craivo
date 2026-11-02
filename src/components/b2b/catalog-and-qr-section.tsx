'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { QrCode, Check, Sparkles } from 'lucide-react'

interface StockRow {
  id: string
  name: string
  category: string
  price: string
  tags: string
  isAvailable: boolean
}

const INITIAL_STOCK_ITEMS: StockRow[] = [
  {
    id: 'kopi-susu',
    name: 'Kopi Susu Aren',
    category: 'Kopi',
    price: 'Rp28.000',
    tags: 'Manis, Dingin',
    isAvailable: true,
  },
  {
    id: 'americano',
    name: 'Iced Americano',
    category: 'Kopi',
    price: 'Rp24.000',
    tags: 'Segar, Dingin',
    isAvailable: true,
  },
  {
    id: 'truffle-fries',
    name: 'Truffle Fries',
    category: 'Makanan',
    price: 'Rp35.000',
    tags: 'Gurih, Santai',
    isAvailable: false,
  },
  {
    id: 'croissant',
    name: 'Butter Croissant',
    category: 'Pastry',
    price: 'Rp25.000',
    tags: 'Gurih, Hangat',
    isAvailable: true,
  },
]

export function CatalogAndQrSection() {
  const [items, setItems] = React.useState<StockRow[]>(INITIAL_STOCK_ITEMS)

  const toggleStock = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    )
  }

  return (
    <section className="py-20 md:py-28 border-t border-sand-200 bg-sand-50/50" id="kelola-menu">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-14 space-y-3"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-500 font-mono">
            Kontrol Menu &amp; Operasional
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950">
            Perbarui menu sesuai kondisi operasional.
          </h2>
          <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
            Bahan baku habis di tengah shift? Cukup satu klik toggle, menu otomatis ditandai Sold Out di seluruh ponsel pelanggan saat itu juga.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Interactive Stock Toggle Table */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-7 rounded-2xl bg-white border border-sand-200 p-5 sm:p-6 shadow-subtle space-y-4"
          >
            <div className="flex items-center justify-between border-b border-sand-100 pb-3">
              <span className="font-semibold text-sm text-charcoal-950">
                Katalog &amp; Manajemen Stok Real-Time
              </span>
              <span className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2 py-0.5 rounded flex items-center gap-1 font-mono">
                <Sparkles className="w-3 h-3 text-emerald-600" /> Sinkron Langsung
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-sand-100 text-stone-500 font-medium">
                    <th className="py-2">Item Menu</th>
                    <th className="py-2">Kategori</th>
                    <th className="py-2">Harga</th>
                    <th className="py-2">Tag Kuis</th>
                    <th className="py-2 text-right">Status Stok (Klik Toggle)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sand-100 text-stone-800">
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className={`transition-colors ${
                        !row.isAvailable ? 'bg-stone-50/70' : 'hover:bg-sand-50/40'
                      }`}
                    >
                      <td
                        className={`py-2.5 font-semibold transition-all ${
                          !row.isAvailable
                            ? 'text-stone-400 line-through'
                            : 'text-charcoal-950'
                        }`}
                      >
                        {row.name}
                      </td>
                      <td className={`py-2.5 ${!row.isAvailable ? 'text-stone-400' : 'text-stone-500'}`}>
                        {row.category}
                      </td>
                      <td
                        className={`py-2.5 font-mono ${
                          !row.isAvailable ? 'text-stone-400' : 'text-charcoal-950'
                        }`}
                      >
                        {row.price}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            !row.isAvailable
                              ? 'bg-stone-200/50 text-stone-400'
                              : 'bg-sand-100 text-stone-700'
                          }`}
                        >
                          {row.tags}
                        </span>
                      </td>
                      <td className="py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => toggleStock(row.id)}
                          aria-label={`Ubah stok ${row.name}`}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border cursor-pointer active:scale-95 ${
                            row.isAvailable
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          }`}
                        >
                          {row.isAvailable ? (
                            <>
                              <Check className="w-2.5 h-2.5" /> Tersedia
                            </>
                          ) : (
                            'SOLD OUT'
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-stone-500 pt-2 border-t border-sand-100">
              Perubahan stok seketika mengunci tombol pesanan pelanggan di meja.
            </p>
          </motion.div>

          {/* Right: Acrylic QR Card Generator (High-Res 300 DPI Preview) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="lg:col-span-5 rounded-2xl bg-white border border-sand-200 p-6 shadow-subtle space-y-4"
          >
            <div className="w-8 h-8 rounded-lg bg-charcoal-950 text-white flex items-center justify-center font-mono text-xs font-bold">
              QR
            </div>
            <h3 className="text-base font-semibold text-charcoal-950">
              Generator QR Meja Siap Cetak (300 DPI)
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Buat kode QR beresolusi tinggi untuk setiap nomor meja (Meja 01 s/d Meja 50) dengan label nomor meja tercetak jelas. Siap dicetak langsung pada stiker atau akrilik meja standar.
            </p>

            <div className="p-4 rounded-xl bg-sand-50 border border-sand-200 flex items-center gap-4">
              {/* Simulated Acrylic QR Card Graphic with 3D Float Motion */}
              <motion.div
                whileHover={{ rotateY: 10, rotateX: -5, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="w-20 h-24 bg-white rounded-lg border-2 border-charcoal-900 p-2 flex flex-col items-center justify-between shadow-md shrink-0 cursor-pointer"
              >
                <span className="text-[8px] font-bold tracking-tight text-charcoal-950">CRAVIO</span>
                <QrCode className="w-9 h-9 text-charcoal-950" />
                <span className="text-[8px] font-mono font-bold bg-sand-200 px-1 rounded text-charcoal-950">
                  MEJA 07
                </span>
              </motion.div>

              <div className="text-xs text-stone-600 space-y-1">
                <p className="font-bold text-charcoal-950 text-[11px]">Format Ekspor Siap Cetak:</p>
                <p className="text-[11px]">• PNG High-Res &amp; Vector PDF</p>
                <p className="text-[11px]">• Unduh per meja atau bulk ZIP (50 meja)</p>
                <p className="text-[11px]">• Ukuran rasio akrilik standar A6 / A7</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

