'use client'

import * as React from 'react'
import { Upload, CheckCircle2, Image as ImageIcon, RefreshCw, X } from 'lucide-react'
import { compressImage } from '@/lib/image-compressor'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'

interface PaymentProofUploaderProps {
  orderId: string
  orderNumber: string
  initialProofUrl?: string | null
  orderSecretToken?: string
}

export function PaymentProofUploader({
  orderId,
  orderNumber,
  initialProofUrl = null,
  orderSecretToken,
}: PaymentProofUploaderProps) {
  const { showToast } = useToast()
  const [proofUrl, setProofUrl] = React.useState<string | null>(initialProofUrl)
  const [isUploading, setIsUploading] = React.useState(false)
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return

    if (!rawFile.type.startsWith('image/')) {
      showToast('Format berkas tidak didukung. Harap pilih gambar (JPEG, PNG, WebP).', 'error')
      return
    }

    if (rawFile.size > 15 * 1024 * 1024) {
      showToast('Ukuran berkas terlalu besar (maksimal 15 MB).', 'error')
      return
    }

    setIsUploading(true)
    try {
      // Kompresi WebP otomatis di browser untuk pengunggahan kilat
      const file = await compressImage(rawFile, { maxWidth: 1200, maxHeight: 1200, quality: 0.85 })

      const formData = new FormData()
      formData.append('file', file)

      const headers: Record<string, string> = {}
      if (orderSecretToken) {
        headers['x-order-secret-token'] = orderSecretToken
      }

      const res = await fetch(`/api/orders/${orderId}/payment-proof`, {
        method: 'POST',
        headers,
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.message || 'Gagal mengunggah bukti pembayaran.')
      }

      setProofUrl(json.data.paymentProofUrl)
      showToast('Bukti pembayaran berhasil dikirimkan ke kasir!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unggah bukti gagal.'
      showToast(msg, 'error')
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface p-4 space-y-3 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-brand">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span>Bukti Pembayaran / Struk (Opsional)</span>
        </div>
        {proofUrl && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            Terkirim
          </span>
        )}
      </div>

      <p className="text-[11px] text-brand/70 leading-relaxed">
        {proofUrl
          ? 'Bukti transfer Anda telah terkirim ke kasir untuk verifikasi cepat. Kasir dapat langsung melihat foto bukti ini di layar POS.'
          : 'Unggah screenshot atau foto struk transfer Anda untuk mempermudah kasir mengonfirmasi pesanan saat antrean ramai. Atau Anda dapat langsung menunjukkan layar ke kasir.'}
      </p>

      {proofUrl ? (
        <div className="flex items-center gap-3 p-2.5 rounded-xl border border-outline-variant/60 bg-surface-lowest">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="relative w-14 h-14 rounded-lg overflow-hidden border border-outline-variant/60 bg-white shrink-0 hover:opacity-90 transition-opacity"
            title="Klik untuk melihat bukti ukuran penuh"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proofUrl}
              alt="Bukti Transfer"
              className="w-full h-full object-cover"
            />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-brand truncate">
              {proofUrl.split('/').pop() || 'bukti-transfer.webp'}
            </p>
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="text-[10px] text-primary font-bold hover:underline block mt-0.5"
            >
              Lihat Bukti Foto
            </button>
          </div>
          <label className="touch-target px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-low hover:bg-surface-container text-brand font-bold text-xs cursor-pointer flex items-center gap-1 transition-all shrink-0">
            <Upload className="w-3.5 h-3.5" />
            <span>Ganti</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={isUploading}
              onChange={handleFileChange}
            />
          </label>
        </div>
      ) : (
        <label className={cn(
          "flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-outline-variant/80 bg-surface-lowest hover:border-primary/50 hover:bg-surface-container-lowest transition-all cursor-pointer text-center",
          isUploading && "opacity-50 pointer-events-none"
        )}>
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-2">
            {isUploading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
          </div>
          <span className="text-xs font-bold text-brand">
            {isUploading ? 'Mengompresi & Mengunggah...' : 'Unggah Foto Bukti Transfer'}
          </span>
          <span className="text-[10px] text-brand/60 mt-0.5">
            Screenshot aplikasi bank / e-wallet (JPEG, PNG, WebP)
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={isUploading}
            onChange={handleFileChange}
          />
        </label>
      )}

      {/* Lightbox Preview Modal */}
      {isPreviewOpen && proofUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative max-w-lg w-full bg-surface rounded-2xl overflow-hidden border border-outline-variant shadow-2xl space-y-3 p-4">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2">
              <span className="text-xs font-bold text-brand font-mono">Bukti Bayar #{orderNumber}</span>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="p-1 rounded-lg text-brand/70 hover:text-brand hover:bg-surface-container transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto flex items-center justify-center bg-black/5 rounded-xl p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={proofUrl}
                alt="Bukti Transfer Penuh"
                className="max-h-[65vh] w-auto rounded-lg object-contain"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-xs font-bold text-brand transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

