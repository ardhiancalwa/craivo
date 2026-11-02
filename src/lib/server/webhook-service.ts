import 'server-only'
import { z } from 'zod'
import { prisma } from './db'
import {
  verifyMidtransSignature,
  parseAndValidateIdrAmount,
} from './midtrans'

export class WebhookSecurityError extends Error {
  statusCode: number

  constructor(message = 'Signature verifikasi webhook Midtrans tidak valid.', statusCode = 403) {
    super(message)
    this.name = 'WebhookSecurityError'
    this.statusCode = statusCode
  }
}

export class WebhookValidationError extends Error {
  statusCode: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  details?: any

  constructor(
    message: string,
    statusCode = 400,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details?: any
  ) {
    super(message)
    this.name = 'WebhookValidationError'
    this.statusCode = statusCode
    this.details = details
  }
}

export interface WebhookProcessResult {
  success: boolean
  orderId?: string
  merchantOrderId?: string
  transactionStatus?: string
  deduplicated?: boolean
  ignored?: boolean
  settled?: boolean
  message: string
}

const MidtransWebhookPayloadSchema = z.object({
  order_id: z.string().min(1, 'order_id wajib diisi'),
  status_code: z.string().min(1, 'status_code wajib diisi'),
  gross_amount: z.string().min(1, 'gross_amount wajib diisi'),
  signature_key: z.string().min(1, 'signature_key wajib diisi'),
  transaction_status: z.string().min(1, 'transaction_status wajib diisi'),
  transaction_id: z.string().min(1, 'transaction_id wajib diisi'),
  payment_type: z.string().min(1, 'payment_type wajib diisi'),
  currency: z.string().optional().default('IDR'),
  fraud_status: z.string().optional(),
  settlement_time: z.string().optional(),
  transaction_time: z.string().optional(),
  status_message: z.string().optional(),
}).passthrough()

export type MidtransWebhookPayload = z.infer<typeof MidtransWebhookPayloadSchema>

/**
 * Memproses payload notifikasi webhook Midtrans secara aman, idempoten, dan atomik.
 */
export async function processMidtransWebhook(
  rawPayload: unknown
): Promise<WebhookProcessResult> {
  // 1. Validasi Schema Payload
  const parsed = MidtransWebhookPayloadSchema.safeParse(rawPayload)
  if (!parsed.success) {
    throw new WebhookValidationError(
      'Format payload webhook Midtrans tidak memenuhi spesifikasi.',
      400,
      parsed.error.flatten()
    )
  }

  const payload = parsed.data

  // 2. Verifikasi Kriptografis SHA-512 menggunakan string asli gross_amount
  const isSignatureValid = verifyMidtransSignature({
    orderId: payload.order_id,
    statusCode: payload.status_code,
    grossAmount: payload.gross_amount,
    signatureKey: payload.signature_key,
  })

  if (!isSignatureValid) {
    throw new WebhookSecurityError(
      'Signature SHA-512 tidak valid. Permintaan callback ditolak.',
      403
    )
  }

  // 3. Parsing Uang Aman Tanpa Float/ParseInt (menolak desimal tidak sah pada IDR)
  let parsedAmount: number
  try {
    parsedAmount = parseAndValidateIdrAmount(payload.gross_amount)
  } catch (err: unknown) {
    throw new WebhookValidationError(
      err instanceof Error ? err.message : 'Nominal gross_amount tidak valid.',
      400
    )
  }

  // 4. Cari PaymentAttempt dan Order Terkait di Database
  const attempt = await prisma.paymentAttempt.findFirst({
    where: {
      OR: [
        { merchantOrderId: payload.order_id },
        { id: payload.order_id },
      ],
    },
    include: {
      order: {
        include: {
          items: true,
          table: true,
        },
      },
    },
  })

  if (!attempt || !attempt.order) {
    // Coba fallback cari berdasarkan orderNumber jika merchantOrderId belum tersimpan
    const orderFallback = await prisma.order.findUnique({
      where: { orderNumber: payload.order_id },
      include: { items: true, table: true },
    })

    if (!orderFallback) {
      throw new WebhookValidationError(
        `Pesanan dengan order_id ${payload.order_id} tidak ditemukan di sistem.`,
        404
      )
    }

    throw new WebhookValidationError(
      `Attempt pembayaran tidak valid untuk pesanan ${payload.order_id}.`,
      400
    )
  }

  const order = attempt.order

  // 5. Validasi Kecocokan Finansial & Data Pesanan
  if (payload.currency !== 'IDR') {
    throw new WebhookValidationError(
      `Mata uang tidak sesuai. Diharapkan IDR, diterima: ${payload.currency}`,
      400
    )
  }

  if (payload.payment_type !== 'qris' && order.paymentMethod === 'QRIS') {
    throw new WebhookValidationError(
      `Metode pembayaran tidak sesuai. Diharapkan qris, diterima: ${payload.payment_type}`,
      400
    )
  }

  if (parsedAmount !== order.totalAmount) {
    throw new WebhookValidationError(
      `Amount mismatch: nominal callback (${parsedAmount}) tidak sesuai dengan snapshot pesanan (${order.totalAmount}).`,
      400
    )
  }

  const txStatus = payload.transaction_status

  // 6. Penegakan Khusus QRIS Success Mapping:
  // Sesuai dokumentasi Midtrans: QRIS HANYA menerima 'settlement' sebagai status sukses.
  // Jangan pernah menerima 'capture' generik alur kartu kredit sebagai sukses QRIS.
  if (txStatus === 'capture' && payload.payment_type === 'qris') {
    throw new WebhookValidationError(
      "Status 'capture' tidak sah untuk alur pembayaran QRIS. Transaksi QRIS harus 'settlement'.",
      400
    )
  }

  // 7. Idempotensi & Out-of-Order Safety untuk Order yang Sudah PAID
  if (order.paymentStatus === 'PAID') {
    if (txStatus === 'settlement') {
      // Callback settlement duplikat -> respons idempoten 200 OK
      return {
        success: true,
        orderId: order.id,
        merchantOrderId: payload.order_id,
        transactionStatus: txStatus,
        deduplicated: true,
        message: 'Notifikasi pembayaran berulang diterima dan dideduplikasi secara aman.',
      }
    }

    // Callback out-of-order (misal 'pending' atau 'expire' yang tiba terlambat setelah order lunas)
    // JANGAN PERNAH menurunkan status pesanan yang sudah PAID!
    await prisma.auditLog.create({
      data: {
        orderId: order.id,
        action: 'OUT_OF_ORDER_NOTIFICATION_IGNORED',
        details: JSON.stringify({
          merchantOrderId: payload.order_id,
          receivedStatus: txStatus,
          currentPaymentStatus: order.paymentStatus,
          message: 'Notifikasi gateway yang tiba terlambat diabaikan untuk melindungi status lunas.',
        }),
      },
    }).catch(() => {})

    return {
      success: true,
      orderId: order.id,
      merchantOrderId: payload.order_id,
      transactionStatus: txStatus,
      ignored: true,
      message: `Notifikasi out-of-order (${txStatus}) diabaikan karena pesanan telah lunas.`,
    }
  }

  // 8. Pemrosesan Transisi Status Atomik (Belum Lunas -> Selesai / Gagal)
  const isSettlement = txStatus === 'settlement'
  const isExpire = txStatus === 'expire'
  const isFailed = txStatus === 'deny' || txStatus === 'cancel' || txStatus === 'failure'

  const settlementTime = payload.settlement_time
    ? new Date(payload.settlement_time)
    : new Date()

  try {
    return await prisma.$transaction(async (tx) => {
      // Conditional read check dalam transaksi
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
      })

      if (!currentOrder) {
        throw new WebhookValidationError('Order tidak ditemukan dalam transaksi.', 404)
      }

      if (currentOrder.paymentStatus === 'PAID') {
        return {
          success: true,
          orderId: order.id,
          merchantOrderId: payload.order_id,
          transactionStatus: txStatus,
          deduplicated: true,
          message: 'Pesanan telah dilunaskan oleh proses paralel lain.',
        }
      }

      // KASUS A: Pembayaran Berhasil (settlement)
      if (isSettlement) {
        // 1. Update Order menjadi PAID dan buka gate antrean KDS (orderStatus = QUEUED)
        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: 'PAID',
            paidAt: settlementTime,
            orderStatus: 'QUEUED',
          },
        })

        // 2. Update PaymentAttempt menjadi PAID
        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'PAID',
            transactionId: payload.transaction_id,
            rawResponse: JSON.stringify(payload),
          },
        })

        // 3. Increment soldCount pada setiap menu item
        for (const item of order.items) {
          if (item.menuItemId) {
            await tx.menuItem.update({
              where: { id: item.menuItemId },
              data: {
                soldCount: { increment: item.quantity },
              },
            }).catch(() => {})
          }
        }

        // 4. Menerbitkan tepat SATU durable OutboxEvent untuk sinkronisasi KDS
        await tx.outboxEvent.create({
          data: {
            channel: 'KDS',
            aggregateType: 'ORDER',
            aggregateId: order.id,
            eventType: 'ORDER_PAID',
            payload: JSON.stringify({
              orderId: order.id,
              orderNumber: order.orderNumber,
              tableNumber: order.table.tableNumber,
              totalAmount: order.totalAmount,
              paidAt: settlementTime.toISOString(),
            }),
          },
        })

        // Menerbitkan event untuk pelacak pesanan pelanggan
        await tx.outboxEvent.create({
          data: {
            channel: `ORDER:${order.id}`,
            aggregateType: 'ORDER',
            aggregateId: order.id,
            eventType: 'PAYMENT_CONFIRMED',
            payload: JSON.stringify({
              orderId: order.id,
              orderNumber: order.orderNumber,
              paymentStatus: 'PAID',
              paidAt: settlementTime.toISOString(),
            }),
          },
        })

        // 5. Catat AuditLog
        await tx.auditLog.create({
          data: {
            orderId: order.id,
            action: 'PAYMENT_SETTLED_WEBHOOK',
            details: JSON.stringify({
              merchantOrderId: payload.order_id,
              transactionId: payload.transaction_id,
              grossAmount: parsedAmount,
              paymentType: payload.payment_type,
            }),
          },
        })

        return {
          success: true,
          orderId: order.id,
          merchantOrderId: payload.order_id,
          transactionStatus: txStatus,
          settled: true,
          message: 'Pembayaran QRIS berhasil diselesaikan melalui webhook Midtrans.',
        }
      }

      // KASUS B: Pembayaran Kedaluwarsa (expire)
      if (isExpire) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'EXPIRED' },
        })

        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'EXPIRED',
            transactionId: payload.transaction_id,
            rawResponse: JSON.stringify(payload),
          },
        })

        await tx.auditLog.create({
          data: {
            orderId: order.id,
            action: 'PAYMENT_EXPIRED_WEBHOOK',
            details: JSON.stringify({
              merchantOrderId: payload.order_id,
              transactionId: payload.transaction_id,
            }),
          },
        })

        return {
          success: true,
          orderId: order.id,
          merchantOrderId: payload.order_id,
          transactionStatus: txStatus,
          message: 'Status pesanan diperbarui menjadi EXPIRED melalui webhook.',
        }
      }

      // KASUS C: Pembayaran Gagal / Ditolak / Dibatalkan
      if (isFailed) {
        await tx.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'FAILED' },
        })

        await tx.paymentAttempt.update({
          where: { id: attempt.id },
          data: {
            status: 'FAILED',
            transactionId: payload.transaction_id,
            rawResponse: JSON.stringify(payload),
          },
        })

        await tx.auditLog.create({
          data: {
            orderId: order.id,
            action: 'PAYMENT_FAILED_WEBHOOK',
            details: JSON.stringify({
              merchantOrderId: payload.order_id,
              transactionId: payload.transaction_id,
              reason: txStatus,
            }),
          },
        })

        return {
          success: true,
          orderId: order.id,
          merchantOrderId: payload.order_id,
          transactionStatus: txStatus,
          message: `Status pesanan diperbarui menjadi FAILED (${txStatus}).`,
        }
      }

      // KASUS D: Status Pending
      await tx.paymentAttempt.update({
        where: { id: attempt.id },
        data: {
          transactionId: payload.transaction_id,
          rawResponse: JSON.stringify(payload),
        },
      })

      return {
        success: true,
        orderId: order.id,
        merchantOrderId: payload.order_id,
        transactionStatus: txStatus,
        message: 'Status pending tercatat.',
      }
    })
  } catch (dbErr: unknown) {
    if (dbErr instanceof WebhookValidationError || dbErr instanceof WebhookSecurityError) {
      throw dbErr
    }
    // Jika penyimpanan database gagal, kembalikan error retryable (500) agar gateway Midtrans mengulang callback
    console.error('Database transaction failure during Midtrans webhook processing:', dbErr)
    throw new Error('Gagal menyimpan pembaruan transaksi ke database (retryable).')
  }
}

export { processMidtransWebhook as handleMidtransWebhook }


