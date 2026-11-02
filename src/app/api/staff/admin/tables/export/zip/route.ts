import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { generateTablesZip } from '@/lib/server/qr-service'

export const dynamic = 'force-dynamic'

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
  const env = searchParams.get('env') === 'production' ? 'production' : 'staging'

  try {
    const zipBuffer = await generateTablesZip(env)
    const filename = `sela-semua-qr-meja-${env}.zip`

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan arsip ZIP QR meja.'
    console.error('Failed to export tables ZIP:', err)
    return NextResponse.json({ error: 'ZIP_EXPORT_FAILED', message }, { status: 400 })
  }
}

