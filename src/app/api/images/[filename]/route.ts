import { NextResponse } from 'next/server'
import prisma from '@/lib/server/db'

interface RouteParams {
  params: Promise<{ filename: string }>
}

export const dynamic = 'force-dynamic'

export async function GET(request: Request, { params }: RouteParams) {
  const { filename } = await params

  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'BAD_REQUEST', message: 'Nama berkas tidak sah.' }, { status: 400 })
  }

  const image = await prisma.menuImage.findUnique({
    where: { filename },
  })

  if (!image) {
    return NextResponse.json({ error: 'NOT_FOUND', message: 'Gambar tidak ditemukan.' }, { status: 404 })
  }

  return new NextResponse(image.data, {
    status: 200,
    headers: {
      'Content-Type': image.mimeType,
      'Content-Length': image.size.toString(),
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}

