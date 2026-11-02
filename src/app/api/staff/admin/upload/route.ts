import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { validateImageBuffer } from '@/lib/server/image-validator'
import { saveMenuImage } from '@/lib/server/storage-service'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Berkas foto wajib diunggah (field "file").' },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const validation = validateImageBuffer(buffer)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: validation.error || 'Validasi gambar gagal.' },
        { status: 400 }
      )
    }

    const saved = await saveMenuImage(buffer, validation)

    return NextResponse.json({
      success: true,
      data: saved,
    })
  } catch (err) {
    console.error('Failed to upload image:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memproses unggahan foto.' },
      { status: 500 }
    )
  }
}

