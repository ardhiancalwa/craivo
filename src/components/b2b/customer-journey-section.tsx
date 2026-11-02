'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  Sparkles,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  ChevronRight,
  ArrowRight,
  ChefHat,
  Coffee,
} from 'lucide-react'

interface JourneyStep {
  stepNumber: number
  code: string
  title: string
  shortLabel: string
  description: string
  meta: string
  highlightBadge?: string
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    stepNumber: 1,
    code: '01',
    title: 'Scan QR Meja',
    shortLabel: 'Pindai Meja',
    description:
      'Kamera ponsel memindai akrilik meja. Sistem langsung mengenali nomor meja tanpa unduh aplikasi dan tanpa mendaftar akun.',
    meta: 'Meja terdeteksi instan',
    highlightBadge: 'Tanpa Install',
  },
  {
    stepNumber: 2,
    code: '02',
    title: 'Isi / Lewati Kuis',
    shortLabel: 'Kurasi Selera',
    description:
      '3 pertanyaan selera cepat (suasana, rasa, suhu) untuk kurasi rekomendasi. Pelanggan juga bebas melewati kuis langsung ke menu.',
    meta: 'Opsional & 30 detik',
    highlightBadge: 'Kurasi Cerdas',
  },
  {
    stepNumber: 3,
    code: '03',
    title: 'Pilih & Modifikasi',
    shortLabel: 'Pilihan Menu',
    description:
      'Katalog 2 kolom dengan foto jelas, level manis/es, opsi susu oat, dan catatan kustom barista yang divalidasi langsung di server.',
    meta: 'Modifier terperinci',
    highlightBadge: 'Snapshot Permanen',
  },
  {
    stepNumber: 4,
    code: '04',
    title: 'QRIS / Tunai Kasir',
    shortLabel: 'Pembayaran',
    description:
      'Bayar mandiri via QRIS dinamis ber-timer 15 menit, atau pilih bayar tunai di kasir dengan verifikasi staf sebelum pesanan diteruskan.',
    meta: '2 Metode fleksibel',
    highlightBadge: 'SHA-512 Verified',
  },
  {
    stepNumber: 5,
    code: '05',
    title: 'Pantau Progres',
    shortLabel: 'Antrean Dapur',
    description:
      'Pelacak langsung di layar: Diterima → Dibuat → Siap Saji secara real-time (SSE) tanpa perlu memanggil staf berulang kali.',
    meta: 'Tenang di meja',
    highlightBadge: 'Real-time Tracker',
  },
]

const AUTO_CYCLE_DURATION_MS = 3800

export function CustomerJourneySection() {
  const [activeStepIndex, setActiveStepIndex] = React.useState<number>(0)
  const [isPlaying, setIsPlaying] = React.useState<boolean>(true)
  const [isHovered, setIsHovered] = React.useState<boolean>(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState<boolean>(false)

  // Listen for prefers-reduced-motion
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(Boolean(mq.matches))

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // Auto-cycle timeline when playing, not hovered, and not reduced motion
  React.useEffect(() => {
    if (!isPlaying || isHovered || prefersReducedMotion) return

    const timer = setInterval(() => {
      setActiveStepIndex((prev) => (prev + 1) % JOURNEY_STEPS.length)
    }, AUTO_CYCLE_DURATION_MS)

    return () => clearInterval(timer)
  }, [isPlaying, isHovered, prefersReducedMotion])

  const currentStep = JOURNEY_STEPS[activeStepIndex] || JOURNEY_STEPS[0]!

  return (
    <section
      className="py-20 md:py-28 border-t border-sand-200 bg-sand-50/60 overflow-hidden"
      id="cara-kerja"
      aria-labelledby="heading-cara-kerja"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-sand-200/80 pb-8">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl space-y-3"
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-terracotta-500 font-mono">
              Alur Pengalaman Pelanggan
            </span>
            <h2
              id="heading-cara-kerja"
              className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950"
            >
              Pelanggan memesan langsung dari meja.
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
              Tanpa perlu download aplikasi dari store atau mendaftar akun rumit. Cukup arahkan kamera ponsel ke QR meja dan mulai memesan dalam hitungan detik.
            </p>
          </motion.div>

          {/* Interactive Flow Controller (Play / Pause & Step Indicator) */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono text-stone-500">
              Langkah <span className="font-semibold text-charcoal-950">{activeStepIndex + 1}</span> dari{' '}
              {JOURNEY_STEPS.length}
            </span>
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              aria-label={isPlaying ? 'Jeda animasi alur pelanggan' : 'Putar animasi alur pelanggan'}
              className="touch-target inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-sand-200 shadow-subtle text-xs font-medium text-charcoal-950 hover:bg-sand-100 transition-colors cursor-pointer"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-stone-600" />
                  <span>Jeda</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-terracotta-600 fill-terracotta-600" />
                  <span>Putar</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* SVG MOTION PIPELINE TRACK (Interactive connected milestones)          */}
        {/* ===================================================================== */}
        <div className="relative py-2">
          {/* Animated Connecting Track (Desktop / Tablet) */}
          <div className="hidden md:block relative mb-8">
            {/* Base Line: Connecting center of Column 1 (10%) to Column 5 (90%) */}
            <div
              className="absolute top-[18px] -translate-y-1/2 h-1 bg-sand-200 rounded-full"
              style={{ left: '10%', right: '10%' }}
            />

            {/* Active Colored Line that tracks progress */}
            <motion.div
              className="absolute top-[18px] -translate-y-1/2 h-1 bg-gradient-to-r from-terracotta-500 to-amber-500 rounded-full"
              style={{ left: '10%' }}
              initial={false}
              animate={{
                width: `${activeStepIndex * 20}%`,
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />

            {/* Milestone Buttons: 5 Equal Columns perfectly aligned with track */}
            <div className="grid grid-cols-5 relative z-10">
              {JOURNEY_STEPS.map((step, idx) => {
                const isActive = idx === activeStepIndex
                const isPast = idx < activeStepIndex
                return (
                  <button
                    key={step.code}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className="group flex flex-col items-center focus-visible:outline-none cursor-pointer"
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-bold transition-all shadow-sm ${
                        isActive
                          ? 'bg-charcoal-950 text-white scale-110 ring-4 ring-terracotta-500/20'
                          : isPast
                            ? 'bg-terracotta-500 text-white'
                            : 'bg-white text-stone-500 border border-sand-300 group-hover:border-charcoal-950 group-hover:text-charcoal-950'
                      }`}
                    >
                      {step.code}
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium text-center transition-colors px-1 ${
                        isActive ? 'text-charcoal-950 font-semibold' : 'text-stone-500'
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* DYNAMIC MOTION GRAPHICS STAGE & STEP CARDS GRID                      */}
        {/* ===================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left Column: Visual Interactive Mockup Stage for the Active Step */}
          <div className="lg:col-span-6 rounded-2xl bg-[#141311] border border-charcoal-800 p-6 sm:p-8 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden min-h-[380px]">
            {/* Background subtle ambient warmth */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-terracotta-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Stage Titlebar */}
            <div className="flex items-center justify-between pb-4 border-b border-charcoal-800 text-xs font-mono text-stone-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-terracotta-500 animate-pulse" />
                <span className="text-white font-medium">Simulasi Visual Tahap {currentStep.code}</span>
              </div>
              <span className="bg-charcoal-800 text-stone-300 px-2 py-0.5 rounded text-[10px] border border-charcoal-700">
                {currentStep.meta}
              </span>
            </div>

            {/* Stage Body Animated Transitions */}
            <div className="my-auto py-6">
              <AnimatePresence mode="wait">
                {/* STAGE 01: SCAN QR MEJA */}
                {activeStepIndex === 0 && (
                  <motion.div
                    key="stage-01"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4 text-center max-w-sm mx-auto"
                  >
                    <div className="relative mx-auto w-32 h-36 bg-[#1F1E1B] rounded-xl border border-charcoal-700 p-3 flex flex-col items-center justify-between shadow-lg overflow-hidden">
                      <span className="text-[9px] font-mono font-bold text-stone-400">CRAVIO</span>
                      <div className="relative">
                        <QrCode className="w-14 h-14 text-white" />
                        {/* Animated Laser Scanning Beam */}
                        {!prefersReducedMotion && (
                          <motion.div
                            className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_#F59E0B]"
                            animate={{ top: ['0%', '100%', '0%'] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded border border-amber-400/30">
                        MEJA 07
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-800/80">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Meja 07 Terdeteksi Otomatis</span>
                      </div>
                      <p className="text-xs text-stone-400">
                        Rute publik: <span className="text-white font-mono">/order?table=07</span> (Sesi baru terisolasi)
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* STAGE 02: KUIS PREFERENSI 3 DIMENSI */}
                {activeStepIndex === 1 && (
                  <motion.div
                    key="stage-02"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3.5 max-w-sm mx-auto"
                  >
                    <div className="bg-[#1F1E1B] p-4 rounded-xl border border-charcoal-700 space-y-3">
                      <div className="flex items-center justify-between border-b border-charcoal-800 pb-2">
                        <span className="text-[10px] font-mono text-terracotta-400 uppercase">
                          Kuis Selera 30 Detik
                        </span>
                        <span className="text-[10px] text-stone-400">Deterministik 3 Dimensi</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between bg-charcoal-800/80 p-2 rounded-lg border border-charcoal-700">
                          <span className="text-stone-400">1. Suasana</span>
                          <span className="text-white font-semibold bg-terracotta-500/20 text-terracotta-300 px-2 py-0.5 rounded text-[11px] border border-terracotta-500/40">
                            Santai &amp; Rileks
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-charcoal-800/80 p-2 rounded-lg border border-charcoal-700">
                          <span className="text-stone-400">2. Karakter Rasa</span>
                          <span className="text-white font-semibold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[11px] border border-amber-500/40">
                            Creamy &amp; Gurih
                          </span>
                        </div>
                        <div className="flex items-center justify-between bg-charcoal-800/80 p-2 rounded-lg border border-charcoal-700">
                          <span className="text-stone-400">3. Format / Suhu</span>
                          <span className="text-white font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded text-[11px] border border-emerald-500/40">
                            Kudapan / Pastry
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs text-stone-400 flex items-center justify-center gap-1.5 font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Hasil: French Butter Croissant (Match 98%)
                    </p>
                  </motion.div>
                )}

                {/* STAGE 03: PILIH & MODIFIKASI */}
                {activeStepIndex === 2 && (
                  <motion.div
                    key="stage-03"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3 max-w-sm mx-auto"
                  >
                    <div className="bg-[#1F1E1B] p-4 rounded-xl border border-charcoal-700 space-y-3">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-terracotta-500/20 flex items-center justify-center text-terracotta-400">
                            <Coffee className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="text-xs font-semibold text-white">Kopi Susu Aren Cravio</h4>
                            <span className="text-[10px] text-stone-400 font-mono">Signature Beverage</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-bold text-amber-400">Rp28.000</span>
                      </div>

                      {/* Modifier Tags */}
                      <div className="pt-2 border-t border-charcoal-800 space-y-1.5 text-[11px]">
                        <div className="flex justify-between items-center bg-charcoal-800/60 px-2 py-1 rounded">
                          <span className="text-stone-300">Level Manis</span>
                          <span className="text-amber-300 font-mono">Less Sweet (50%)</span>
                        </div>
                        <div className="flex justify-between items-center bg-charcoal-800/60 px-2 py-1 rounded">
                          <span className="text-stone-300">Pilihan Susu</span>
                          <span className="text-amber-300 font-mono">Oat Milk (+Rp6.000)</span>
                        </div>
                      </div>

                      <div className="pt-1 flex justify-between items-center text-xs border-t border-charcoal-800">
                        <span className="text-stone-400">Total Harga Server:</span>
                        <span className="font-mono font-bold text-white text-sm">Rp34.000</span>
                      </div>
                    </div>

                    <p className="text-center text-xs text-stone-400 font-mono">
                      Modifier tersimpan sebagai snapshot permanen untuk tiket dapur.
                    </p>
                  </motion.div>
                )}

                {/* STAGE 04: PEMBAYARAN QRIS / KASIR */}
                {activeStepIndex === 3 && (
                  <motion.div
                    key="stage-04"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3.5 max-w-sm mx-auto"
                  >
                    <div className="bg-[#1F1E1B] p-4 rounded-xl border border-charcoal-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-charcoal-800 pb-2">
                        <span className="text-[10px] font-mono text-stone-400 uppercase">Midtrans Core API QRIS</span>
                        <span className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Batas 14:48 m
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-lg p-1.5 shrink-0 flex items-center justify-center">
                          <QrCode className="w-full h-full text-charcoal-950" />
                        </div>
                        <div className="text-xs space-y-1">
                          <p className="text-stone-300">Total Pembayaran:</p>
                          <p className="text-base font-bold font-mono text-white">Rp34.000</p>
                          <span className="inline-block text-[10px] text-emerald-400 font-mono bg-emerald-950/80 px-1.5 py-0.5 rounded border border-emerald-800">
                            Status: FINANSIAL LUNAS
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-center text-xs text-stone-400 space-y-0.5 font-mono">
                      <p>Atau pilih opsi <strong className="text-white">&quot;Bayar Tunai di Kasir&quot;</strong></p>
                      <p className="text-[11px] text-stone-500">Tiket masuk dapur setelah staf menekan konfirmasi kasir.</p>
                    </div>
                  </motion.div>
                )}

                {/* STAGE 05: PANTAU PROGRES MEJA */}
                {activeStepIndex === 4 && (
                  <motion.div
                    key="stage-05"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-3 max-w-sm mx-auto"
                  >
                    <div className="bg-[#1F1E1B] p-4 rounded-xl border border-charcoal-700 space-y-3">
                      <div className="flex justify-between items-center border-b border-charcoal-800 pb-2">
                        <span className="text-xs font-semibold text-white">Pelacak Pesanan Meja 07</span>
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Live Stream SSE
                        </span>
                      </div>

                      {/* 3 Step Status Flow */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center gap-2.5 text-stone-400">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>1. Pesanan Diterima (Lunas)</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-amber-300 font-semibold bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                          <ChefHat className="w-4 h-4 text-amber-400 animate-pulse" />
                          <span>2. Sedang Diracik Barista</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-stone-500">
                          <span className="w-4 h-4 rounded-full border border-stone-600 flex items-center justify-center text-[9px] font-mono">
                            3
                          </span>
                          <span>3. Siap Saji ke Meja</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-center text-xs text-stone-400 font-mono">
                      Pelanggan tetap santai di meja tanpa harus bolak-balik menanyakan pesanan.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Stage Footer Step Bar */}
            <div className="pt-4 border-t border-charcoal-800 flex items-center justify-between text-xs">
              <span className="text-stone-400">Tahap {currentStep.code}: {currentStep.title}</span>
              <div className="flex items-center gap-1">
                {JOURNEY_STEPS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveStepIndex(i)}
                    aria-label={`Pilih tahap ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      i === activeStepIndex ? 'w-6 bg-terracotta-500' : 'w-2 bg-charcoal-700 hover:bg-stone-500'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: 5 Synchronized Interactive Step Cards */}
          <div className="lg:col-span-6 flex flex-col justify-between gap-3">
            {JOURNEY_STEPS.map((step, idx) => {
              const isActive = idx === activeStepIndex
              return (
                <button
                  key={step.code}
                  type="button"
                  onClick={() => setActiveStepIndex(idx)}
                  className={`text-left p-4 sm:p-4.5 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 ${
                    isActive
                      ? 'bg-white border-charcoal-950 shadow-md ring-1 ring-charcoal-950'
                      : 'bg-white/80 border-sand-200 hover:border-sand-300 hover:bg-white shadow-subtle'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-bold transition-colors ${
                          isActive ? 'text-terracotta-600' : 'text-stone-400 group-hover:text-charcoal-950'
                        }`}
                      >
                        {step.code}
                      </span>
                      <h3 className="font-semibold text-sm sm:text-base text-charcoal-950">
                        {step.title}
                      </h3>
                      {step.highlightBadge && (
                        <span
                          className={`hidden sm:inline-block text-[10px] font-mono px-2 py-0.5 rounded font-medium ${
                            isActive
                              ? 'bg-sand-100 text-charcoal-950 border border-sand-300'
                              : 'bg-sand-100/60 text-stone-500'
                          }`}
                        >
                          {step.highlightBadge}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed pr-2">
                      {step.description}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center pt-1 text-stone-400 group-hover:text-charcoal-950 transition-colors">
                    {isActive ? (
                      <ArrowRight className="w-4 h-4 text-terracotta-600" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
