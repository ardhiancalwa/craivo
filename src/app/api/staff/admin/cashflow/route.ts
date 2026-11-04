import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { getCashflowSummary, updateCashflowProfile } from '@/lib/server/cashflow-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateCashflowSchema = z.object({
  periodName: z.string().min(1, 'Nama periode wajib diisi').max(100).optional(),
  initialCapital: z.number().int().min(0, 'Modal awal tidak boleh negatif'),
  rawMaterialCost: z.number().int().min(0, 'Harga bahan tidak boleh negatif'),
  operationalCost: z.number().int().min(0, 'Biaya operasional tidak boleh negatif'),
  overheadCost: z.number().int().min(0, 'Biaya overhead tidak boleh negatif'),
  salaryStaff: z.number().int().min(0, 'Gaji staf tidak boleh negatif'),
  salaryOwner: z.number().int().min(0, 'Gaji owner tidak boleh negatif'),
  targetProductionQty: z.number().int().min(1, 'Target produksi minimal 1 cup'),
  shareLossPercentage: z.number().min(0, 'Share loss minimal 0%').max(100, 'Share loss maksimal 100%'),
  sellingPricePerUnit: z.number().int().min(100, 'Harga jual minimal Rp100'),
  notes: z.string().max(500).optional().nullable(),
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

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get('startDate') || undefined
  const endDate = searchParams.get('endDate') || undefined

  try {
    const summary = await getCashflowSummary(startDate, endDate)
    return NextResponse.json({ success: true, data: summary })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gagal memuat ringkasan arus kas.'
    console.error('Failed to get cashflow summary:', err)
    return NextResponse.json(
      { error: 'CASHFLOW_ERROR', message: errorMessage },
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

  const parsed = UpdateCashflowSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const updated = await updateCashflowProfile(parsed.data, staff, ipAddress)
    return NextResponse.json({ success: true, data: updated })
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Gagal memperbarui parameter arus kas.'
    console.error('Failed to update cashflow profile:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: errorMessage },
      { status: 500 }
    )
  }
}

