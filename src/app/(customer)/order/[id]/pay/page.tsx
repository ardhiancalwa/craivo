import Link from 'next/link'
import Image from 'next/image'
import {
  extractOrderSecretToken,
  verifyOrderAccess,
} from '@/lib/server/order-access'
import {
  getOrInitiateQrisPayment,
  PaymentServiceError,
} from '@/lib/server/payment-service'
import { getCafeConfig } from '@/lib/server/config-service'
import { OrderAccessDenied } from '@/components/order/order-access-denied'
import { PaymentClientView } from './payment-client-view'
import { PaymentProofUploader } from '@/components/payment/payment-proof-uploader'
import { formatIDR } from '@/lib/utils'
import { getServerEnv } from '@/lib/server/env'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function OrderPaymentPage({ params }: PageProps) {
  const { id } = await params

  let order: Awaited<ReturnType<typeof verifyOrderAccess>>
  let token: string | null = null

  try {
    token = await extractOrderSecretToken(id)
    order = await verifyOrderAccess(id, token)
  } catch {
    return <OrderAccessDenied />
  }

  const cafeConfig = await getCafeConfig()

  const isCash = order.paymentMethod === 'CASH'
  const isManualQris = order.paymentMethod === 'MANUAL_QRIS'
  const isManualTransfer = order.paymentMethod === 'MANUAL_TRANSFER'
  const isMidtransQris = order.paymentMethod === 'QRIS'
  const isPaid = order.paymentStatus === 'PAID'

  // Jika QRIS Dinamis Midtrans dan belum berstatus PAID, inisialisasi atau ambil attempt aktif dari Midtrans
  let qrisData: Awaited<ReturnType<typeof getOrInitiateQrisPayment>> | null = null
  let paymentInitError: string | null = null

  if (isMidtransQris && !isPaid) {
    try {
      qrisData = await getOrInitiateQrisPayment(id, token)
    } catch (err: unknown) {
      if (err instanceof PaymentServiceError) {
        paymentInitError = err.message
      } else {
        paymentInitError = 'Gagal memuat kode QRIS pembayaran dari gateway. Silakan refresh halaman.'
      }
    }
  }

  return (
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col justify-between pb-12 font-sans">
      <div>
        {/* Header Pesanan */}
        <header className="py-3 border-b border-border mb-6 text-center">
          <div className="flex items-center justify-between text-xs text-brand/60 mb-1">
            <span>Meja {order.table.tableNumber}</span>
            <span className="font-semibold uppercase tracking-wider">
              {isCash
                ? 'Bayar Tunai di Kasir'
                : isManualQris
                ? 'QRIS Toko'
                : isManualTransfer
                ? 'Transfer Bank'
                : 'QRIS Dinamis'}
            </span>
          </div>
          <h1 className="text-xl font-sans font-bold text-brand">
            Pesanan #{order.orderNumber}
          </h1>
        </header>

        {/* Konten Berdasarkan Metode Pembayaran */}
        {isPaid ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs my-6 text-center space-y-2">
            <span className="text-2xl block">✅</span>
            <strong className="block text-sm font-bold">Pembayaran Berhasil Dikonfirmasi</strong>
            <p>Pesanan Anda telah lunas dan sedang disiapkan oleh barista.</p>
          </div>
        ) : isCash ? (
          <div className="space-y-4 my-6 text-left">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>💵</span>
                <span>Silakan Menuju Kasir</span>
              </div>
              <p className="leading-relaxed">
                Tunjukkan nomor pesanan <strong>#{order.orderNumber}</strong> ke kasir CRAIVO untuk menyelesaikan pembayaran tunai sebesar <strong>{formatIDR(order.totalAmount)}</strong>.
              </p>
            </div>
          </div>
        ) : isManualQris ? (
          <div className="space-y-4 my-6 text-center">
            <div className="p-5 rounded-3xl bg-surface border border-outline-variant shadow-level1 space-y-3.5">
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-brand">
                <span>📱</span>
                <span>{cafeConfig.manualQrisName || 'QRIS Toko CRAIVO'}</span>
              </div>

              <div className="p-3 bg-white rounded-2xl border border-sand-200 inline-block shadow-xs">
                {cafeConfig.manualQrisImageUrl ? (
                  <Image
                    src={cafeConfig.manualQrisImageUrl}
                    alt="QRIS Toko"
                    width={220}
                    height={220}
                    className="mx-auto rounded-lg object-contain max-h-[240px]"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex flex-col items-center justify-center text-stone-400 text-xs p-4 bg-sand-50 rounded-lg">
                    <span className="text-3xl mb-2">📸</span>
                    <span>Barcode QRIS Kafe</span>
                    <span className="text-[10px] mt-1 text-stone-500">Silakan scan QRIS di meja kasir</span>
                  </div>
                )}
              </div>

              <div className="bg-sand-50/80 p-3 rounded-2xl border border-sand-200 text-xs text-left space-y-1">
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Pembayaran:</span>
                  <strong className="text-sm font-bold text-accent font-price-tabular">
                    {formatIDR(order.totalAmount)}
                  </strong>
                </div>
                <p className="text-[11px] text-stone-600 pt-1 border-t border-sand-200/60 leading-relaxed">
                  Pindai barcode QRIS di atas dengan GoPay, OVO, Dana, BCA, Livin, atau e-wallet lainnya. Setelah berhasil bayar, tunjukkan bukti bayar ke kasir.
                </p>
              </div>
            </div>

            <PaymentProofUploader
              orderId={order.id}
              orderNumber={order.orderNumber}
              initialProofUrl={order.paymentProofUrl}
              orderSecretToken={token || undefined}
            />
          </div>
        ) : isManualTransfer ? (
          <div className="space-y-4 my-6 text-left">
            <div className="p-5 rounded-3xl bg-surface border border-outline-variant shadow-level1 space-y-3.5">
              <div className="flex items-center gap-2 font-bold text-xs text-brand">
                <span>🏦</span>
                <span>Transfer Bank / E-Wallet Manual</span>
              </div>

              <div className="p-4 rounded-2xl bg-sand-50 border border-sand-200 text-xs space-y-2">
                <div className="flex justify-between text-stone-600">
                  <span>Nama Bank / E-Wallet:</span>
                  <strong className="text-brand font-bold uppercase">{cafeConfig.manualTransferBank || 'BCA'}</strong>
                </div>
                <div className="flex justify-between text-stone-600 items-center">
                  <span>Nomor Rekening:</span>
                  <strong className="text-sm font-mono font-bold text-brand bg-white px-2 py-0.5 rounded border border-sand-200">
                    {cafeConfig.manualTransferAccount || 'Hubungi Kasir'}
                  </strong>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Atas Nama:</span>
                  <strong className="text-brand">{cafeConfig.manualTransferName || 'Cravio Cafe'}</strong>
                </div>
                <div className="flex justify-between pt-2 border-t border-sand-200 text-stone-700">
                  <span>Total Tagihan:</span>
                  <strong className="text-sm font-bold text-accent font-price-tabular">
                    {formatIDR(order.totalAmount)}
                  </strong>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Silakan transfer nominal pas ke rekening di atas. Setelah transfer, tunjukkan bukti transfer ke kasir untuk konfirmasi lunas.
              </p>
            </div>

            <PaymentProofUploader
              orderId={order.id}
              orderNumber={order.orderNumber}
              initialProofUrl={order.paymentProofUrl}
              orderSecretToken={token || undefined}
            />
          </div>
        ) : paymentInitError ? (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs my-6 text-center space-y-2">
            <span className="text-2xl block">⚠️</span>
            <strong className="block text-sm font-bold">Inisialisasi Pembayaran Terkendala</strong>
            <p>{paymentInitError}</p>
          </div>
        ) : qrisData ? (
          <PaymentClientView
            orderId={order.id}
            orderNumber={order.orderNumber}
            tableNumber={order.table.tableNumber}
            totalAmount={order.totalAmount}
            qrisUrl={qrisData.qrisUrl}
            qrString={qrisData.qrisString}
            expiresAt={qrisData.expiresAt}
            initialPaymentStatus={qrisData.status}
            isProduction={getServerEnv().MIDTRANS_IS_PRODUCTION}
          />
        ) : null}

        {/* Ringkasan Snapshot Menu */}
        <section className="mt-8 text-left border border-border rounded-2xl p-4 bg-surface space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-brand/70 border-b border-border/60 pb-2">
            Rincian Menu ({order.items.length} item)
          </h2>
          <div className="space-y-2.5">
            {order.items.map((it) => (
              <div key={it.id} className="text-xs space-y-1">
                <div className="flex justify-between font-medium text-brand">
                  <span>
                    {it.quantity}x {it.nameSnapshot}
                  </span>
                  <span className="font-price-tabular font-semibold">
                    {formatIDR(it.subtotal)}
                  </span>
                </div>
                {it.modifiers.length > 0 && (
                  <p className="text-[11px] text-brand/60 pl-3">
                    {it.modifiers.map((m) => m.nameSnapshot).join(', ')}
                  </p>
                )}
                {it.notes && (
                  <p className="text-[11px] italic text-brand/50 pl-3">
                    &ldquo;{it.notes}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="pt-6 border-t border-border space-y-3 mt-6">
        <Link
          href={`/order/${id}/track`}
          className="touch-target w-full inline-flex items-center justify-center py-3 rounded-xl bg-brand text-cream text-xs font-semibold hover:bg-brand/90 transition-colors shadow-sm"
        >
          Lihat Status Pesanan →
        </Link>
        <Link
          href={`/order/${id}/receipt`}
          className="touch-target w-full inline-flex items-center justify-center py-2 text-xs text-brand/70 hover:text-brand"
        >
          Lihat Lembar Tagihan (Struk)
        </Link>
      </div>
    </main>
  )
}
