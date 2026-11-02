import { NextResponse } from 'next/server'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { generatePrintReadyA4Pdf } from '@/lib/server/qr-service'

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
    const pdfBuffer = await generatePrintReadyA4Pdf(env)
    const filename = `sela-lembar-cetak-qr-meja-${env}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan lembar cetak PDF A4.'
    console.error('Failed to export tables PDF:', err)
    return NextResponse.json({ error: 'PDF_EXPORT_FAILED', message }, { status: 400 })
  }
}

