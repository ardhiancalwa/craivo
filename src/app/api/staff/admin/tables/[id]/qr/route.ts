import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'
import { requireStaffRole, AuthError } from '@/lib/server/auth-guard'
import { generateTableQrPng, generateTableQrSvg } from '@/lib/server/qr-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: RouteParams) {
  try {
    await requireStaffRole(['ADMIN'], request)
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: 'UNAUTHORIZED', message: 'Akses ditolak.' }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ error: 'BAD_REQUEST', message: 'ID meja wajib disertakan.' }, { status: 400 })
  }

  const table = await prisma.table.findUnique({ where: { id } })
  if (!table) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Meja tidak ditemukan.' }, { status: 404 })
  }

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') === 'svg' ? 'svg' : 'png'
  const env = searchParams.get('env') === 'production' ? 'production' : 'staging'
  const size = Math.min(2048, Math.max(600, parseInt(searchParams.get('size') || '1024', 10)))
  const isInline = searchParams.get('inline') === 'true'
  const disposition = isInline ? 'inline' : 'attachment'

  try {
    if (format === 'svg') {
      const svgString = await generateTableQrSvg(table.tableNumber, { env })
      const filename = `sela-meja-${table.tableNumber}-${env}.svg`

      return new NextResponse(svgString, {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Content-Disposition': `${disposition}; filename="${filename}"`,
          'Cache-Control': 'no-store, no-cache',
        },
      })
    }

    const pngBuffer = await generateTableQrPng(table.tableNumber, { size, env })
    const filename = `sela-meja-${table.tableNumber}-${env}.png`

    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': 'no-store, no-cache',
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Gagal menghasilkan kode QR meja.'
    console.error('Failed to generate table QR:', err)
    return NextResponse.json({ error: 'QR_GENERATION_FAILED', message }, { status: 400 })
  }
}
