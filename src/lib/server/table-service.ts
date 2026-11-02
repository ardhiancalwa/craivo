import 'server-only'
import { prisma } from './db'
import { z } from 'zod'

export const TableNumberSchema = z
  .string()
  .trim()
  .min(1, 'Nomor meja tidak boleh kosong')
  .max(10, 'Nomor meja maksimal 10 karakter')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Format nomor meja hanya boleh alfanumerik')

export type TableValidationStatus =
  | 'VALID'
  | 'NOT_FOUND'
  | 'INACTIVE'
  | 'MISSING'
  | 'INVALID_FORMAT'

export interface TableValidationResult {
  status: TableValidationStatus
  tableNumber: string | null
  table: {
    id: string
    tableNumber: string
    qrSlug: string
    isActive: boolean
  } | null
  message: string
}

export async function validateTableServer(
  tableNumberRaw: string | undefined | null
): Promise<TableValidationResult> {
  if (!tableNumberRaw || tableNumberRaw.trim() === '') {
    return {
      status: 'MISSING',
      tableNumber: null,
      table: null,
      message: 'Nomor meja tidak terdeteksi. Silakan pindai ulang kode QR pada stiker meja Anda.',
    }
  }

  const parsed = TableNumberSchema.safeParse(tableNumberRaw)
  if (!parsed.success) {
    return {
      status: 'INVALID_FORMAT',
      tableNumber: tableNumberRaw,
      table: null,
      message: 'Format nomor meja tidak valid.',
    }
  }

  const tableNumber = parsed.data

  try {
    const table = await prisma.table.findUnique({
      where: { tableNumber },
      select: {
        id: true,
        tableNumber: true,
        qrSlug: true,
        isActive: true,
      },
    })

    if (!table) {
      return {
        status: 'NOT_FOUND',
        tableNumber,
        table: null,
        message: `Nomor meja "${tableNumber}" tidak terdaftar dalam sistem SELA. Silakan hubungi kasir/staf kami.`,
      }
    }

    if (!table.isActive) {
      return {
        status: 'INACTIVE',
        tableNumber,
        table,
        message: `Meja "${tableNumber}" sedang berstatus tutup atau nonaktif. Silakan hubungi staf SELA untuk bantuan.`,
      }
    }

    return {
      status: 'VALID',
      tableNumber,
      table,
      message: `Meja ${tableNumber} aktif.`,
    }
  } catch (error) {
    console.error(`[TableService] Error querying table ${tableNumber}:`, error)
    throw error
  }
}

