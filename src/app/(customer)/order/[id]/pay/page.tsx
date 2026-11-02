import Link from 'next/link'
import {
  extractOrderSecretToken,
  verifyOrderAccess,
  OrderAccessError,
} from '@/lib/server/order-access'
import {
  getOrInitiateQrisPayment,
  PaymentServiceError,
} from '@/lib/server/payment-service'
import { OrderAccessDenied } from '@/components/order/order-access-denied'
import { PaymentClientView } from './payment-client-view'
import { formatIDR } from '@/lib/utils'

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
  } catch (err: unknown) {
    if (err instanceof OrderAccessError) {
      return <OrderAccessDenied />
    }
    return <OrderAccessDenied />
  }

  const isCash = order.paymentMethod === 'CASH'
  const isPaid = order.paymentStatus === 'PAID'

  // Jika QRIS dan belum berstatus PAID, inisialisasi atau ambil attempt aktif dari Midtrans
  let qrisData: Awaited<ReturnType<typeof getOrInitiateQrisPayment>> | null = null
  let paymentInitError: string | null = null

  if (!isCash && !isPaid) {
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
    <main className="min-h-screen p-4 max-w-md mx-auto flex flex-col justify-between pb-12">
      <div>
        {/* Header Pesanan */}
        <header className="py-3 border-b border-border mb-6 text-center">
          <div className="flex items-center justify-between text-xs text-brand/60 mb-1">
            <span>Meja {order.table.tableNumber}</span>
            <span className="font-semibold uppercase tracking-wider">
              {isCash ? 'Bayar di Kasir' : 'QRIS Dinamis'}
            </span>
          </div>
          <h1 className="text-xl font-sans font-bold text-brand">
            Pesanan #{order.orderNumber}
          </h1>
        </header>

        {/* Konten Berdasarkan Metode Pembayaran */}
        {isCash ? (
          <div className="space-y-4 my-6 text-left">
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>💵</span>
                <span>Silakan Menuju Kasir</span>
              </div>
              <p className="leading-relaxed">
                Tunjukkan nomor pesanan <strong>#{order.orderNumber}</strong> ke kasir SELA untuk menyelesaikan pembayaran tunai sebesar <strong>{formatIDR(order.totalAmount)}</strong>.
              </p>
            </div>
          </div>
        ) : isPaid ? (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs my-6 text-center space-y-2">
            <span className="text-2xl block">✅</span>
            <strong className="block text-sm font-bold">Pembayaran QRIS Berhasil</strong>
            <p>Pesanan Anda telah lunas dan sedang disiapkan oleh barista.</p>
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
