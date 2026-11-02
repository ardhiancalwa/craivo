'use client'

import * as React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, MessageSquare, ExternalLink } from 'lucide-react'

export interface ConsultationModalProps {
  isOpen: boolean
  onClose: () => void
  whatsappUrl: string
  hasValidWhatsapp: boolean
}

export function ConsultationModal({
  isOpen,
  onClose,
  whatsappUrl,
  hasValidWhatsapp,
}: ConsultationModalProps) {
  const [demoNotice, setDemoNotice] = React.useState(false)

  React.useEffect(() => {
    if (!isOpen) setDemoNotice(false)
  }, [isOpen])

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop with Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal Dialog Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="consultation-modal-title"
            className="relative bg-white rounded-2xl max-w-md w-full p-6 border border-stone-200 shadow-2xl space-y-4 z-10"
          >
            <div className="flex items-center justify-between pb-3 border-b border-sand-200">
              <h3
                id="consultation-modal-title"
                className="font-semibold text-base text-charcoal-950 font-display"
              >
                Diskusikan untuk Kafe Saya
              </h3>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup dialog konsultasi"
                className="w-7 h-7 rounded-full bg-sand-100 flex items-center justify-center text-stone-500 hover:text-charcoal-950 font-bold text-xs transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Silakan hubungi tim kami untuk konsultasi layout QR meja, penyesuaian menu, atau demo teknis integrasi kasir.
            </p>

            <div className="bg-sand-50 border border-sand-200 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-charcoal-950">Kanal Konsultasi:</span>
                <span className="text-emerald-700 font-semibold flex items-center gap-1 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  WhatsApp Resmi
                </span>
              </div>
              <p className="text-stone-500">Nomor WhatsApp perwakilan produk:</p>
              {hasValidWhatsapp ? (
                <div className="p-2.5 bg-white rounded-lg border border-sand-200 font-mono text-charcoal-950 font-semibold text-center select-all">
                  Nomor Bisnis Resmi Cravio
                </div>
              ) : (
                <div className="p-2.5 bg-white rounded-lg border border-sand-200 font-mono text-charcoal-950 font-semibold text-center select-all">
                  +62 812-XXXX-XXXX (Placeholder Konfigurasi)
                </div>
              )}
              {!hasValidWhatsapp && (
                <p className="text-[10px] text-stone-400 italic text-center">
                  *Nomor resmi akan dihubungkan saat onboarding domain produksi.
                </p>
              )}
            </div>

            {demoNotice && (
              <div className="w-full p-3 rounded-2xl bg-sky-50/95 border border-sky-200/80 text-sky-950 flex items-start gap-2.5 text-xs animate-in fade-in duration-200">
                <div className="w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center shrink-0 text-[11px] font-bold mt-0.5">
                  i
                </div>
                <div>
                  <span className="font-bold block">Mode Demonstrasi Interaktif</span>
                  <span className="text-[11px] text-sky-900/80 leading-relaxed block">
                    Nomor WhatsApp resmi akan aktif saat peluncuran produksi kafe Anda.
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Tutup
              </button>
              {hasValidWhatsapp ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 rounded-lg bg-charcoal-950 text-white text-xs font-semibold hover:bg-charcoal-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Buka WhatsApp</span>
                  <ExternalLink className="w-3 h-3 text-stone-400" />
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setDemoNotice(true)}
                  className="flex-1 py-2.5 rounded-lg bg-charcoal-950 text-white text-xs font-semibold hover:bg-charcoal-800 transition-colors cursor-pointer"
                >
                  Lanjut ke WhatsApp
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

