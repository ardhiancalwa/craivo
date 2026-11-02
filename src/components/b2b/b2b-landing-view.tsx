'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ExternalLink, MessageSquare, ChevronRight } from 'lucide-react'
import { HeroFlowMotion } from './hero-flow-motion'
import { CustomerJourneySection } from './customer-journey-section'
import { WorkflowStorytelling } from './workflow-storytelling'
import { DemoQuizSimulator } from './demo-quiz-simulator'
import { KdsPreviewSection } from './kds-preview-section'
import { CatalogAndQrSection } from './catalog-and-qr-section'
import { PaymentReceiptSection } from './payment-receipt-section'
import { PricingBreakdown } from './pricing-breakdown'
import { OperationalFaq } from './operational-faq'
import { ConsultationModal } from './consultation-modal'

export interface B2BLandingViewProps {
  cafeName: string
  cafeTagline: string
  confirmedAddress: string | null
  confirmedPhone: string | null
  confirmedPrice: string | null
  whatsappUrl: string
  hasValidWhatsapp: boolean
}

interface SystemModuleRow {
  index: string
  domain: string
  title: string
  summary: string
  capabilities: string[]
}

const SYSTEM_MODULES: SystemModuleRow[] = [
  {
    index: '03.1',
    domain: 'Pelanggan',
    title: 'Menu Meja & Kurasi Preferensi',
    summary:
      'Antarmuka ponsel yang dibuka langsung dari QR meja fisik dengan pemisahan sesi antar-pelanggan.',
    capabilities: [
      'Deteksi meja dari parameter rute publik (/order?table=XX) tanpa membocorkan riwayat pemesan sebelumnya',
      'Kuis preferensi 3 langkah (Suasana → Rasa → Format/Suhu) berbasis pencocokan bobot deterministik tanpa AI eksternal',
      'Pemilihan modifier tervalidasi, pelacak status berproteksi token unik per pesanan, dan e-receipt digital',
    ],
  },
  {
    index: '03.2',
    domain: 'Pembayaran QRIS',
    title: 'Midtrans Core API & Rekonsiliasi',
    summary:
      'Perhitungan nominal di sisi server dengan verifikasi pembayaran otomatis sebelum pesanan diteruskan.',
    capabilities: [
      'Penerbitan QRIS dinamis per transaksi dengan perhitungan harga Rupiah integer dari server',
      'Verifikasi tanda tangan webhook SHA-512 serta perlindungan Idempotency-Key terhadap pengiriman ganda',
      'Batas waktu pembayaran 15 menit disertai rekonsiliasi status kedaluwarsa di server',
    ],
  },
  {
    index: '03.3',
    domain: 'POS Kasir & KDS Dapur',
    title: 'Operasional Kasir, Antrean Masak, & Struk',
    summary:
      'Koordinasi langsung antara penerimaan kasir dan layar kerja barista melalui Server-Sent Events.',
    capabilities: [
      'Konfirmasi pembayaran tunai di layar POS kasir sebelum tiket diizinkan tampil di KDS dapur',
      'Antrean dapur berurutan (QUEUED → COOKING → READY → COMPLETED) dengan tombol sentuh ≥56px dan pengingat suara',
      'Layout cetak CSS @media print ukuran 58 mm dan 80 mm untuk struk kasir dan tiket dapur (dengan penanda cetak ulang)',
    ],
  },
  {
    index: '03.4',
    domain: 'Panel Admin',
    title: 'Katalog, Kuis, Laporan WIB, & Master QR',
    summary:
      'Pengelolaan operasional harian kafe tanpa perubahan kode sumber.',
    capabilities: [
      'Tambah, ubah, arsipkan menu, grup modifier, foto tervalidasi, serta sakelar menu habis secara langsung',
      'Pengaturan bobot/pertanyaan kuis ber-versi dan kebijakan pajak/service (default 0%, mendukung inklusif/eksklusif)',
      'Laporan transaksi harian zona waktu Asia/Jakarta, ekspor CSV aman, audit log, dan unduhan QR meja (PNG, SVG, ZIP, PDF)',
    ],
  },
]

export function B2BLandingView({
  cafeName,
  cafeTagline,
  confirmedAddress,
  confirmedPhone,
  confirmedPrice,
  whatsappUrl,
  hasValidWhatsapp,
}: B2BLandingViewProps) {
  const [isConsultModalOpen, setIsConsultModalOpen] = React.useState(false)
  const [highlightIdx, setHighlightIdx] = React.useState(0)

  const ROTATING_HIGHLIGHTS = React.useMemo(
    () => [
      'Tanpa Unduh Aplikasi',
      'QRIS Dinamis Terverifikasi',
      'KDS Dapur Realtime < 2s',
      'Struk Thermal 58 & 80 mm',
      'Kurasi Menu Meja Non-AI Slop',
    ],
    []
  )

  React.useEffect(() => {
    const timer = setInterval(() => {
      setHighlightIdx((prev) => (prev + 1) % ROTATING_HIGHLIGHTS.length)
    }, 3200)
    return () => clearInterval(timer)
  }, [ROTATING_HIGHLIGHTS.length])

  return (
    <div className="min-h-screen bg-[#FBF9F5] text-charcoal-950 font-sans selection:bg-sand-300 selection:text-charcoal-950">
      {/* ===================================================================== */}
      {/* TOP EDITORIAL MICRO-BANNER (Forge / Hospitality Studio style)         */}
      {/* ===================================================================== */}
      <div className="bg-charcoal-950 text-sand-200 text-[11px] font-medium tracking-wide py-2 px-4 border-b border-charcoal-800 text-center font-mono">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-sand-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Sistem Pemesanan Mandiri Meja Kafe &amp; Resto B2B
          </span>
          <span className="text-charcoal-700 hidden sm:inline">|</span>
          <span className="text-sand-400 font-normal hidden sm:inline">
            Demo interaktif langsung tersedia di halaman ini
          </span>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MINIMALIST STICKY HEADER (Glass-free, crisp warm canvas hairline)     */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#FBF9F5]/90 backdrop-blur-xl border-b border-sand-200/80 transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex items-center gap-8 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
            >
              <Image
                src="/logo/only-logo.jpeg"
                alt="Cravio Logo"
                width={32}
                height={32}
                className="h-8 w-8 rounded-lg object-contain bg-white shadow-xs"
              />
              <div className="flex items-baseline gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-charcoal-950">
                  craivo
                </span>
                <span
                  aria-hidden="true"
                  className="hidden sm:inline-block h-3.5 w-[1px] bg-sand-300"
                />
                <span className="hidden sm:inline-block font-mono text-[11px] lowercase tracking-wider text-stone-500">
                  your craving, perfectly matched
                </span>
              </div>
            </Link>

            <nav
              aria-label="Navigasi bagian halaman"
              className="hidden lg:flex items-center gap-6 text-xs font-medium text-stone-600"
            >
              <a
                href="#cara-kerja"
                className="py-1 transition-colors hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 rounded-sm"
              >
                Cara Kerja
              </a>
              <a
                href="#demo-kuis"
                className="py-1 transition-colors hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 rounded-sm"
              >
                Simulasi Kuis
              </a>
              <a
                href="#operasional"
                className="py-1 transition-colors hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 rounded-sm"
              >
                Kasir &amp; Dapur
              </a>
              <a
                href="#faq"
                className="py-1 transition-colors hover:text-charcoal-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 rounded-sm"
              >
                FAQ
              </a>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="#demo-kuis"
              className="hidden sm:inline-flex text-xs font-medium text-stone-700 hover:text-charcoal-950 px-3 py-1.5 transition-colors"
            >
              Coba Demo
            </a>

            <button
              type="button"
              onClick={() => setIsConsultModalOpen(true)}
              className="touch-target inline-flex items-center gap-1.5 rounded-full bg-charcoal-950 hover:bg-charcoal-800 px-4 py-2 text-xs font-semibold text-white transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 cursor-pointer"
            >
              <span>Diskusikan untuk Kafe Saya</span>
              <ChevronRight className="h-3.5 w-3.5 text-stone-300" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* HERO SECTION: Single-Column Stacked (Centered Copy + Wide Motion Stage) */}
      {/* Inspired by design-preview/landing-page.html                          */}
      {/* ===================================================================== */}
      <section
        id="hero"
        aria-labelledby="hero-heading"
        className="relative pt-12 pb-16 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-28 overflow-hidden"
      >
        {/* Subtle ambient glow background inspired by Forge */}
        <div
          aria-hidden="true"
          className="absolute top-0 inset-x-0 h-[640px] pointer-events-none opacity-40 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(194,94,43,0.12),transparent_70%)]"
        />

        <div className="relative mx-auto max-w-7xl px-4 md:px-8">
          {/* Centered Editorial Copy Block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-4xl mx-auto text-center space-y-6"
          >
            {/* Category badge with rotating interactive highlight pill */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sand-100 border border-sand-200 text-xs font-medium text-stone-700 shadow-2xs hover:border-terracotta-500/40 transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-terracotta-500 animate-pulse" />
                <span>Platform Pemesanan Mandiri Meja Kafe &amp; Restoran</span>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-terracotta-50 border border-terracotta-200/70 text-xs font-medium text-terracotta-800 shadow-2xs overflow-hidden h-7">
                <span className="font-mono text-[10px] text-terracotta-600 font-bold uppercase tracking-wider">
                  Fitur:
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={highlightIdx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    className="font-semibold text-terracotta-900 truncate"
                  >
                    ⚡ {ROTATING_HIGHLIGHTS[highlightIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            {/* Exact H1 required by Vitest: /pesanan dari meja\.\s*alurnya sampai ke dapur\./i */}
            <h1
              id="hero-heading"
              className="font-editorial text-5xl sm:text-6xl md:text-7xl lg:text-[4.75rem] font-normal leading-[1.05] tracking-tight text-charcoal-950"
            >
              <span className="block overflow-hidden">
                {['Pesanan', 'dari', 'meja.'].map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="inline-block mr-[0.25em] last:mr-0 transition-transform duration-200 hover:-translate-y-1 cursor-default"
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
              <span className="block italic font-normal overflow-hidden mt-1 sm:mt-2">
                {['Alurnya', 'sampai', 'ke', 'dapur.'].map((word, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 22 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.5,
                      delay: 0.28 + i * 0.08,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="inline-block mr-[0.25em] last:mr-0 transition-colors duration-200 hover:text-terracotta-600 cursor-default"
                  >
                    {word}
                  </motion.span>
                ))}
              </span>
            </h1>

            {/* Exact paragraph required by Vitest: /pelanggan memilih menu dan membayar dari ponsel\. kasir dan dapur menerima informasi yang jelas untuk melanjutkan pesanan\./i */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-2xl mx-auto text-base sm:text-lg leading-relaxed text-stone-600 font-normal"
            >
              Pelanggan memilih menu dan membayar dari ponsel. Kasir dan dapur menerima informasi yang jelas untuk melanjutkan pesanan.
            </motion.p>

            {/* Centered Action Row */}
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              {hasValidWhatsapp ? (
                <>
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-terracotta-500 hover:bg-terracotta-600 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" aria-hidden="true" />
                    <span>Konsultasi via WhatsApp</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setIsConsultModalOpen(true)}
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-charcoal-950 hover:bg-charcoal-800 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 cursor-pointer"
                  >
                    <span>Diskusikan untuk Kafe Saya</span>
                  </button>
                  <a
                    href="#demo-kuis"
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white hover:bg-sand-50 px-5 py-3 text-xs sm:text-sm font-semibold text-charcoal-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
                  >
                    <span>Coba Demo Kuis</span>
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsConsultModalOpen(true)}
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-charcoal-950 hover:bg-charcoal-800 px-6 py-3 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500 cursor-pointer"
                  >
                    <span>Diskusikan untuk Kafe Saya</span>
                  </button>
                  <a
                    href="#demo-kuis"
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full bg-terracotta-500 hover:bg-terracotta-600 px-6 py-3 text-xs sm:text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
                  >
                    <span>Coba Demo Kuis</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </a>
                  <Link
                    href="/order?table=07"
                    className="touch-target inline-flex items-center justify-center gap-2 rounded-full border border-sand-300 bg-white hover:bg-sand-50 px-5 py-3 text-xs sm:text-sm font-semibold text-charcoal-950 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
                  >
                    <span>Buka Contoh Meja 07</span>
                    <ExternalLink className="h-3.5 w-3.5 text-stone-400" aria-hidden="true" />
                  </Link>
                </>
              )}
            </div>

            {!hasValidWhatsapp && (
              <p className="max-w-md mx-auto text-xs text-stone-500 leading-relaxed font-mono">
                Tautan konsultasi WhatsApp menunggu konfigurasi nomor bisnis resmi pada lingkungan aplikasi.
              </p>
            )}

            {/* Technical Guarantees Bar (Factual / No Hype) - Centered */}
            <div className="pt-6 max-w-lg mx-auto grid grid-cols-3 divide-x divide-sand-200 border-t border-sand-200 text-center text-xs">
              <div className="px-2">
                <span className="block text-stone-500 text-[11px] font-mono">Platform</span>
                <span className="font-semibold text-charcoal-950 text-[12px]">Web Tanpa Install</span>
              </div>
              <div className="px-2">
                <span className="block text-stone-500 text-[11px] font-mono">Metode Bayar</span>
                <span className="font-semibold text-charcoal-950 text-[12px]">QRIS &amp; Tunai Kasir</span>
              </div>
              <div className="px-2">
                <span className="block text-stone-500 text-[11px] font-mono">Operasional</span>
                <span className="font-semibold text-charcoal-950 text-[12px]">KDS &amp; Tiket ESC/POS</span>
              </div>
            </div>
          </motion.div>

          {/* Centered Dominant Motion Graphics Stage (Below content text, max-w-5xl) */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-5xl mx-auto px-2 sm:px-4 mt-12 md:mt-16"
          >
            <HeroFlowMotion />
          </motion.div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION: CUSTOMER JOURNEY (01 Scan QR Meja s/d 05 Pantau Progres)    */}
      {/* ===================================================================== */}
      <CustomerJourneySection />

      {/* ===================================================================== */}
      {/* SECTION 01 & 02: EDITORIAL SPLIT + PROCESS DIAGRAM                    */}
      {/* ===================================================================== */}
      <WorkflowStorytelling />

      {/* ===================================================================== */}
      {/* SECTION 03: MODUL SISTEM (Specification Index — Pelanggan/QRIS/POS/Admin) */}
      {/* ===================================================================== */}
      <section
        id="modul-sistem"
        aria-labelledby="heading-modul-sistem"
        className="border-t border-sand-200 bg-white py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl space-y-3"
          >
            <span className="font-mono text-xs font-semibold uppercase tracking-widest text-terracotta-500">
              03 / Cakupan Modul Sistem
            </span>
            <h2
              id="heading-modul-sistem"
              className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950"
            >
              Empat bagian yang bekerja di atas satu basis data transaksi.
            </h2>
            <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
              Setiap modul membaca status pesanan dan snapshot harga yang sama sehingga struk pelanggan, kasir, dan tiket dapur tetap konsisten.
            </p>
          </motion.div>

          <div className="border-y border-sand-200 divide-y divide-sand-200">
            {SYSTEM_MODULES.map((mod, idx) => (
              <motion.article
                key={mod.index}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: idx * 0.08 }}
                className="grid grid-cols-1 gap-6 py-8 lg:grid-cols-12 lg:gap-10 hover:bg-sand-50/40 transition-colors p-3 rounded-xl"
              >
                <div className="lg:col-span-4 space-y-2">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-semibold text-terracotta-600">{mod.index}</span>
                    <span aria-hidden="true" className="text-stone-300">
                      ·
                    </span>
                    <span className="uppercase tracking-wider text-stone-500">
                      {mod.domain}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold text-charcoal-950 sm:text-xl">
                    {mod.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                    {mod.summary}
                  </p>
                </div>

                <ul className="lg:col-span-8 space-y-2.5 lg:border-l lg:border-sand-200 lg:pl-8">
                  {mod.capabilities.map((cap, cIdx) => (
                    <li
                      key={cIdx}
                      className="flex items-start gap-3 text-xs sm:text-sm text-charcoal-950 leading-relaxed"
                    >
                      <span
                        aria-hidden="true"
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-terracotta-500"
                      />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION 04: INTERACTIVE QUIZ DEMO (Editorial Split + Live Preview)    */}
      {/* ===================================================================== */}
      <section
        id="demo-kuis"
        aria-labelledby="heading-demo-kuis"
        className="border-t border-sand-200 bg-sand-50/50 py-20 md:py-28"
      >
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-5 space-y-5"
            >
              <span className="font-mono text-xs font-semibold uppercase tracking-widest text-terracotta-500">
                04 / Demo Interaktif
              </span>
              <h2
                id="heading-demo-kuis"
                className="font-editorial text-3xl sm:text-4xl md:text-5xl font-normal text-charcoal-950 leading-tight"
              >
                Uji langsung kuis kurasi menu tiga langkah.
              </h2>
              <p className="text-sm sm:text-base text-stone-600 leading-relaxed font-normal">
                Bagi pelanggan yang belum menentukan pesanan, kuis singkat mempersempit pilihan menu berdasarkan tiga dimensi terukur: Suasana, Rasa, dan Format/Suhu.
              </p>

              <dl className="border-t border-sand-200 divide-y divide-sand-200 text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-stone-500">Urutan langkah</dt>
                  <dd className="font-mono font-semibold text-charcoal-950">
                    Suasana → Rasa → Format/Suhu
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-stone-500">Skema bobot default</dt>
                  <dd className="font-mono font-semibold text-charcoal-950 tabular-nums">
                    Rasa (3) · Format (2) · Suasana (1)
                  </dd>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-stone-500">Isolasi data demo</dt>
                  <dd className="font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    In-memory · 0 request transaksi
                  </dd>
                </div>
              </dl>
            </motion.div>

            <div className="lg:col-span-7">
              <DemoQuizSimulator />
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SECTION: KDS LIVE PREVIEW (High Contrast Bar & Kitchen Display)        */}
      {/* ===================================================================== */}
      <KdsPreviewSection />

      {/* ===================================================================== */}
      {/* SECTION: CATALOG & REAL-TIME STOCK TOGGLE + ACRYLIC QR STAND PREVIEW  */}
      {/* ===================================================================== */}
      <CatalogAndQrSection />

      {/* ===================================================================== */}
      {/* SECTION: PAYMENT OPTIONS & THERMAL RECEIPT SPECIFICATION              */}
      {/* ===================================================================== */}
      <PaymentReceiptSection />

      {/* ===================================================================== */}
      {/* SECTION 05: PRICING & COMMERCIAL SCOPE                                */}
      {/* ===================================================================== */}
      <PricingBreakdown
        whatsappUrl={whatsappUrl}
        hasValidWhatsapp={hasValidWhatsapp}
        confirmedPrice={confirmedPrice}
      />

      {/* ===================================================================== */}
      {/* SECTION 06: OPERATIONAL FAQ                                           */}
      {/* ===================================================================== */}
      <OperationalFaq />

      {/* ===================================================================== */}
      {/* BOTTOM EDITORIAL CTA SECTION (Deep Charcoal card with ambient glow)   */}
      {/* ===================================================================== */}
      <section className="py-20 md:py-28 px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-5xl mx-auto rounded-3xl bg-charcoal-950 text-white p-8 sm:p-14 relative overflow-hidden text-center space-y-6 shadow-2xl border border-charcoal-800"
        >
          {/* Ambient light effect inspired by Forge */}
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none opacity-20 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(194,94,43,0.3),transparent_70%)]"
          />

          <div className="relative z-10 space-y-6">
            <span className="inline-block px-3 py-1 rounded-full bg-charcoal-800/80 text-sand-300 border border-charcoal-700 text-[11px] font-medium tracking-wide font-mono">
              Siap Meningkatkan Pengalaman Meja Kafe Anda?
            </span>

            <h2 className="font-editorial text-3xl sm:text-5xl md:text-6xl font-normal leading-[1.08] tracking-tight">
              Lihat bagaimana alurnya bekerja <br className="hidden sm:inline" />
              <span className="italic font-normal">untuk outlet kafe Anda.</span>
            </h2>

            <p className="text-stone-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed font-normal">
              Uji coba langsung alur pemesanan mandiri pelanggan atau diskusikan kebutuhan operasional meja kafe Anda bersama tim kami.
            </p>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <a
                href="#demo-kuis"
                className="px-6 py-3 rounded-full bg-white hover:bg-stone-100 text-charcoal-950 font-medium text-xs sm:text-sm transition-all shadow-md"
              >
                Coba Demo Kuis
              </a>
              <button
                type="button"
                onClick={() => setIsConsultModalOpen(true)}
                className="px-6 py-3 rounded-full bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-700 text-white font-medium text-xs sm:text-sm transition-all cursor-pointer"
              >
                Diskusikan untuk Kafe Saya
              </button>
            </div>

            <p className="text-[11px] text-stone-500 pt-2 font-mono">
              Konsultasi alur kerja kafe dan integrasi tanpa komitmen awal.
            </p>
          </div>
        </motion.div>
      </section>

      {/* ===================================================================== */}
      {/* FOOTER & DIRECT CONTACT                                               */}
      {/* ===================================================================== */}
      <footer className="border-t border-charcoal-800 bg-[#111110] text-stone-400">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <div className="grid grid-cols-1 gap-10 pb-10 border-b border-charcoal-800 md:grid-cols-12">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <Image
                  src="/logo/only-logo.jpeg"
                  alt="Cravio Logo"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-lg object-contain bg-white shadow-xs"
                />
                <span className="font-display text-xl font-bold tracking-tight text-white">
                  craivo
                </span>
                <span className="font-mono text-xs text-stone-500">
                  {cafeName && cafeName !== 'Cravio' ? `· ${cafeName}` : '· your craving, perfectly matched'}
                </span>
              </div>
              <p className="max-w-sm text-xs sm:text-sm text-stone-400 leading-relaxed font-normal">
                {cafeTagline}. Sistem pemesanan meja berbasis QR, pembayaran QRIS &amp; kasir POS, serta layar antrean dapur terpadu.
              </p>
              {(confirmedAddress || confirmedPhone) && (
                <div className="pt-1 font-mono text-xs text-stone-400 space-y-1">
                  {confirmedAddress && <p>{confirmedAddress}</p>}
                  {confirmedPhone && <p>Kontak: {confirmedPhone}</p>}
                </div>
              )}
            </div>

            <div className="md:col-span-3 space-y-3">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-200">
                Bagian Halaman
              </h3>
              <ul className="space-y-2 text-xs text-stone-400">
                <li>
                  <a href="#cara-kerja" className="hover:text-white transition-colors">
                    Cara Kerja
                  </a>
                </li>
                <li>
                  <a href="#alur-kerja" className="hover:text-white transition-colors">
                    Alur Penggunaan
                  </a>
                </li>
                <li>
                  <a href="#modul-sistem" className="hover:text-white transition-colors">
                    Modul Sistem
                  </a>
                </li>
                <li>
                  <a href="#demo-kuis" className="hover:text-white transition-colors">
                    Demo Kuis Interaktif
                  </a>
                </li>
                <li>
                  <a href="#operasional" className="hover:text-white transition-colors">
                    Kasir &amp; Dapur KDS
                  </a>
                </li>
                <li>
                  <a href="#kelola-menu" className="hover:text-white transition-colors">
                    Katalog &amp; Manajemen Menu
                  </a>
                </li>
                <li>
                  <a href="#pembayaran" className="hover:text-white transition-colors">
                    Pembayaran &amp; Struk
                  </a>
                </li>
                <li>
                  <a href="#paket" className="hover:text-white transition-colors">
                    Rincian Paket
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ Operasional
                  </a>
                </li>
              </ul>
            </div>

            <div className="md:col-span-4 space-y-3">
              <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-stone-200">
                Tautan Aplikasi &amp; Konsultasi
              </h3>
              <ul className="space-y-2 text-xs text-stone-400">
                <li>
                  <Link href="/order?table=07" className="hover:text-white transition-colors">
                    Contoh Menu Pelanggan (Meja 07)
                  </Link>
                </li>
              </ul>

              <div className="pt-2">
                {hasValidWhatsapp ? (
                  <a
                    href={whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="touch-target inline-flex items-center gap-2 rounded-full bg-terracotta-500 hover:bg-terracotta-600 px-4 py-2.5 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta-500"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Chat WhatsApp Resmi</span>
                  </a>
                ) : (
                  <p className="font-mono text-[11px] text-stone-500">
                    WhatsApp resmi: menunggu konfigurasi NEXT_PUBLIC_B2B_WHATSAPP
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-2 text-xs text-stone-500 sm:flex-row font-mono">
            <p>© {new Date().getFullYear()} Cravio. Hak cipta dilindungi.</p>
            <p className="text-[11px]">
              Cravio — Your craving, perfectly matched
            </p>
          </div>
        </div>
      </footer>

      {/* ===================================================================== */}
      {/* CONSULTATION MODAL DIALOG                                             */}
      {/* ===================================================================== */}
      <ConsultationModal
        isOpen={isConsultModalOpen}
        onClose={() => setIsConsultModalOpen(false)}
        whatsappUrl={whatsappUrl}
        hasValidWhatsapp={hasValidWhatsapp}
      />
    </div>
  )
}
