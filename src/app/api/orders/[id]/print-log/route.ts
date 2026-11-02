import { NextResponse } from 'next/server'
import { z } from 'zod'
import { verifyOrderOrStaffAccess, OrderAccessError } from '@/lib/server/order-access'
import { recordPrintAttempt } from '@/lib/server/print-service'
import type { PrintDocumentType, PrintFormat } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

const PrintLogBodySchema = z.object({
  documentType: z.enum(['CUSTOMER_RECEIPT', 'CASHIER_RECEIPT', 'KITCHEN_TICKET']),
  format: z.enum(['THERMAL_58MM', 'THERMAL_80MM']).default('THERMAL_58MM'),
})

export async function POST(request: Request, { params }: RouteParams) {
  const { id: orderId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'INVALID_JSON', message: 'Payload JSON tidak valid.' },
      { status: 400 }
    )
  }

  const parsed = PrintLogBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', message: 'Data cetak tidak valid.', details: parsed.error.format() },
      { status: 400 }
    )
  }

  const { documentType, format } = parsed.data

  try {
    // 1. Verifikasi hak akses: Staf atau Pelanggan pemilik order
    const access = await verifyOrderOrStaffAccess(orderId, request, {
      allowedRoles: ['CASHIER', 'ADMIN', 'BARISTA'],
      allowCustomer: true,
    })

    // 2. Proteksi dokumen internal: Pelanggan HANYA boleh mencatat CUSTOMER_RECEIPT
    if (access.actorType === 'CUSTOMER' && documentType !== 'CUSTOMER_RECEIPT') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Pelanggan tidak memiliki izin mencatat cetak dokumen staf.' },
        { status: 403 }
      )
    }

    // 3. Jika Barista, mereka boleh KITCHEN_TICKET atau CUSTOMER_RECEIPT, tapi bukan CASHIER_RECEIPT
    if (access.actorType === 'STAFF' && access.staffUser?.role === 'BARISTA' && documentType === 'CASHIER_RECEIPT') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Barista tidak memiliki wewenang mencetak struk kasir.' },
        { status: 403 }
      )
    }

    // 4. Catat print attempt secara atomik
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
    const staffId = access.staffUser?.sub || null
    const result = await recordPrintAttempt({
      orderId,
      documentType: documentType as PrintDocumentType,
      format: format as PrintFormat,
      staffUserId: staffId,
      ipAddress,
    })

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (err) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      )
    }

    console.error('Error recording print attempt:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal mencatat upaya cetak.' },
      { status: 500 }
    )
  }
}
