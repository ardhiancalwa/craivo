import 'server-only'
import prisma from './db'
import {
  getJakartaDateRangeBoundaries,
  formatJakartaDateTime,
} from './timezone-utils'
import type { TransactionCsvRow } from './csv-exporter'
import type { PaymentMethod, OrderStatus, PaymentStatus } from '@prisma/client'

export interface TurnoverBreakdown {
  transactionCount: number
  grossAmount: number
  refundAmount: number
  netAmount: number
}

export interface TopSellingItem {
  name: string
  quantitySold: number
  totalRevenue: number
}

export interface TurnoverReportResponse {
  period: {
    startDateJakarta: string
    endDateJakarta: string
    startUtc: string
    endUtc: string
  }
  summary: {
    grossReceipts: number // Total penerimaan bruto dari seluruh pesanan PAID
    totalRefunds: number // Total pengembalian dana manual yang disetujui kasir
    netTurnover: number // grossReceipts - totalRefunds
    totalPaidOrders: number
  }
  byPaymentMethod: {
    qris: TurnoverBreakdown
    cash: TurnoverBreakdown
  }
  topSellingItems: TopSellingItem[]
}

export interface TransactionFilterParams {
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  paymentMethod?: string // 'ALL' | 'QRIS' | 'CASH'
  paymentStatus?: string // 'ALL' | 'PAID' | 'WAITING_CASHIER' | 'UNPAID' | 'EXPIRED'
  orderStatus?: string // 'ALL' | OrderStatus
  page?: number
  limit?: number
}

export interface TransactionListItem {
  id: string
  orderNumber: string
  tableNumber: string
  createdAtJakarta: string
  paidAtJakarta: string | null
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  orderStatus: OrderStatus
  subtotalAmount: number
  serviceAmount: number
  taxAmount: number
  totalAmount: number
  refundAmount: number
  netAmount: number
  itemsSummary: string
  customerNotes: string | null
  refundReason: string | null
}

export interface TransactionListResponse {
  transactions: TransactionListItem[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
  summary: {
    grossReceipts: number
    totalRefunds: number
    netTurnover: number
    totalTransactions: number
  }
}

/**
 * Menghasilkan laporan omzet penjualan harian atau rentang tanggal
 * dengan batas zona waktu Asia/Jakarta (WIB) yang akurat.
 */
export async function getTurnoverReport(
  startDateStr: string,
  endDateStr: string
): Promise<TurnoverReportResponse> {
  const boundaries = getJakartaDateRangeBoundaries(startDateStr, endDateStr)
  const { startUtc, endUtc, startJakartaString, endJakartaString } = boundaries

  // Ambil seluruh order yang lunas (paymentStatus === 'PAID') dalam rentang waktu paidAt
  // Termasuk pesanan yang dibatalkan dapurnya jika pembayaran nyata telah terverifikasi.
  // Pesanan UNPAID, WAITING_CASHIER, PENDING, dan EXPIRED dieksklusikan.
  const paidOrders = await prisma.order.findMany({
    where: {
      paymentStatus: 'PAID',
      paidAt: {
        gte: startUtc,
        lte: endUtc,
      },
    },
    include: {
      items: true,
      manualRefunds: true,
    },
    orderBy: {
      paidAt: 'desc',
    },
  })

  let grossReceipts = 0
  let totalRefunds = 0

  const qrisBreakdown: TurnoverBreakdown = {
    transactionCount: 0,
    grossAmount: 0,
    refundAmount: 0,
    netAmount: 0,
  }

  const cashBreakdown: TurnoverBreakdown = {
    transactionCount: 0,
    grossAmount: 0,
    refundAmount: 0,
    netAmount: 0,
  }

  const itemMap = new Map<string, { quantity: number; revenue: number }>()

  for (const order of paidOrders) {
    const gross = order.totalAmount
    const orderRefund = order.manualRefunds.reduce((sum, r) => sum + r.amount, 0)
    const net = gross - orderRefund

    grossReceipts += gross
    totalRefunds += orderRefund

    if (order.paymentMethod === 'QRIS') {
      qrisBreakdown.transactionCount += 1
      qrisBreakdown.grossAmount += gross
      qrisBreakdown.refundAmount += orderRefund
      qrisBreakdown.netAmount += net
    } else if (order.paymentMethod === 'CASH') {
      cashBreakdown.transactionCount += 1
      cashBreakdown.grossAmount += gross
      cashBreakdown.refundAmount += orderRefund
      cashBreakdown.netAmount += net
    }

    // Hitung agregasi item terjual
    for (const item of order.items) {
      const existing = itemMap.get(item.nameSnapshot) || { quantity: 0, revenue: 0 }
      existing.quantity += item.quantity
      existing.revenue += item.subtotal
      itemMap.set(item.nameSnapshot, existing)
    }
  }

  const topSellingItems: TopSellingItem[] = Array.from(itemMap.entries())
    .map(([name, data]) => ({
      name,
      quantitySold: data.quantity,
      totalRevenue: data.revenue,
    }))
    .sort((a, b) => b.quantitySold - a.quantitySold || b.totalRevenue - a.totalRevenue)
    .slice(0, 10)

  return {
    period: {
      startDateJakarta: startJakartaString,
      endDateJakarta: endJakartaString,
      startUtc: startUtc.toISOString(),
      endUtc: endUtc.toISOString(),
    },
    summary: {
      grossReceipts,
      totalRefunds,
      netTurnover: grossReceipts - totalRefunds,
      totalPaidOrders: paidOrders.length,
    },
    byPaymentMethod: {
      qris: qrisBreakdown,
      cash: cashBreakdown,
    },
    topSellingItems,
  }
}

/**
 * Mengambil daftar transaksi terpaginasi dengan filter rentang waktu,
 * metode pembayaran, dan status pesanan.
 */
export async function getTransactionList(
  params: TransactionFilterParams
): Promise<TransactionListResponse> {
  const { startDate, endDate, paymentMethod, paymentStatus, orderStatus } = params
  const page = Math.max(1, params.page || 1)
  const limit = Math.min(100, Math.max(1, params.limit || 10))
  const skip = (page - 1) * limit

  const boundaries = getJakartaDateRangeBoundaries(startDate, endDate)
  const { startUtc, endUtc } = boundaries

  // Filter Prisma
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    createdAt: {
      gte: startUtc,
      lte: endUtc,
    },
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    where.paymentMethod = paymentMethod as PaymentMethod
  }

  if (paymentStatus && paymentStatus !== 'ALL') {
    where.paymentStatus = paymentStatus as PaymentStatus
  }

  if (orderStatus && orderStatus !== 'ALL') {
    where.orderStatus = orderStatus as OrderStatus
  }

  const [totalCount, orders, allFilteredOrders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: {
        table: true,
        items: true,
        manualRefunds: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.order.findMany({
      where,
      select: {
        totalAmount: true,
        paymentStatus: true,
        manualRefunds: {
          select: {
            amount: true,
          },
        },
      },
    }),
  ])

  // Ringkasan finansial dari seluruh pesanan hasil filter (bukan hanya halaman aktif)
  let grossReceipts = 0
  let totalRefunds = 0
  for (const o of allFilteredOrders) {
    if (o.paymentStatus === 'PAID') {
      grossReceipts += o.totalAmount
      for (const r of o.manualRefunds) {
        totalRefunds += r.amount
      }
    }
  }

  const transactions: TransactionListItem[] = orders.map((o) => {
    const refundAmount = o.manualRefunds.reduce((sum, r) => sum + r.amount, 0)
    const netAmount = o.paymentStatus === 'PAID' ? o.totalAmount - refundAmount : 0
    const itemsSummary = o.items.map((i) => `${i.quantity}x ${i.nameSnapshot}`).join(', ')
    const refundReason = o.manualRefunds.length > 0 ? o.manualRefunds[0]?.reason ?? null : null

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      tableNumber: o.table.tableNumber,
      createdAtJakarta: formatJakartaDateTime(o.createdAt),
      paidAtJakarta: o.paidAt ? formatJakartaDateTime(o.paidAt) : null,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      subtotalAmount: o.subtotalAmount,
      serviceAmount: o.serviceAmount,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
      refundAmount,
      netAmount,
      itemsSummary: itemsSummary || '-',
      customerNotes: o.customerNotes,
      refundReason,
    }
  })

  return {
    transactions,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
    },
    summary: {
      grossReceipts,
      totalRefunds,
      netTurnover: grossReceipts - totalRefunds,
      totalTransactions: totalCount,
    },
  }
}

/**
 * Menghasilkan data baris siap ekspor CSV untuk rentang tanggal tertentu.
 */
export async function getTransactionsForExport(
  startDateStr: string,
  endDateStr: string,
  paymentMethod?: string
): Promise<TransactionCsvRow[]> {
  const boundaries = getJakartaDateRangeBoundaries(startDateStr, endDateStr)
  const { startUtc, endUtc } = boundaries

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    createdAt: {
      gte: startUtc,
      lte: endUtc,
    },
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    where.paymentMethod = paymentMethod as PaymentMethod
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      table: true,
      items: true,
      manualRefunds: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  })

  return orders.map((o) => {
    const refundAmount = o.manualRefunds.reduce((sum, r) => sum + r.amount, 0)
    const totalGross = o.totalAmount
    const totalNet = o.paymentStatus === 'PAID' ? totalGross - refundAmount : 0
    const itemSummary = o.items.map((i) => `${i.quantity}x ${i.nameSnapshot}`).join('; ')
    const refundReason = o.manualRefunds.map((r) => r.reason).join('; ') || null

    return {
      orderNumber: o.orderNumber,
      createdAtJakarta: formatJakartaDateTime(o.createdAt),
      tableNumber: o.table.tableNumber,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      orderStatus: o.orderStatus,
      subtotal: o.subtotalAmount,
      service: o.serviceAmount,
      tax: o.taxAmount,
      totalGross,
      refundAmount,
      totalNet,
      itemSummary: itemSummary || '-',
      customerNotes: o.customerNotes,
      refundReason,
    }
  })
}

