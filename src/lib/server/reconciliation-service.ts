import 'server-only'
import { prisma } from './db'
import {
  getTransactionStatus,
  expireTransaction,
} from './midtrans'

export interface ReconciliationOptions {
  dryRun?: boolean
  limit?: number
}

export interface ReconciliationResult {
  success: boolean
  totalScanned: number
  settledCount: number
  settledAfterExpiryCount: number
  expiredCount: number
  failedCount: number
  errors: Array<{ orderId: string; error: string }>
}

/**
 * Service rekonsiliasi terjadwal untuk memeriksa dan menyelesaikan status pembayaran
 * yang pending dan telah melewati batas waktu kedaluwarsa 15 menit tanpa bergantung pada browser klien.
 */
export async function reconcilePendingAndExpiredOrders(
  options: ReconciliationOptions = {}
): Promise<ReconciliationResult> {
  const { dryRun = false, limit = 50 } = options
  const now = new Date()

  // 1. Cari kandidat pesanan QRIS berstatus PENDING yang sudah melewati batas waktu
  const expiredCandidates = await prisma.order.findMany({
    where: {
      paymentMethod: 'QRIS',
      paymentStatus: 'PENDING',
      expiresAt: { lte: now },
    },
    include: {
      paymentAttempts: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      items: true,
      table: true,
    },
    take: limit,
  })

  const result: ReconciliationResult = {
    success: true,
    totalScanned: expiredCandidates.length,
    settledCount: 0,
    settledAfterExpiryCount: 0,
    expiredCount: 0,
    failedCount: 0,
    errors: [],
  }

  for (const order of expiredCandidates) {
    const attempt = order.paymentAttempts[0]
    const merchantOrderId = attempt?.merchantOrderId

    if (!merchantOrderId) {
      if (!dryRun) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'EXPIRED' },
        }).catch(() => {})
      }
      result.expiredCount++
      continue
    }

    try {
      // 2. Periksa status resmi transaksi ke gateway Midtrans
      const gatewayStatus = await getTransactionStatus(merchantOrderId)

      if (gatewayStatus.notFound) {
        // Transaksi tidak tercatat di gateway
        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'EXPIRED' },
            })
            if (attempt) {
              await tx.paymentAttempt.update({
                where: { id: attempt.id },
                data: { status: 'FAILED', rawResponse: 'NOT_FOUND_ON_GATEWAY' },
              })
            }
            await tx.auditLog.create({
              data: {
                orderId: order.id,
                action: 'ORDER_EXPIRED_NOT_FOUND_ON_GATEWAY',
                details: JSON.stringify({ merchantOrderId }),
              },
            })
          })
        }
        result.expiredCount++
        continue
      }

      const txStatus = gatewayStatus.transactionStatus

      // KASUS A: Pembayaran ternyata sudah lunas di Midtrans (settlement)
      if (txStatus === 'settlement' || txStatus === 'capture') {
        if (!dryRun) {
          await prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({
              where: { id: order.id },
            })

            if (!currentOrder || currentOrder.paymentStatus === 'PAID') {
              return
            }

            const paidAt = gatewayStatus.transactionTime
              ? new Date(gatewayStatus.transactionTime)
              : new Date()

            // Cek apakah order masih PENDING (tepat waktu) atau sudah kedaluwarsa/batal
            const isLatePayment = currentOrder.paymentStatus === 'EXPIRED' || currentOrder.orderStatus === 'CANCELLED'

            if (isLatePayment) {
              // DANA MASUK SETELAH KEDALUWARSA / PEMBATALAN:
              // Catat dana valid di laporan keuangan, tandai review kasir/admin,
              // JANGAN otomatis memasak order di KDS dapur!
              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: 'PAID',
                  paidAt,
                  // orderStatus tetap CANCELLED (tidak diteruskan ke KDS dapur)
                },
              })

              await tx.paymentAttempt.update({
                where: { id: attempt.id },
                data: {
                  status: 'PAID',
                  transactionId: gatewayStatus.transactionId,
                  rawResponse: JSON.stringify(gatewayStatus.rawResponse),
                },
              })

              await tx.auditLog.create({
                data: {
                  orderId: order.id,
                  action: 'PAYMENT_SETTLED_AFTER_EXPIRY_REVIEW_REQUIRED',
                  details: JSON.stringify({
                    merchantOrderId,
                    transactionId: gatewayStatus.transactionId,
                    grossAmount: gatewayStatus.grossAmount,
                    message:
                      'Dana berhasil masuk ke gateway SETELAH pesanan kedaluwarsa. Order ditahan dari dapur; kasir/admin perlu melakukan SOP refund manual atau tiket pengganti.',
                  }),
                },
              })

              result.settledAfterExpiryCount++
            } else {
              // PEMBAYARAN TEPAT WAKTU (Webhook Terlambat):
              // Selesaikan order normal dan teruskan ke KDS dapur
              await tx.order.update({
                where: { id: order.id },
                data: {
                  paymentStatus: 'PAID',
                  paidAt,
                  orderStatus: 'QUEUED',
                },
              })

              await tx.paymentAttempt.update({
                where: { id: attempt.id },
                data: {
                  status: 'PAID',
                  transactionId: gatewayStatus.transactionId,
                  rawResponse: JSON.stringify(gatewayStatus.rawResponse),
                },
              })

              // Increment soldCount
              for (const item of order.items) {
                if (item.menuItemId) {
                  await tx.menuItem.update({
                    where: { id: item.menuItemId },
                    data: { soldCount: { increment: item.quantity } },
                  }).catch(() => {})
                }
              }

              // Durable OutboxEvent untuk KDS
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
                    paidAt: paidAt.toISOString(),
                  }),
                },
              })

              await tx.auditLog.create({
                data: {
                  orderId: order.id,
                  action: 'PAYMENT_SETTLED_RECONCILIATION',
                  details: JSON.stringify({
                    merchantOrderId,
                    transactionId: gatewayStatus.transactionId,
                    grossAmount: gatewayStatus.grossAmount,
                  }),
                },
              })

              result.settledCount++
            }
          })
        } else {
          result.settledCount++
        }
        continue
      }

      // KASUS B: Gateway status masih pending -> Batalkan/expire transaksi di gateway
      if (txStatus === 'pending') {
        if (!dryRun) {
          // Panggil expire ke Midtrans agar QRIS tidak bisa dibayar lagi
          await expireTransaction(merchantOrderId).catch(() => {})

          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: { paymentStatus: 'EXPIRED' },
            })
            await tx.paymentAttempt.update({
              where: { id: attempt.id },
              data: { status: 'EXPIRED' },
            })
            await tx.auditLog.create({
              data: {
                orderId: order.id,
                action: 'ORDER_EXPIRED_RECONCILED',
                details: JSON.stringify({
                  merchantOrderId,
                  gatewayStatus: txStatus,
                  message: 'Batas waktu 15 menit habis. Transaksi di-expire pada gateway dan sistem.',
                }),
              },
            })
          })
        }
        result.expiredCount++
        continue
      }

      // KASUS C: Gateway status memang sudah expire / cancel / deny
      if (!dryRun) {
        await prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'EXPIRED' },
          })
          await tx.paymentAttempt.update({
            where: { id: attempt.id },
            data: {
              status: txStatus === 'expire' ? 'EXPIRED' : 'FAILED',
              rawResponse: JSON.stringify(gatewayStatus.rawResponse),
            },
          })
          await tx.auditLog.create({
            data: {
              orderId: order.id,
              action: 'ORDER_EXPIRED_SYNCED_GATEWAY',
              details: JSON.stringify({ merchantOrderId, gatewayStatus: txStatus }),
            },
          })
        })
      }
      result.expiredCount++
    } catch (itemErr: unknown) {
      result.errors.push({
        orderId: order.id,
        error: itemErr instanceof Error ? itemErr.message : String(itemErr),
      })
    }
  }

  return result
}

