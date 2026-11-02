import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { updateFinancialPolicy } from '@/lib/server/config-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const FinancialPolicySchema = z.object({
  taxRateBps: z.number().int().min(0).max(5000, 'Tarif pajak maksimal 50% (5000 bps)'),
  serviceRateBps: z.number().int().min(0).max(5000, 'Tarif layanan maksimal 50% (5000 bps)'),
  isTaxInclusive: z.boolean(),
})

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

  const parsed = FinancialPolicySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const updated = await updateFinancialPolicy(parsed.data, staff, ipAddress)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update financial policy:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui kebijakan finansial.' },
      { status: 500 }
    )
  }
}

