'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { Volume2, CheckCircle2, Clock } from 'lucide-react'
import { audioAlert } from '@/lib/audio-alert'
import { cn } from '@/lib/utils'

export function KdsPreviewSection() {
  const [activeTicketStatus, setActiveTicketStatus] = React.useState<'COOKING' | 'READY'>('COOKING')
  const [isAudioPlaying, setIsAudioPlaying] = React.useState(false)

  const handlePlayAudioDemo = async () => {
    setIsAudioPlaying(true)
    try {
      await audioAlert.unlockAudio()
      audioAlert.playChime()
    } finally {
      setTimeout(() => setIsAudioPlaying(false), 1200)
    }
  }

  return (
    <section className="py-20 md:py-28 border-t border-sand-200 bg-[#141311] text-sand-100" id="operasional">
      <div className="max-w-6xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-14 space-y-3"
        >
          <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-500 font-mono">
            Visibilitas Barista &amp; Dapur
          </span>
          <h2 className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-white">
            Pesanan terlihat jelas oleh tim yang menyiapkannya.
          </h2>
          <p className="text-sm sm:text-base text-stone-400 leading-relaxed font-normal">
            Setiap pesanan yang disubmit oleh pelanggan langsung diteruskan ke Kitchen Display System (KDS) dan dashboard kasir secara sinkron tanpa kertas hilang.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* 3 Feature Points */}
          <div className="lg:col-span-4 space-y-3">
            {[
              {
                num: '01',
                title: 'Tiket Meja Kontras Tinggi',
                desc: 'Nomor meja tampil besar mencolok. Modifier dan catatan khusus (seperti "less sugar" atau "oat milk") diberi garis aksen terakota agar tidak terlewat.',
              },
              {
                num: '02',
                title: 'Notifikasi Suara Shift',
                desc: 'Lonceng audio chime berdentang otomatis saat pesanan baru masuk. Coba langsung bunyikan demo suara lonceng di panel KDS interaktif.',
              },
              {
                num: '03',
                title: 'Pembaruan Status 4 Tahap',
                desc: 'Satu ketukan di layar dapur mengubah status: Diterima → Dibuat → Siap Saji → Selesai, seketika terefleksi di ponsel pelanggan.',
              },
            ].map((feat, idx) => (
              <motion.div
                key={feat.num}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: idx * 0.1 }}
                whileHover={{ y: -2 }}
                className="p-5 rounded-2xl bg-[#1C1A18] border border-white/[0.08] space-y-2 shadow-xs"
              >
                <span className="font-mono text-xs text-terracotta-500 font-semibold">{feat.num}</span>
                <h3 className="font-semibold text-sm text-white">{feat.title}</h3>
                <p className="text-xs text-stone-400 leading-relaxed">{feat.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Realistic KDS Display Container with Bespoke Visual Craft */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-8"
          >
            <div className="relative rounded-3xl bg-[#181715] border border-white/[0.08] p-5 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.5)] space-y-6 overflow-hidden">
              {/* Subtle ambient warm glow in background */}
              <div
                aria-hidden="true"
                className="absolute top-0 right-1/4 -translate-y-1/2 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none"
              />

              {/* Header bar of KDS screen */}
              <div className="relative flex flex-wrap items-center justify-between pb-4 border-b border-white/[0.08] gap-3">
                <div className="flex items-center gap-3">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold tracking-wider text-white uppercase font-mono">
                      KITCHEN DISPLAY SYSTEM — BAR &amp; DAPUR
                    </h4>
                    <p className="text-[11px] text-stone-400 font-normal">Antrean Aktif: 2 Pesanan Berjalan</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {/* Interactive Audio Chime Test Button */}
                  <button
                    type="button"
                    onClick={handlePlayAudioDemo}
                    disabled={isAudioPlaying}
                    aria-label="Uji suara audio chime pesanan dapur"
                    className={cn(
                      'touch-target inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-full transition-all cursor-pointer font-mono font-medium border select-none',
                      isAudioPlaying
                        ? 'bg-amber-500/25 text-amber-200 border-amber-400/60 shadow-[0_0_16px_rgba(245,158,11,0.35)] scale-105'
                        : 'bg-white/[0.06] hover:bg-white/[0.12] text-stone-300 border-white/10 hover:text-white'
                    )}
                  >
                    <Volume2 className={cn('w-3.5 h-3.5 text-amber-400', isAudioPlaying && 'animate-bounce text-amber-300')} />
                    <span>{isAudioPlaying ? 'Lonceng Berdentang 🔔' : 'Uji Audio Chime Dapur 🔔'}</span>
                  </button>

                  <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 font-medium font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                </div>
              </div>

              {/* 2 High contrast tickets with clean organic cards */}
              <div className="relative grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Ticket 1 (Sedang Dibuat / Siap Saji Interactive State) */}
                <motion.div
                  className={cn(
                    'rounded-2xl bg-[#201E1B] p-5 space-y-4 border transition-all duration-300',
                    activeTicketStatus === 'COOKING'
                      ? 'border-amber-500/30 ring-1 ring-amber-500/20 shadow-[0_8px_30px_rgba(217,119,6,0.12)]'
                      : 'border-emerald-500/30 ring-1 ring-emerald-500/20 shadow-[0_8px_30px_rgba(16,185,129,0.12)]'
                  )}
                >
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <span className="text-[11px] font-mono text-stone-400">TIKET #042</span>
                      <h5 className="text-2xl font-bold text-white tracking-tight font-display">MEJA 07</h5>
                    </div>
                    <div className="text-right">
                      {activeTicketStatus === 'COOKING' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Sedang Dibuat
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          Siap Saji
                        </span>
                      )}
                      <p className="text-[11px] text-stone-400 font-mono mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-stone-400" /> 04:12 m lalu
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="border-b border-white/[0.06] pb-2.5 space-y-1">
                      <div className="flex justify-between items-baseline font-semibold text-white text-xs sm:text-sm">
                        <span>1x Iced Americano</span>
                        <span className="text-stone-400 font-mono text-[11px] font-normal">Bar</span>
                      </div>
                      <div className="border-l-2 border-terracotta-500/70 bg-white/[0.03] pl-2.5 py-1 text-[11px] text-stone-300 rounded-r-md">
                        Catatan: Polos tanpa gula, es reguler
                      </div>
                    </div>

                    <div className="border-b border-white/[0.06] pb-2.5 space-y-1">
                      <div className="flex justify-between items-baseline font-semibold text-white text-xs sm:text-sm">
                        <span>1x Kopi Susu Aren</span>
                        <span className="text-stone-400 font-mono text-[11px] font-normal">Bar</span>
                      </div>
                      <div className="border-l-2 border-terracotta-500/70 bg-white/[0.03] pl-2.5 py-1 text-[11px] text-stone-300 rounded-r-md">
                        Modifier: Susu oat, less sweet
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400/90 font-mono font-medium">QRIS (Lunas)</span>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveTicketStatus((prev) => (prev === 'COOKING' ? 'READY' : 'COOKING'))
                      }
                      className="touch-target inline-flex items-center justify-center rounded-full bg-terracotta-500 hover:bg-terracotta-600 active:scale-95 text-white text-xs font-semibold px-4 py-2 transition-all shadow-sm cursor-pointer"
                    >
                      {activeTicketStatus === 'COOKING' ? 'Tandai Siap Saji →' : 'Kembalikan ke Dapur ↺'}
                    </button>
                  </div>
                </motion.div>

                {/* Ticket 2 (Diterima) */}
                <div className="rounded-2xl bg-[#201E1B] border border-white/[0.08] p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                    <div>
                      <span className="text-[11px] font-mono text-stone-400">TIKET #043</span>
                      <h5 className="text-2xl font-bold text-white tracking-tight font-display">MEJA 03</h5>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tracking-wide bg-stone-500/15 text-stone-300 border border-white/10">
                        Diterima
                      </span>
                      <p className="text-[11px] text-stone-400 font-mono mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-stone-400" /> 01:05 m lalu
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="border-b border-white/[0.06] pb-2.5 space-y-1">
                      <div className="flex justify-between items-baseline font-semibold text-white text-xs sm:text-sm">
                        <span>2x Butter Croissant</span>
                        <span className="text-stone-400 font-mono text-[11px] font-normal">Pastry</span>
                      </div>
                      <div className="border-l-2 border-stone-600 bg-white/[0.03] pl-2.5 py-1 text-[11px] text-stone-300 rounded-r-md">
                        Hangatkan sebentar
                      </div>
                    </div>

                    <div className="border-b border-white/[0.06] pb-2.5 space-y-1">
                      <div className="flex justify-between items-baseline font-semibold text-white text-xs sm:text-sm">
                        <span>1x Matcha Latte</span>
                        <span className="text-stone-400 font-mono text-[11px] font-normal">Bar</span>
                      </div>
                      <div className="border-l-2 border-stone-600 bg-white/[0.03] pl-2.5 py-1 text-[11px] text-stone-300 rounded-r-md">
                        Hot, oat milk
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-stone-400 font-mono font-medium">Menunggu Kasir (Tunai)</span>
                    <button
                      type="button"
                      className="touch-target inline-flex items-center justify-center rounded-full bg-white/[0.1] hover:bg-white/[0.16] text-stone-200 text-xs font-semibold px-4 py-2 transition-all cursor-pointer"
                    >
                      Mulai Buat
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
