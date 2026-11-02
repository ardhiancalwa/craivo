import 'server-only'
import crypto from 'node:crypto'
import { prisma } from './db'
import {
  calculateCartItems,
  computeCanonicalItemsHash,
  verifyQuoteToken,
  QuoteServiceError,
  type QuoteItemInput,
} from './quote-service'
import { deriveOrderSecretToken, hashOrderSecretToken } from './order-capability'
import { completeIdempotencyRecord, failIdempotencyRecord } from './idempotency'

export interface CreateOrderParams {
  tableNumber: string
  paymentMethod: 'QRIS' | 'CASH'
  customerNotes?: string
  quoteToken: string
  items: QuoteItemInput[]
  guestSessionId: string
  idempotencyRecordId: string
  ipAddress?: string
}

export interface OrderItemModifierSnapshot {
  id: string
  name: string
  price: number
}

export interface OrderItemSnapshot {
  id: string
  name: string
  price: number
  quantity: number
  notes: string | null
  subtotal: number
  modifiers: OrderItemModifierSnapshot[]
}

export interface OrderClientResponse {
  orderId: string
  orderNumber: string
  tableNumber: string
  orderStatus: string
  paymentStatus: string
  paymentMethod: string
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  expiresAt: string | null
  items: OrderItemSnapshot[]
  nextAction: {
    type: 'PROCEED_PAYMENT' | 'AWAIT_CASHIER'
    url: string
  }
}

export interface CreateOrderResult {
  order: OrderClientResponse
  orderSecretToken: string
}

/**
 * Mengekstrak 4 huruf alfanumerik pertama dari nama kafe/restoran
 * untuk dijadikan awalan kode transaksi dinamis.
 * Contoh: "Cravio" -> "CRAV", "Sela Coffee" -> "SELA", "Kopi Kenangan" -> "KOPI"
 */
export function getCafePrefix(cafeName?: string | null): string {
  const clean = (cafeName || 'CRAV').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()
  if (clean.length >= 4) {
    return clean.slice(0, 4)
  }
  return clean.padEnd(4, 'X')
}

/**
 * Format tanggal hari ini dalam zona waktu Asia/Jakarta sebagai (PREFIX)-YYMMDD
 */
export async function getJakartaDatePrefix(customPrefix?: string): Promise<string> {
  let prefix = customPrefix
  if (!prefix) {
    try {
      const config = await prisma.cravioConfig.findUnique({
        where: { id: 'cravio-main-config' },
        select: { name: true },
      })
      prefix = getCafePrefix(config?.name)
    } catch {
      prefix = 'CRAV'
    }
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: '2-digit',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = formatter.formatToParts(new Date())
  const yy = parts.find((p) => p.type === 'year')?.value || '26'
  const mm = parts.find((p) => p.type === 'month')?.value || '10'
  const dd = parts.find((p) => p.type === 'day')?.value || '31'
  return `${prefix}-${yy}${mm}${dd}`
}

/**
 * Membuat order baru secara atomik dari quote yang telah disetujui.
 * Mengunci harga permanen dalam snapshot, merekam capability token,
 * dan menandai record idempotensi menjadi COMPLETED.
 */
export async function createOrderFromQuote(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const {
    tableNumber,
    paymentMethod,
    customerNotes,
    quoteToken,
    items,
    guestSessionId,
    idempotencyRecordId,
    ipAddress,
  } = params

  try {
    // 1. Verifikasi Quote Token Kriptografis
    const quotePayload = await verifyQuoteToken(quoteToken)

    if (quotePayload.tableNumber !== tableNumber.trim()) {
      throw new QuoteServiceError(
        'VALIDATION_FAILED',
        `Nomor meja pada quote (${quotePayload.tableNumber}) tidak cocok dengan meja pemesanan (${tableNumber}).`,
        400
      )
    }

    if (quotePayload.gsid && quotePayload.gsid !== guestSessionId) {
      throw new QuoteServiceError(
        'VALIDATION_FAILED',
        'Quote pesanan terikat ke sesi tamu yang berbeda. Silakan dapatkan quote baru.',
        403
      )
    }

    // 2. Hitung Ulang Keranjang (Stok & Validasi Modifier)
    const calc = await calculateCartItems(items)

    // 3. Verifikasi Konsistensi Harga & Isi
    const currentHash = computeCanonicalItemsHash(
      tableNumber,
      calc.calculatedItems,
      calc.totalAmount
    )

    if (
      currentHash !== quotePayload.itemsHash ||
      calc.totalAmount !== quotePayload.totalAmount
    ) {
      throw new QuoteServiceError(
        'PRICE_CHANGED',
        `Harga atau ketersediaan menu telah berubah dari estimasi sebelumnya. Total saat ini: Rp${calc.totalAmount.toLocaleString('id-ID')}. Silakan tinjau dan setujui kembali.`,
        409,
        {
          previousTotal: quotePayload.totalAmount,
          updatedTotal: calc.totalAmount,
        }
      )
    }

    // 4. Validasi Meja Aktif
    const cleanTableNumber = tableNumber.trim()
    const table = await prisma.table.findUnique({
      where: { tableNumber: cleanTableNumber },
    })

    if (!table) {
      throw new QuoteServiceError(
        'TABLE_NOT_FOUND',
        `Meja ${cleanTableNumber} tidak ditemukan.`,
        404
      )
    }

    if (!table.isActive) {
      throw new QuoteServiceError(
        'TABLE_INACTIVE',
        `Meja ${cleanTableNumber} sedang dinonaktifkan oleh staf kafe.`,
        403
      )
    }

    // 5. Parameter Waktu & Status Awal Sesuai Keputusan Desain (ADR-0004 & DEC-014)
    const now = new Date()
    const isQris = paymentMethod === 'QRIS'
    const paymentStatus = isQris ? 'UNPAID' : 'WAITING_CASHIER'
    // Batas waktu: QRIS 15 menit, CASH 20 menit
    const timeoutMinutes = isQris ? 15 : 20
    const expiresAt = new Date(now.getTime() + timeoutMinutes * 60 * 1000)

    const datePrefix = await getJakartaDatePrefix()

    // 6. Transaksi Database Atomik dengan Retry Loop dan Jitter untuk Order Number
    const maxRetries = 6
    let attempt = 0
    let lastError: unknown = null

    while (attempt < maxRetries) {
      attempt++
      try {
        const orderId = `ord_${crypto.randomUUID().replace(/-/g, '')}`
        const capabilityNonce = crypto.randomBytes(16).toString('hex')
        const orderSecretToken = deriveOrderSecretToken(orderId, capabilityNonce)
        const orderSecretTokenHash = hashOrderSecretToken(orderSecretToken)

        // Ambil nomor order tertinggi hari ini untuk mendapatkan urutan berikutnya secara aman
        const lastOrderToday = await prisma.order.findFirst({
          where: {
            orderNumber: {
              startsWith: `${datePrefix}-`,
            },
          },
          orderBy: { orderNumber: 'desc' },
          select: { orderNumber: true },
        })

        let nextSeq = 1
        if (lastOrderToday) {
          const parts = lastOrderToday.orderNumber.split('-')
          const rawLast = parts[parts.length - 1]
          const lastNum = rawLast ? parseInt(rawLast, 10) : NaN
          if (!isNaN(lastNum)) {
            nextSeq = lastNum + 1
          }
        }

        // Pada retry attempt > 1, tambahkan random jitter agar pesanan simultan tidak memilih slot urut yang sama
        const jitter = attempt > 1 ? Math.floor(Math.random() * 5) + 1 : 0
        const sequenceSuffix = (nextSeq + (attempt - 1) + jitter).toString().padStart(3, '0')
        const orderNumber = `${datePrefix}-${sequenceSuffix}`

        const createdOrder = await prisma.$transaction(async (tx) => {
          const newOrder = await tx.order.create({
            data: {
              id: orderId,
              orderNumber,
              orderSecretTokenHash,
              capabilityNonce,
              quoteId: quotePayload.quoteId,
              tableId: table.id,
              guestSessionId,
              customerNotes: customerNotes ? customerNotes.slice(0, 100).trim() : null,
              subtotalAmount: calc.subtotalAmount,
              taxAmount: calc.taxAmount,
              serviceAmount: calc.serviceAmount,
              totalAmount: calc.totalAmount,
              orderStatus: 'QUEUED', // Hidden dari KDS karena paymentStatus != PAID
              paymentStatus,
              paymentMethod,
              expiresAt,
              items: {
                create: calc.calculatedItems.map((item) => ({
                  menuItemId: item.menuItemId,
                  nameSnapshot: item.name,
                  priceSnapshot: item.basePrice,
                  quantity: item.quantity,
                  notes: item.notes || null,
                  subtotal: item.subtotal,
                  modifiers: {
                    create: item.modifiers.map((mod) => ({
                      optionId: mod.optionId,
                      nameSnapshot: mod.optionName,
                      priceSnapshot: mod.price,
                    })),
                  },
                })),
              },
            },
            include: {
              items: {
                include: {
                  modifiers: true,
                },
              },
              table: true,
            },
          })

          // Audit log transaksi (tanpa menyertakan rahasia)
          await tx.auditLog.create({
            data: {
              orderId: newOrder.id,
              action: 'ORDER_CREATED',
              details: JSON.stringify({
                orderNumber: newOrder.orderNumber,
                totalAmount: newOrder.totalAmount,
                paymentMethod: newOrder.paymentMethod,
                paymentStatus: newOrder.paymentStatus,
                itemCount: newOrder.items.length,
              }),
              ipAddress: ipAddress || null,
            },
          })

          // Siarkan event ke kasir POS jika pesanan membutuhkan pembayaran tunai
          if (newOrder.paymentMethod === 'CASH') {
            await tx.outboxEvent.create({
              data: {
                channel: 'POS',
                aggregateType: 'ORDER',
                aggregateId: newOrder.id,
                eventType: 'NEW_CASH_ORDER',
                payload: JSON.stringify({
                  orderId: newOrder.id,
                  orderNumber: newOrder.orderNumber,
                  tableNumber: table.tableNumber,
                  totalAmount: newOrder.totalAmount,
                  createdAt: newOrder.createdAt.toISOString(),
                }),
              },
            })
          }

          return newOrder
        })

        // Format respons klien yang dapat dicache (tanpa orderSecretToken)
        const clientOrder: OrderClientResponse = {
          orderId: createdOrder.id,
          orderNumber: createdOrder.orderNumber,
          tableNumber: table.tableNumber,
          orderStatus: createdOrder.orderStatus,
          paymentStatus: createdOrder.paymentStatus,
          paymentMethod: createdOrder.paymentMethod,
          subtotalAmount: createdOrder.subtotalAmount,
          taxAmount: createdOrder.taxAmount,
          serviceAmount: createdOrder.serviceAmount,
          totalAmount: createdOrder.totalAmount,
          expiresAt: createdOrder.expiresAt?.toISOString() || null,
          items: createdOrder.items.map((it) => ({
            id: it.id,
            name: it.nameSnapshot,
            price: it.priceSnapshot,
            quantity: it.quantity,
            notes: it.notes,
            subtotal: it.subtotal,
            modifiers: it.modifiers.map((m) => ({
              id: m.id,
              name: m.nameSnapshot,
              price: m.priceSnapshot,
            })),
          })),
          nextAction:
            paymentMethod === 'QRIS'
              ? {
                  type: 'PROCEED_PAYMENT',
                  url: `/order/${createdOrder.id}/pay`,
                }
              : {
                  type: 'AWAIT_CASHIER',
                  url: `/order/${createdOrder.id}/track`,
                },
        }

        // Simpan hasil sukses ke record Idempotensi (tanpa token)
        await completeIdempotencyRecord({
          id: idempotencyRecordId,
          orderId: createdOrder.id,
          responseStatus: 201,
          responseBody: JSON.stringify(clientOrder),
        })

        return {
          order: clientOrder,
          orderSecretToken,
        }
      } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((err as any)?.code === 'P2002') {
          // Bentrok unique constraint orderNumber, coba urutan nomor berikutnya dengan sedikit jeda jitter
          lastError = err
          await new Promise((resolve) => setTimeout(resolve, attempt * 20 + Math.random() * 20))
          continue
        }
        throw err
      }
    }

    throw lastError || new Error('Gagal mengalokasikan nomor order unik.')
  } catch (error: unknown) {
    // Jika terjadi error permanen (misal: PRICE_CHANGED, VALIDATION_FAILED, dll.)
    // tandai idempotency record FAILED agar tidak menggantung sebagai IN_PROGRESS
    const statusCode = error instanceof QuoteServiceError ? error.statusCode : 500
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorBody = JSON.stringify({
      error: error instanceof QuoteServiceError ? error.code : 'ORDER_CREATION_FAILED',
      message: errorMessage,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      details: (error as any)?.details,
    })

    await failIdempotencyRecord({
      id: idempotencyRecordId,
      responseStatus: statusCode,
      responseBody: errorBody,
    }).catch(() => {
      // Abaikan jika pencatatan fail gagal
    })

    throw error
  }
}

