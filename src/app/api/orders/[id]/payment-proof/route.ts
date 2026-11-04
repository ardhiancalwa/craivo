import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { prisma } from '@/lib/server/db'
import { validateImageBuffer } from '@/lib/server/image-validator'
import { saveMenuImage } from '@/lib/server/storage-service'
import { verifyCsrfOrigin } from '@/lib/server/csrf'
import { resolveGuestSession } from '@/lib/server/guest-session'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Endpoint publik tamu untuk mengunggah foto / tangkapan layar bukti transfer
 * untuk metode pembayaran QRIS Toko Kafe (Manual) dan Transfer Bank.
 * Terproteksi oleh orderSecretToken atau sesi tamu meja terkait.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!verifyCsrfOrigin(request)) {
    return NextResponse.json(
      { error: 'CSRF_REJECTED', message: 'Permintaan ditolak: Origin tidak sah.' },
      { status: 403 }
    )
  }

  const { id: orderId } = await params

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { table: true },
  })

  if (!order) {
    return NextResponse.json(
      { error: 'ORDER_NOT_FOUND', message: 'Pesanan tidak ditemukan.' },
      { status: 404 }
    )
  }

  // 1. Otorisasi Akses: Verifikasi Token Rahasia Pesanan atau Sesi Meja
  const authHeader = request.headers.get('authorization')
  const secretHeader = request.headers.get('x-order-secret-token')
  const cookieToken = request.cookies.get(`cravio_ot_${orderId}`)?.value

  const candidateToken =
    secretHeader ||
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null) ||
    cookieToken

  let isAuthorized = false

  if (candidateToken) {
    const candidateHash = crypto.createHash('sha256').update(candidateToken.trim()).digest('hex')
    if (candidateHash === order.orderSecretTokenHash) {
      isAuthorized = true
    }
  }

  // Fallback: jika token tidak ada, periksa apakah pemanggil adalah tamu di meja yang sama
  if (!isAuthorized) {
    const guestSession = await resolveGuestSession(request)
    if (guestSession && guestSession.tableId === order.tableId) {
      isAuthorized = true
    }
  }

  if (!isAuthorized) {
    return NextResponse.json(
      { error: 'UNAUTHORIZED', message: 'Akses ditolak: Token otentikasi pesanan tidak sah.' },
      { status: 403 }
    )
  }

  // 2. Baca Berkas Gambar dari FormData
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Format payload form-data tidak valid.' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Berkas bukti pembayaran wajib disertakan (field "file").' },
      { status: 400 }
    )
  }

  // Batas ukuran 15 MB
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json(
      { error: 'PAYLOAD_TOO_LARGE', message: 'Ukuran berkas terlalu besar (maksimal 15 MB).' },
      { status: 413 }
    )
  }

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // 3. Validasi Keamanan Magic Bytes
    const validation = validateImageBuffer(buffer)
    if (!validation.isValid) {
      return NextResponse.json(
        { error: 'INVALID_IMAGE', message: validation.error || 'Format gambar tidak valid atau tidak didukung.' },
        { status: 400 }
      )
    }

    // 4. Simpan Gambar ke Storage
    const saved = await saveMenuImage(buffer, validation)

    // 5. Update Record Order dengan URL Bukti Pembayaran
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'

    await prisma.$transaction([
      prisma.order.update({
        where: { id: order.id },
        data: {
          paymentProofUrl: saved.url,
        },
      }),
      prisma.auditLog.create({
        data: {
          orderId: order.id,
          action: 'PAYMENT_PROOF_UPLOADED',
          details: JSON.stringify({
            orderNumber: order.orderNumber,
            tableNumber: order.table.tableNumber,
            paymentProofUrl: saved.url,
            uploadedAt: new Date().toISOString(),
          }),
          ipAddress,
        },
      }),
    ])

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diunggah.',
      data: {
        paymentProofUrl: saved.url,
      },
    })
  } catch (err: unknown) {
    console.error('Failed to upload payment proof:', err)
    return NextResponse.json(
      { error: 'INTERNAL_SERVER_ERROR', message: 'Gagal memproses unggahan bukti pembayaran.' },
      { status: 500 }
    )
  }
}

