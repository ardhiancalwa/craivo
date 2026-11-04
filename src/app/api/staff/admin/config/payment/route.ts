import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { getCafeConfig, updatePaymentMethodsConfig } from '@/lib/server/config-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdatePaymentMethodsSchema = z.object({
  enableMidtransQris: z.boolean().optional(),
  enableCash: z.boolean().optional(),
  enableManualQris: z.boolean().optional(),
  manualQrisImageUrl: z.string().trim().max(1000).optional().nullable(),
  manualQrisName: z.string().trim().max(100).optional().nullable(),
  enableManualTransfer: z.boolean().optional(),
  manualTransferBank: z.string().trim().max(50).optional().nullable(),
  manualTransferAccount: z.string().trim().max(50).optional().nullable(),
  manualTransferName: z.string().trim().max(100).optional().nullable(),
})

export async function GET(request: Request) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  try {
    const config = await getCafeConfig()
    return NextResponse.json({
      success: true,
      data: {
        enableMidtransQris: config.enableMidtransQris,
        enableCash: config.enableCash,
        enableManualQris: config.enableManualQris,
        manualQrisImageUrl: config.manualQrisImageUrl,
        manualQrisName: config.manualQrisName,
        enableManualTransfer: config.enableManualTransfer,
        manualTransferBank: config.manualTransferBank,
        manualTransferAccount: config.manualTransferAccount,
        manualTransferName: config.manualTransferName,
      },
    })
  } catch (err) {
    console.error('Failed to get payment methods config:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal memuat konfigurasi pembayaran.' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  let staff
  try {
    staff = await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = UpdatePaymentMethodsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  // Setidaknya ada 1 metode pembayaran yang aktif
  const current = await getCafeConfig()
  const nextMidtrans = parsed.data.enableMidtransQris !== undefined ? parsed.data.enableMidtransQris : current.enableMidtransQris
  const nextCash = parsed.data.enableCash !== undefined ? parsed.data.enableCash : current.enableCash
  const nextManualQris = parsed.data.enableManualQris !== undefined ? parsed.data.enableManualQris : current.enableManualQris
  const nextManualTransfer = parsed.data.enableManualTransfer !== undefined ? parsed.data.enableManualTransfer : current.enableManualTransfer

  if (!nextMidtrans && !nextCash && !nextManualQris && !nextManualTransfer) {
    return NextResponse.json(
      { error: 'INVALID_CONFIG', message: 'Minimal harus ada 1 metode pembayaran yang aktif.' },
      { status: 400 }
    )
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const updated = await updatePaymentMethodsConfig(parsed.data, staff, ipAddress)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update payment methods:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui konfigurasi pembayaran.' },
      { status: 500 }
    )
  }
}

