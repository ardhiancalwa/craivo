import { NextResponse } from 'next/server'
import { verifyOrderOrStaffAccess, OrderAccessError } from '@/lib/server/order-access'
import {
  formatThermalReceipt,
  formatKitchenTicket,
  generatePrintableHtml,
  type ThermalPaperWidth,
  type ReceiptDocumentType,
} from '@/lib/receipt-formatter'
import { getPrintSummary } from '@/lib/server/print-service'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: Request, { params }: RouteParams) {
  const { id: orderId } = await params
  const { searchParams } = new URL(request.url)

  const formatParam = searchParams.get('format') === 'html' ? 'html' : 'txt'
  const paperParam: ThermalPaperWidth = searchParams.get('paper') === '80mm' ? '80mm' : '58mm'
  const typeParam: ReceiptDocumentType =
    searchParams.get('type') === 'kitchen'
      ? 'kitchen'
      : searchParams.get('type') === 'cashier'
        ? 'cashier'
        : 'customer'

  try {
    // 1. Verifikasi hak akses
    const access = await verifyOrderOrStaffAccess(orderId, request, {
      allowedRoles: ['CASHIER', 'ADMIN', 'BARISTA'],
      allowCustomer: true,
    })

    // 2. Proteksi dokumen staf: Tamu pelanggan dilarang mengunduh dokumen kasir atau dapur
    if (access.actorType === 'CUSTOMER' && typeParam !== 'customer') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Pelanggan tidak berwenang mengunduh dokumen operasional staf.' },
        { status: 403 }
      )
    }

    // 3. Barista tidak boleh mengunduh struk kasir
    if (access.actorType === 'STAFF' && access.staffUser?.role === 'BARISTA' && typeParam === 'cashier') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Barista tidak berwenang mengakses struk kasir.' },
        { status: 403 }
      )
    }

    const { order } = access

    // Ambil summary print status untuk mengetahui reprint status
    const docTypeEnum =
      typeParam === 'kitchen'
        ? 'KITCHEN_TICKET'
        : typeParam === 'cashier'
          ? 'CASHIER_RECEIPT'
          : 'CUSTOMER_RECEIPT'

    const printSummary = await getPrintSummary(orderId, docTypeEnum)
    const isReprint = printSummary.isReprint
    const reprintCount = printSummary.reprintCount
    const cashierName = access.staffUser?.displayName || null

    if (formatParam === 'html') {
      const html = generatePrintableHtml({
        type: typeParam,
        paper: paperParam,
        order,
        isReprint,
        reprintCount,
        cashierName,
      })

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Content-Disposition': `attachment; filename="sela-${typeParam}-${order.orderNumber}-${paperParam}.html"`,
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      })
    }

    // Default: Plain text monospaced (.txt)
    const textContent =
      typeParam === 'kitchen'
        ? formatKitchenTicket(order, { paper: paperParam, isReprint, reprintCount })
        : formatThermalReceipt(order, { paper: paperParam, isReprint, reprintCount, cashierName })

    return new Response(textContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="sela-${typeParam}-${order.orderNumber}-${paperParam}.txt"`,
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
      },
    })
  } catch (err) {
    if (err instanceof OrderAccessError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.statusCode }
      )
    }

    console.error('Error generating receipt download:', err)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Gagal menghasilkan berkas struk.' },
      { status: 500 }
    )
  }
}

