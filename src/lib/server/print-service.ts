import 'server-only'
import prisma from './db'
import type { PrintDocumentType, PrintFormat } from '@prisma/client'

export interface RecordPrintAttemptParams {
  orderId: string
  documentType: PrintDocumentType
  format?: PrintFormat
  staffUserId?: string | null
  ipAddress?: string | null
}

export interface PrintAttemptResult {
  logId: string
  orderId: string
  documentType: PrintDocumentType
  format: PrintFormat
  attemptNumber: number
  isReprint: boolean
  reprintCount: number
  printedAt: Date
}

/**
 * Mencatat upaya cetak secara atomik per orderId dan documentType.
 * Tiket dapur pertama tidak akan dianggap reprint hanya karena struk kasir sudah dicetak sebelumnya.
 * Browser tidak dapat memverifikasi kertas fisik keluar; ini dicatat sebagai print request/attempt.
 */
export async function recordPrintAttempt(
  params: RecordPrintAttemptParams
): Promise<PrintAttemptResult> {
  const {
    orderId,
    documentType,
    format = 'THERMAL_58MM',
    staffUserId = null,
    ipAddress = null,
  } = params

  return await prisma.$transaction(async (tx) => {
    // 1. Hitung attempt sebelumnya khusus untuk orderId dan documentType ini
    const previousCount = await tx.printLog.count({
      where: {
        orderId,
        documentType,
      },
    })

    const attemptNumber = previousCount + 1
    const isReprint = previousCount > 0

    // 2. Buat record PrintLog baru
    const log = await tx.printLog.create({
      data: {
        orderId,
        staffUserId,
        format,
        target: 'BROWSER_DIALOG',
        documentType,
        reprintCount: previousCount,
      },
    })

    // 3. Catat di AuditLog
    await tx.auditLog.create({
      data: {
        orderId,
        staffUserId,
        action: 'PRINT_ATTEMPT',
        ipAddress,
        details: JSON.stringify({
          logId: log.id,
          documentType,
          format,
          attemptNumber,
          isReprint,
        }),
      },
    })

    return {
      logId: log.id,
      orderId,
      documentType,
      format,
      attemptNumber,
      isReprint,
      reprintCount: previousCount,
      printedAt: log.printedAt,
    }
  })
}

/**
 * Mendapatkan ringkasan status cetak (reprint status & attempt count) untuk suatu order dan tipe dokumen.
 */
export async function getPrintSummary(
  orderId: string,
  documentType: PrintDocumentType
) {
  const count = await prisma.printLog.count({
    where: {
      orderId,
      documentType,
    },
  })

  return {
    orderId,
    documentType,
    totalAttempts: count,
    isReprint: count > 0,
    reprintCount: count,
  }
}

