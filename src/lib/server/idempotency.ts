import 'server-only'
import crypto from 'node:crypto'
import { prisma } from './db'
import type { IdempotencyRecord } from '@prisma/client'

export class IdempotencyConflictError extends Error {
  code: string
  statusCode: number

  constructor(code: string, message: string, statusCode = 409) {
    super(message)
    this.name = 'IdempotencyConflictError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class IdempotencyInProgressError extends Error {
  code: string
  statusCode: number
  retryAfterSeconds: number

  constructor(code: string, message: string, statusCode = 409, retryAfterSeconds = 2) {
    super(message)
    this.name = 'IdempotencyInProgressError'
    this.code = code
    this.statusCode = statusCode
    this.retryAfterSeconds = retryAfterSeconds
  }
}

/**
 * Menghasilkan fingerprint SHA-256 yang deterministik dari payload order.
 * Mengurutkan item dan modifier agar urutan pengiriman yang berbeda tetap menghasilkan hash yang sama.
 */
export function computePayloadFingerprint(payload: {
  tableNumber: string
  paymentMethod: string
  customerNotes?: string
  quoteToken: string
  items: Array<{
    menuItemId: string
    selectedModifierOptionIds: string[]
    quantity: number
    notes?: string
  }>
}): string {
  const canonicalItems = (payload.items || [])
    .map((it) => ({
      menuItemId: it.menuItemId,
      selectedModifierOptionIds: [...(it.selectedModifierOptionIds || [])].sort(),
      quantity: it.quantity,
      notes: (it.notes || '').trim(),
    }))
    .sort((a, b) => a.menuItemId.localeCompare(b.menuItemId))

  const canonicalString = JSON.stringify({
    tableNumber: payload.tableNumber.trim(),
    paymentMethod: payload.paymentMethod,
    customerNotes: (payload.customerNotes || '').trim(),
    quoteToken: payload.quoteToken.trim(),
    items: canonicalItems,
  })

  return crypto.createHash('sha256').update(canonicalString).digest('hex')
}

export type ClaimResult =
  | { status: 'CLAIMED'; record: IdempotencyRecord }
  | { status: 'COMPLETED'; record: IdempotencyRecord }

/**
 * Mengklaim Idempotency-Key secara atomik di database.
 * Jika key sudah ada:
 * - Hash payload berbeda -> 409 IDEMPOTENCY_KEY_REUSED
 * - State COMPLETED -> Replay respon yang sama
 * - State IN_PROGRESS (lock aktif) -> 409 REQUEST_IN_PROGRESS (Retry-After)
 * - State IN_PROGRESS (lock basi > 30s) -> Ambil alih lock
 */
export async function claimIdempotencyKey(params: {
  key: string
  scope: string
  ownerId: string
  requestHash: string
}): Promise<ClaimResult> {
  const { key, scope, ownerId, requestHash } = params
  const now = new Date()
  const lockedUntil = new Date(now.getTime() + 30 * 1000) // 30 detik lock
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 jam

  try {
    const created = await prisma.idempotencyRecord.create({
      data: {
        key,
        scope,
        ownerId,
        requestHash,
        state: 'IN_PROGRESS',
        lockedUntil,
        expiresAt,
      },
    })
    return { status: 'CLAIMED', record: created }
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.code === 'P2002') {
      const existing = await prisma.idempotencyRecord.findUnique({
        where: {
          scope_ownerId_key: { scope, ownerId, key },
        },
      })

      if (!existing) {
        throw err
      }

      // 1. Verifikasi kecocokan fingerprint request
      if (existing.requestHash !== requestHash) {
        throw new IdempotencyConflictError(
          'IDEMPOTENCY_KEY_REUSED',
          'Kunci Idempotency-Key ini telah digunakan untuk payload checkout yang berbeda.',
          409
        )
      }

      // 2. Jika sudah selesai, kembalikan record untuk replay
      if (existing.state === 'COMPLETED') {
        return { status: 'COMPLETED', record: existing }
      }

      // 3. Jika sedang in-progress dan lock masih aktif
      if (existing.lockedUntil && existing.lockedUntil > now) {
        throw new IdempotencyInProgressError(
          'REQUEST_IN_PROGRESS',
          'Permintaan pembuatan pesanan dengan kunci ini sedang diproses.',
          409,
          2
        )
      }

      // 4. Stale lock takeover (jika proses sebelumnya crash atau timeout > 30s)
      const takeover = await prisma.idempotencyRecord.updateMany({
        where: {
          id: existing.id,
          state: 'IN_PROGRESS',
          lockedUntil: existing.lockedUntil,
        },
        data: {
          lockedUntil,
        },
      })

      if (takeover.count > 0) {
        const updated = await prisma.idempotencyRecord.findUnique({
          where: { id: existing.id },
        })
        return { status: 'CLAIMED', record: updated! }
      }

      throw new IdempotencyInProgressError(
        'REQUEST_IN_PROGRESS',
        'Permintaan pesanan sedang diproses bersamaan.',
        409,
        2
      )
    }

    throw err
  }
}

export async function completeIdempotencyRecord(params: {
  id: string
  orderId: string
  responseStatus: number
  responseBody: string
}): Promise<void> {
  const { id, orderId, responseStatus, responseBody } = params
  await prisma.idempotencyRecord.update({
    where: { id },
    data: {
      state: 'COMPLETED',
      orderId,
      responseStatus,
      responseBody,
      lockedUntil: null,
    },
  })
}

export async function failIdempotencyRecord(params: {
  id: string
  responseStatus: number
  responseBody: string
}): Promise<void> {
  const { id, responseStatus, responseBody } = params
  await prisma.idempotencyRecord.update({
    where: { id },
    data: {
      state: 'FAILED',
      responseStatus,
      responseBody,
      lockedUntil: null,
    },
  })
}

