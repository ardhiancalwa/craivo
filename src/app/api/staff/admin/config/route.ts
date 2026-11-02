import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { getCafeConfig, updateCafeIdentity } from '@/lib/server/config-service'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const UpdateIdentitySchema = z.object({
  name: z.string().trim().min(3, 'Nama kafe minimal 3 karakter').max(100),
  tagline: z.string().trim().min(3, 'Tagline minimal 3 karakter').max(200),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(50).optional().nullable(),
  openingHours: z.string().trim().max(100).optional().nullable(),
  productionDomain: z.string().trim().url('Format URL domain produksi tidak valid (harus dimulai http:// atau https://)').optional().nullable(),
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
    return NextResponse.json({ success: true, data: config })
  } catch (err) {
    console.error('Failed to get cafe config:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal mengambil konfigurasi kafe.' },
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

  const parsed = UpdateIdentitySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'VALIDATION_ERROR', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
    const updated = await updateCafeIdentity(parsed.data, staff, ipAddress)
    return NextResponse.json({ success: true, data: updated })
  } catch (err) {
    console.error('Failed to update cafe identity:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memperbarui identitas kafe.' },
      { status: 500 }
    )
  }
}

