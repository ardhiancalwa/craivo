'use client'

import React, { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatIDR } from '@/lib/utils'

interface PaymentClientViewProps {
  orderId: string
  orderNumber: string
  tableNumber: string
  totalAmount: number
  qrisUrl?: string | null
  qrString?: string | null
  expiresAt: string
  initialPaymentStatus: string
}

export function PaymentClientView({
  orderId,
  orderNumber,
  tableNumber,
  totalAmount,
  qrisUrl,
  qrString,
  expiresAt,
  initialPaymentStatus,
}: PaymentClientViewProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [paymentStatus, setPaymentStatus] = useState<string>(initialPaymentStatus)
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => {
    const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
    return Math.max(0, diff)
  })

  // Format detik menjadi MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Fungsi pengecekan status ke server
  const checkStatus = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsChecking(true)
      setStatusMessage(null)
    }

    try {
      const res = await fetch(`/api/orders/${orderId}/pay/status`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      const json = await res.json()

      if (json.success && json.data) {
        const newStatus = json.data.paymentStatus
        setPaymentStatus(newStatus)

        if (newStatus === 'PAID') {
          setStatusMessage('Pembayaran berhasil dikonfirmasi! Mengalihkan...')
          setTimeout(() => {
            startTransition(() => {
              router.push(`/order/${orderId}/track`)
            })
          }, 1500)
          return
        }

        if (newStatus === 'EXPIRED') {
          setStatusMessage('Batas waktu pembayaran pesanan telah habis.')
          return
        }

        if (isManual) {
          setStatusMessage('Pembayaran belum diterima. Silakan selesaikan transaksi pada e-wallet Anda.')
        }
      }
    } catch {
      if (isManual) {
        setStatusMessage('Gagal menghubungi server untuk verifikasi status.')
      }
    } finally {
      if (isManual) {
        setIsChecking(false)
      }
    }
  }, [orderId, router])

  // Countdown timer 1 detik
  useEffect(() => {
    if (paymentStatus === 'PAID' || paymentStatus === 'EXPIRED') return

    const timer = setInterval(() => {
      const diff = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      if (diff <= 0) {
        setRemainingSeconds(0)
        setPaymentStatus('EXPIRED')
        clearInterval(timer)
        checkStatus(false)
      } else {
        setRemainingSeconds(diff)
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [expiresAt, paymentStatus, checkStatus])

  // Auto-polling setiap 5 detik (hanya saat tab aktif dan belum lunas)
  useEffect(() => {
    if (paymentStatus === 'PAID' || paymentStatus === 'EXPIRED') return

    const interval = setInterval(() => {
      if (!document.hidden) {
        checkStatus(false)
      }
    }, 5000)

    const handleVisibilityChange = () => {
      if (!document.hidden && paymentStatus !== 'PAID' && paymentStatus !== 'EXPIRED') {
        checkStatus(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [paymentStatus, checkStatus])

  const isExpired = paymentStatus === 'EXPIRED' || remainingSeconds <= 0
  const isPaid = paymentStatus === 'PAID'
  const isUrgent = remainingSeconds < 180 && !isExpired

  return (
    <div className="space-y-6 text-center">
      {/* Status Bar / Countdown */}
      {isPaid ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5 animate-in fade-in duration-300">
          <div className="text-2xl">✅</div>
          <p className="text-sm font-bold">Pembayaran QRIS Terverifikasi Lunas</p>
          <p className="text-emerald-700">Terima kasih! Pesanan Anda segera disiapkan barista.</p>
        </div>
      ) : isExpired ? (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-2">
          <div className="text-2xl">⏰</div>
          <p className="text-sm font-bold">Batas Waktu Pembayaran Telah Habis</p>
          <p className="text-rose-700 leading-relaxed">
            Kode QRIS ini telah kedaluwarsa (15 menit). Silakan buat pesanan baru melalui katalog menu.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-block px-4 py-2 rounded-xl bg-brand text-cream text-xs font-semibold hover:bg-brand/90 transition-colors"
            >
              Kembali ke Menu
            </Link>
          </div>
        </div>
      ) : (
        <div
          className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
            isUrgent
              ? 'bg-rose-100 text-rose-900 animate-pulse'
              : 'bg-amber-100 text-amber-900'
          }`}
        >
          <span>⏱ Sisa Waktu Bayar:</span>
          <span className="font-price-tabular font-bold text-sm tracking-wider">
            {formatTime(remainingSeconds)}
          </span>
        </div>
      )}

      {/* Box QR Code Resmi Midtrans */}
      {!isPaid && !isExpired && (
        <div className="bg-surface border border-border rounded-3xl p-6 shadow-sm flex flex-col items-center">
          <div className="w-full flex items-center justify-between text-xs text-brand/60 pb-3 border-b border-border/60 mb-4">
            <span className="font-medium">Meja {tableNumber} • SELA Artisanal Coffee</span>
            <span className="font-mono uppercase font-bold text-[11px] bg-brand/5 px-2 py-0.5 rounded">
              QRIS Dinamis
            </span>
          </div>

          {/* QR Code Container */}
          <div className="relative p-3 bg-white rounded-2xl border-2 border-border shadow-inner flex items-center justify-center">
            {qrisUrl ? (
              // Menggunakan tag img standar untuk kompatibilitas penuh render gambar eksternal Midtrans
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrisUrl}
                alt={`QRIS Pesanan ${orderNumber}`}
                width={240}
                height={240}
                className="w-56 h-56 object-contain rounded-lg"
              />
            ) : qrString ? (
              <div className="w-56 h-56 flex flex-col items-center justify-center text-xs text-brand/70 p-4 bg-muted/20 rounded-lg text-center break-all">
                <span className="font-mono text-[10px] leading-tight select-all">
                  {qrString}
                </span>
              </div>
            ) : (
              <div className="w-56 h-56 flex flex-col items-center justify-center text-xs text-brand/60 space-y-2">
                <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                <span>Memuat kode QR resmi...</span>
              </div>
            )}
          </div>

          {/* Total Tagihan Resmi */}
          <div className="mt-4 pt-3 w-full border-t border-border/60 text-center space-y-1">
            <p className="text-xs text-brand/60 font-medium">Total Nominal Resmi</p>
            <p className="text-2xl font-sans font-bold text-brand font-price-tabular">
              {formatIDR(totalAmount)}
            </p>
            <p className="text-[11px] text-brand/50">Sudah termasuk PPN 0% & Service 0%</p>
          </div>

          {/* Aksi Unduh / Buka QR */}
          {qrisUrl && (
            <div className="mt-4 w-full flex gap-2">
              <a
                href={qrisUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="touch-target flex-1 py-2.5 px-3 rounded-xl bg-brand/5 hover:bg-brand/10 border border-border text-brand text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>📥</span>
                <span>Unduh / Buka QR</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Panduan Pembayaran Satu Ponsel */}
      {!isPaid && !isExpired && (
        <div className="text-left bg-surface/60 border border-border rounded-2xl p-4 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-brand">
            <span>📱</span>
            <span>Cara Bayar Langsung dari Ponsel Ini</span>
          </div>

          <ol className="space-y-2 text-brand/80 list-decimal pl-4 leading-relaxed">
            <li>
              <strong>Simpan / Tangkap Layar</strong> gambar QR Code di atas, atau klik tombol <em>Unduh QR</em>.
            </li>
            <li>
              Buka aplikasi <strong>m-Banking</strong> atau <strong>e-Wallet</strong> pilihan Anda (BCA, Mandiri, GoPay, OVO, ShopeePay, Dana, dll).
            </li>
            <li>
              Pilih menu <strong>Pindai / Bayar QRIS</strong>, lalu pilih ikon <strong>Galeri Foto</strong> untuk memuat gambar QR yang baru disimpan.
            </li>
            <li>
              Pastikan penerima adalah <strong>SELA Artisanal Coffee</strong> dengan nominal tepat <strong>{formatIDR(totalAmount)}</strong>, lalu masukkan PIN.
            </li>
          </ol>

          <p className="text-[11px] text-brand/60 italic pt-1 border-t border-border/40">
            Catatan: Bila aplikasi pembayaran Anda tidak mendukung fitur pindai dari galeri, silakan pindai kode QR di layar ini menggunakan ponsel rekan atau perangkat lain.
          </p>
        </div>
      )}

      {/* Manual Check Status Button */}
      {!isPaid && !isExpired && (
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => checkStatus(true)}
            disabled={isChecking}
            className="touch-target w-full py-3 px-4 rounded-xl bg-surface border border-border hover:bg-brand/5 active:scale-[0.99] text-brand text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-60"
          >
            {isChecking ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                <span>Memverifikasi ke Gateway...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Saya Sudah Membayar — Cek Status</span>
              </>
            )}
          </button>

          {statusMessage && (
            <p className="text-[11px] text-brand/70 animate-in fade-in duration-200">
              {statusMessage}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

