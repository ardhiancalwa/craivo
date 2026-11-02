import 'server-only'
import { prisma } from './db'
import { verifyOrderAccess } from './order-access'
import {
  chargeQris,
  getTransactionStatus,
  MidtransTimeoutError,
  MidtransGatewayError,
} from './midtrans'

export class PaymentServiceError extends Error {
  code: string
  statusCode: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any

  constructor(
    code: string,
    message: string,
    statusCode = 400,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any
  ) {
    super(message)
    this.name = 'PaymentServiceError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
  }
}

export interface InitiateQrisResult {
  attemptId: string
  merchantOrderId: string
  transactionId?: string | null
  grossAmount: number
  qrisString?: string | null
  qrisUrl?: string | null
  status: string
  expiresAt: string
  orderNumber: string
  reused: boolean
  alreadyPaid?: boolean
  paidAt?: string | null
}

export interface PaymentStatusCheckResult {
  paymentStatus: string
  orderStatus?: string
  paidAt?: string | null
  orderNumber?: string
  remainingSeconds?: number
  qrisString?: string | null
  qrisUrl?: string | null
  message?: string
}

/**
 * Menginisialisasi pembayaran QRIS melalui Midtrans Core API secara aman,
 * menggunakan nominal server snapshot dan mencegah charge ganda.
 */
export async function getOrInitiateQrisPayment(
  orderId: string,
  token?: string | null
): Promise<InitiateQrisResult> {
  // 1. Verifikasi Kepemilikan Order via Capability Token Guard (DEC-014)
  const order = await verifyOrderAccess(orderId, token)

  // 2. Validasi State Order
  if (order.paymentMethod !== 'QRIS') {
    throw new PaymentServiceError(
      'INVALID_PAYMENT_METHOD',
      `Pesanan #${order.orderNumber} menggunakan metode pembayaran ${order.paymentMethod}, bukan QRIS.`,
      400
    )
  }

  if (order.paymentStatus === 'PAID') {
    return {
      attemptId: '',
      merchantOrderId: '',
      grossAmount: order.totalAmount,
      status: 'PAID',
      expiresAt: '',
      orderNumber: order.orderNumber,
      reused: true,
      alreadyPaid: true,
      paidAt: order.paidAt?.toISOString() || null,
    }
  }

  if (order.orderStatus === 'CANCELLED') {
    throw new PaymentServiceError(
      'ORDER_CANCELLED',
      'Pesanan ini telah dibatalkan.',
      400
    )
  }

  const now = new Date()

  // 3. Cek Batas Kedaluwarsa Order (15 Menit)
  if (order.expiresAt && order.expiresAt < now) {
    if (order.paymentStatus !== 'EXPIRED') {
      await prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'EXPIRED' },
      })
    }
    throw new PaymentServiceError(
      'ORDER_EXPIRED',
      'Batas waktu pembayaran pesanan telah habis (15 menit). Silakan buat pesanan baru.',
      410
    )
  }

  // 4. Cari PaymentAttempt Aktif (status PENDING & belum kedaluwarsa)
  const activeAttempt = await prisma.paymentAttempt.findFirst({
    where: {
      orderId,
      status: 'PENDING',
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Kasus A: Attempt aktif sudah memiliki QR data -> REUSE IT (Nir-charge ganda)
  if (activeAttempt && activeAttempt.qrisString) {
    return {
      attemptId: activeAttempt.id,
      merchantOrderId: activeAttempt.merchantOrderId || activeAttempt.id,
      transactionId: activeAttempt.transactionId,
      grossAmount: activeAttempt.grossAmount,
      qrisString: activeAttempt.qrisString,
      qrisUrl: activeAttempt.qrisUrl,
      status: activeAttempt.status,
      expiresAt: activeAttempt.expiresAt.toISOString(),
      orderNumber: order.orderNumber,
      reused: true,
    }
  }

  // Kasus B: Attempt aktif ada tetapi belum memiliki transactionId (akibat network timeout sebelumnya)
  // Periksa ke Midtrans Get Status terlebih dahulu sebelum membuat transaksi baru
  if (activeAttempt && activeAttempt.merchantOrderId) {
    try {
      const midtransStatus = await getTransactionStatus(activeAttempt.merchantOrderId)
      if (!midtransStatus.notFound) {
        if (
          midtransStatus.transactionStatus === 'pending' ||
          midtransStatus.transactionStatus === 'settlement'
        ) {
          // Pulihkan data attempt dari Midtrans
          const updated = await prisma.paymentAttempt.update({
            where: { id: activeAttempt.id },
            data: {
              transactionId: midtransStatus.transactionId,
              status: midtransStatus.transactionStatus === 'settlement' ? 'PAID' : 'PENDING',
              rawResponse: JSON.stringify(midtransStatus.rawResponse),
            },
          })

          return {
            attemptId: updated.id,
            merchantOrderId: activeAttempt.merchantOrderId,
            transactionId: midtransStatus.transactionId,
            grossAmount: activeAttempt.grossAmount,
            qrisString: activeAttempt.qrisString,
            qrisUrl: activeAttempt.qrisUrl,
            status: updated.status,
            expiresAt: activeAttempt.expiresAt.toISOString(),
            orderNumber: order.orderNumber,
            reused: true,
          }
        }
      } else {
        // Transaksi tidak ditemukan di Midtrans (timeout terjadi sebelum Midtrans menerimanya)
        await prisma.paymentAttempt.update({
          where: { id: activeAttempt.id },
          data: { status: 'FAILED', rawResponse: 'TIMEOUT_NOT_FOUND_ON_GATEWAY' },
        })
      }
    } catch {
      // Jika pemeriksaan status gagal, lanjutkan pembuatan attempt baru jika attempt lama basi
    }
  }

  // Kasus C: Belum ada attempt aktif -> Buat attempt baru
  const attemptCount = await prisma.paymentAttempt.count({ where: { orderId } })
  const attemptEntropy = Math.random().toString(36).slice(2, 6)
  const merchantOrderId = `${order.orderNumber}-P${attemptCount + 1}-${attemptEntropy}`
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000) // 15 menit dari sekarang

  // 5. Pre-persist PaymentAttempt ke database SEBELUM memanggil gateway Midtrans
  const attempt = await prisma.paymentAttempt.create({
    data: {
      orderId,
      gateway: 'MIDTRANS',
      merchantOrderId,
      grossAmount: order.totalAmount, // Server-Authoritative Integer IDR
      status: 'PENDING',
      expiresAt,
    },
  })

  // Perbarui status pesanan menjadi PENDING dengan batas waktu pembayaran baru
  await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: 'PENDING',
      expiresAt,
    },
  })

  // 6. Panggil Midtrans Core API POST /v2/charge
  try {
    const chargeRes = await chargeQris({
      orderId: merchantOrderId,
      grossAmount: order.totalAmount, // Selalu nominal database snapshot
      expiryMinutes: 15,
    })

    // Perbarui PaymentAttempt dengan hasil gateway
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        transactionId: chargeRes.transactionId,
        qrisString: chargeRes.qrString || null,
        qrisUrl: chargeRes.qrUrl || null,
        rawResponse: JSON.stringify(chargeRes.rawResponse),
        status: 'PENDING',
      },
    })

    return {
      attemptId: attempt.id,
      merchantOrderId,
      transactionId: chargeRes.transactionId,
      grossAmount: order.totalAmount,
      qrisString: chargeRes.qrString || null,
      qrisUrl: chargeRes.qrUrl || null,
      status: 'PENDING',
      expiresAt: expiresAt.toISOString(),
      orderNumber: order.orderNumber,
      reused: false,
    }
  } catch (err: unknown) {
    if (err instanceof MidtransTimeoutError) {
      // JANGAN tandai attempt sebagai FAILED!
      // Biarkan PENDING agar dapat dipulihkan via Get Status pada polling berikutnya
      throw new PaymentServiceError(
        'GATEWAY_TIMEOUT_RECOVERABLE',
        'Koneksi ke gateway pembayaran Midtrans mengalami batas waktu. Sistem sedang memverifikasi respons gateway.',
        504,
        { merchantOrderId, attemptId: attempt.id }
      )
    }

    // Jika error gateway permanen (misal 400 Bad Request / 406 Invalid)
    await prisma.paymentAttempt
      .update({
        where: { id: attempt.id },
        data: {
          status: 'FAILED',
          rawResponse: JSON.stringify({
            error: err instanceof Error ? err.message : String(err),
            details: err instanceof MidtransGatewayError ? err.details : undefined,
          }),
        },
      })
      .catch(() => {})

    throw err
  }
}

/**
 * Memeriksa status transaksi pembayaran secara berkala ke gateway Midtrans
 * dan memperbarui status order jika pembayaran telah lunas (settlement).
 * Pelanggan TIDAK BISA memanipulasi status menjadi PAID secara langsung.
 */
export async function checkAndUpdatePaymentStatus(
  orderId: string,
  token?: string | null
): Promise<PaymentStatusCheckResult> {
  // 1. Verifikasi Hak Akses Capability Token
  const order = await verifyOrderAccess(orderId, token)

  if (order.paymentStatus === 'PAID') {
    return {
      paymentStatus: 'PAID',
      orderStatus: order.orderStatus,
      paidAt: order.paidAt?.toISOString() || null,
      orderNumber: order.orderNumber,
    }
  }

  // 2. Ambil attempt pembayaran terakhir
  const attempt = await prisma.paymentAttempt.findFirst({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
  })

  if (!attempt || !attempt.merchantOrderId) {
    return {
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      orderNumber: order.orderNumber,
    }
  }

  // 3. Panggil Midtrans Get Status secara resmi
  const midtransStatus = await getTransactionStatus(attempt.merchantOrderId)

  if (midtransStatus.notFound) {
    return {
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      message: 'Transaksi belum tercatat di gateway pembayaran.',
    }
  }

  const txStatus = midtransStatus.transactionStatus

  // Kasus A: Pembayaran Lunas (settlement / capture)
  if (txStatus === 'settlement' || txStatus === 'capture') {
    const paidAt = new Date()

    await prisma.$transaction(async (tx) => {
      // Ubah status order menjadi PAID dan buka gate KDS (orderStatus = QUEUED)
      await tx.order.update({
        where: { id: orderId },
        data: {
          paymentStatus: 'PAID',
          paidAt,
          orderStatus: 'QUEUED',
        },
      })

      // Update status attempt menjadi PAID
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'PAID',
          transactionId: midtransStatus.transactionId,
          rawResponse: JSON.stringify(midtransStatus.rawResponse),
        },
      })

      // Naikkan soldCount menu items
      for (const item of order.items) {
        if (item.menuItemId) {
          await tx.menuItem
            .update({
              where: { id: item.menuItemId },
              data: { soldCount: { increment: item.quantity } },
            })
            .catch(() => {})
        }
      }

      // Catat Audit Log
      await tx.auditLog.create({
        data: {
          orderId,
          action: 'PAYMENT_SETTLED_MIDTRANS',
          details: JSON.stringify({
            merchantOrderId: attempt.merchantOrderId,
            transactionId: midtransStatus.transactionId,
            grossAmount: midtransStatus.grossAmount,
            fraudStatus: midtransStatus.fraudStatus,
          }),
        },
      })
    })

    return {
      paymentStatus: 'PAID',
      orderStatus: 'QUEUED',
      paidAt: paidAt.toISOString(),
      orderNumber: order.orderNumber,
    }
  }

  // Kasus B: Kedaluwarsa (expire)
  if (txStatus === 'expire') {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'EXPIRED' },
      })
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'EXPIRED',
          rawResponse: JSON.stringify(midtransStatus.rawResponse),
        },
      })
    })

    return {
      paymentStatus: 'EXPIRED',
      orderStatus: order.orderStatus,
      orderNumber: order.orderNumber,
      message: 'Batas waktu pembayaran di gateway telah habis.',
    }
  }

  // Kasus C: Ditolak atau Dibatalkan (deny / cancel / failure)
  if (txStatus === 'deny' || txStatus === 'cancel' || txStatus === 'failure') {
    await prisma.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: 'FAILED',
        rawResponse: JSON.stringify(midtransStatus.rawResponse),
      },
    })

    return {
      paymentStatus: 'FAILED',
      orderStatus: order.orderStatus,
      orderNumber: order.orderNumber,
      message: 'Transaksi QRIS ditolak atau dibatalkan oleh gateway.',
    }
  }

  // Kasus D: Masih Menunggu Pembayaran (pending)
  const now = new Date()
  if (attempt.expiresAt < now) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'EXPIRED' },
      })
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: 'EXPIRED' },
      })
    })

    return {
      paymentStatus: 'EXPIRED',
      orderStatus: order.orderStatus,
      orderNumber: order.orderNumber,
      message: 'Batas waktu pembayaran telah habis.',
    }
  }

  const remainingSeconds = Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))

  return {
    paymentStatus: 'PENDING',
    orderStatus: order.orderStatus,
    orderNumber: order.orderNumber,
    remainingSeconds,
    qrisString: attempt.qrisString,
    qrisUrl: attempt.qrisUrl,
  }
}
