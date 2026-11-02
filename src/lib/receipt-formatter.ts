import { formatIDR } from './utils'

export type ThermalPaperWidth = '58mm' | '80mm'
export type ReceiptDocumentType = 'customer' | 'cashier' | 'kitchen'

export interface ReceiptItemModifierSnapshot {
  id?: string
  nameSnapshot: string
  priceSnapshot?: number
}

export interface ReceiptItemSnapshot {
  id?: string
  nameSnapshot: string
  priceSnapshot?: number
  quantity: number
  notes?: string | null
  subtotal?: number
  modifiers?: ReceiptItemModifierSnapshot[]
}

export interface ReceiptOrderData {
  id: string
  orderNumber: string
  table: {
    tableNumber: string
  }
  paymentMethod: string
  paymentStatus: string
  createdAt: Date | string
  paidAt?: Date | string | null
  customerNotes?: string | null
  subtotalAmount: number
  taxAmount: number
  serviceAmount: number
  totalAmount: number
  items: ReceiptItemSnapshot[]
}

export interface FormatThermalOptions {
  paper?: ThermalPaperWidth
  isReprint?: boolean
  reprintCount?: number
  cashierName?: string | null
}

/**
 * Memformat tanggal ke zona waktu WIB (Asia/Jakarta)
 */
export function formatWibDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Jakarta',
  }).format(d) + ' WIB'
}

// Helpers teks monospaced
function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + ' '.repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  return str.length >= len ? str : ' '.repeat(len - str.length) + str
}

function center(str: string, len: number): string {
  if (str.length >= len) return str
  const left = Math.floor((len - str.length) / 2)
  const right = len - str.length - left
  return ' '.repeat(left) + str + ' '.repeat(right)
}

function divider(char = '-', len = 32): string {
  return char.repeat(len)
}

/**
 * Membungkus teks panjang menjadi array string sesuai lebar maksimal
 */
export function wrapText(text: string, maxWidth: number): string[] {
  if (!text || text.length <= maxWidth) return [text || '']
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if (word.length > maxWidth) {
      if (currentLine) lines.push(currentLine)
      for (let i = 0; i < word.length; i += maxWidth) {
        lines.push(word.substring(i, i + maxWidth))
      }
      currentLine = ''
      continue
    }

    if (currentLine.length + word.length + (currentLine ? 1 : 0) <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }

  if (currentLine) lines.push(currentLine)
  return lines
}

/**
 * Format string monospaced untuk Struk Pelanggan & Kasir
 * Target kolom: 32 kolom (58mm) atau 48 kolom (80mm)
 */
export function formatThermalReceipt(
  order: ReceiptOrderData,
  options: FormatThermalOptions = {}
): string {
  const {
    paper = '58mm',
    isReprint = false,
    reprintCount = 0,
    cashierName = null,
  } = options

  const cols = paper === '80mm' ? 48 : 32
  const lines: string[] = []

  // 1. Watermark Cetak Ulang jika isReprint
  if (isReprint) {
    const attemptText = reprintCount > 0 ? ` #${reprintCount + 1}` : ''
    lines.push(divider('=', cols))
    lines.push(center(`*** CETAK ULANG (REPRINT)${attemptText} ***`, cols))
    lines.push(divider('=', cols))
  } else {
    lines.push(divider('=', cols))
  }

  // 2. Header Toko SELA
  lines.push(center('SELA', cols))
  lines.push(center('ARTISANAL COFFEE & BAKE', cols))
  lines.push(center('Jl. Senopati No. 42, Jakarta', cols))
  lines.push(divider('=', cols))

  // 3. Metadata Pesanan
  lines.push(`No. Order : ${order.orderNumber}`)
  lines.push(`Meja      : MEJA ${order.table.tableNumber}`)
  lines.push(`Waktu     : ${formatWibDateTime(order.createdAt)}`)
  if (cashierName) {
    lines.push(`Kasir     : ${cashierName}`)
  } else {
    lines.push(`Kasir     : Sistem QR (Online)`)
  }

  const methodLabel = order.paymentMethod === 'QRIS' ? 'QRIS DINAMIS' : 'TUNAI (CASH)'
  lines.push(`Metode    : ${methodLabel}`)

  // Status Finansial Aktual
  const isPaid = order.paymentStatus === 'PAID'
  if (isPaid) {
    lines.push(`Status    : LUNAS (PAID)`)
    if (order.paidAt) {
      lines.push(`Lunas pd  : ${formatWibDateTime(order.paidAt)}`)
    }
  } else if (order.paymentStatus === 'WAITING_CASHIER') {
    lines.push(`Status    : MENUNGGU PEMBAYARAN KASIR`)
    lines.push(center('*** BELUM LUNAS ***', cols))
  } else if (order.paymentStatus === 'CANCELLED') {
    lines.push(`Status    : DIBATALKAN (CANCELLED)`)
  } else {
    lines.push(`Status    : BELUM LUNAS (${order.paymentStatus})`)
  }

  lines.push(divider('-', cols))

  // 4. Header Kolom Item
  const priceColWidth = cols === 48 ? 12 : 9
  const qtyColWidth = cols === 48 ? 4 : 3
  const itemColWidth = cols - qtyColWidth - priceColWidth - 2

  const headerLine =
    padRight('QTY', qtyColWidth) +
    ' ' +
    padRight('ITEM', itemColWidth) +
    ' ' +
    padLeft('TOTAL', priceColWidth)
  lines.push(headerLine)
  lines.push(divider('-', cols))

  // 5. Daftar Item Snapshot
  for (const item of order.items) {
    const qtyStr = padRight(`${item.quantity}x`, qtyColWidth)
    const priceStr = padLeft(formatIDR(item.subtotal ?? 0).replace('Rp', ''), priceColWidth)

    const wrappedNames = wrapText(item.nameSnapshot, itemColWidth)
    // Baris pertama item
    lines.push(qtyStr + ' ' + padRight(wrappedNames[0] ?? '', itemColWidth) + ' ' + priceStr)

    // Sisa baris nama item jika panjang
    for (let i = 1; i < wrappedNames.length; i++) {
      lines.push(' '.repeat(qtyColWidth + 1) + padRight(wrappedNames[i] ?? '', itemColWidth))
    }

    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modLines = wrapText(`+ ${mod.nameSnapshot}`, itemColWidth)
        for (const ml of modLines) {
          lines.push(' '.repeat(qtyColWidth + 2) + ml)
        }
      }
    }

    // Catatan item
    if (item.notes) {
      const noteLines = wrapText(`* "${item.notes}"`, itemColWidth)
      for (const nl of noteLines) {
        lines.push(' '.repeat(qtyColWidth + 2) + nl)
      }
    }
  }

  lines.push(divider('-', cols))

  // 6. Subtotal & Ringkasan Keuangan
  const labelWidth = cols - 12
  lines.push(padRight('Subtotal', labelWidth) + padLeft(formatIDR(order.subtotalAmount).replace('Rp', ''), 12))
  lines.push(padRight('Pajak (PB1 0%)', labelWidth) + padLeft(formatIDR(order.taxAmount).replace('Rp', ''), 12))
  lines.push(padRight('Layanan (0%)', labelWidth) + padLeft(formatIDR(order.serviceAmount).replace('Rp', ''), 12))
  lines.push(divider('-', cols))

  // Total
  lines.push(padRight('TOTAL AKHIR', labelWidth) + padLeft(formatIDR(order.totalAmount).replace('Rp', ''), 12))
  lines.push(divider('=', cols))

  // 7. Footer
  if (order.paymentStatus === 'WAITING_CASHIER') {
    lines.push(center('PERHATIAN: BUKAN BUKTI LUNAS', cols))
    lines.push(center('Selesaikan pembayaran di kasir', cols))
  } else if (isPaid) {
    lines.push(center('*** SIMPAN SEBAGAI BUKTI BAYAR ***', cols))
    lines.push(center('Terima kasih atas kunjungan Anda!', cols))
  } else {
    lines.push(center('Terima kasih atas kunjungan Anda!', cols))
  }
  lines.push(divider('=', cols))

  return lines.join('\n')
}

/**
 * Format string monospaced untuk Tiket Dapur & Barista
 * MUTLAK TANPA HARGA/RUPIAH/FINANCIAL AMOUNTS.
 * Menonjolkan Nomor Meja, Nomor Pesanan, Item, Modifiers, Catatan.
 */
export function formatKitchenTicket(
  order: ReceiptOrderData,
  options: FormatThermalOptions = {}
): string {
  const {
    paper = '58mm',
    isReprint = false,
    reprintCount = 0,
  } = options

  const cols = paper === '80mm' ? 48 : 32
  const lines: string[] = []

  // 1. Watermark Reprint Dapur jika ada
  if (isReprint) {
    const attemptText = reprintCount > 0 ? ` #${reprintCount + 1}` : ''
    lines.push(divider('=', cols))
    lines.push(center(`*** CETAK ULANG DAPUR${attemptText} ***`, cols))
    lines.push(divider('=', cols))
  } else {
    lines.push(divider('=', cols))
  }

  // 2. Header Tiket Dapur
  lines.push(center('[ TIKET DAPUR / BARISTA ]', cols))
  lines.push(divider('=', cols))

  // 3. Highlight Meja & Order
  lines.push(center(`*** MEJA ${order.table.tableNumber} ***`, cols))
  lines.push(`No. Order : ${order.orderNumber}`)
  lines.push(`Waktu     : ${formatWibDateTime(order.createdAt)}`)

  // Catatan Utama Pesanan Tamu
  if (order.customerNotes) {
    lines.push(divider('-', cols))
    lines.push(`Catatan Pesanan:`)
    const noteLines = wrapText(`"${order.customerNotes}"`, cols)
    for (const nl of noteLines) {
      lines.push(nl)
    }
  }

  lines.push(divider('-', cols))
  lines.push(padRight('QTY', 5) + ' PESANAN')
  lines.push(divider('-', cols))

  // 4. Daftar Item (Tanpa Rupiah)
  const itemWidth = cols - 6
  for (const item of order.items) {
    const qtyStr = padRight(`${item.quantity}x`, 5)
    const nameLines = wrapText(item.nameSnapshot, itemWidth)

    lines.push(qtyStr + ' ' + (nameLines[0] ?? ''))
    for (let i = 1; i < nameLines.length; i++) {
      lines.push('      ' + (nameLines[i] ?? ''))
    }

    // Modifiers
    if (item.modifiers && item.modifiers.length > 0) {
      for (const mod of item.modifiers) {
        const modLines = wrapText(`+ ${mod.nameSnapshot}`, itemWidth - 2)
        for (const ml of modLines) {
          lines.push('        ' + ml)
        }
      }
    }

    // Catatan racikan
    if (item.notes) {
      const itemNoteLines = wrapText(`* "${item.notes}"`, itemWidth - 2)
      for (const inl of itemNoteLines) {
        lines.push('        ' + inl)
      }
    }
    lines.push('') // Empty line between items for kitchen clarity
  }

  lines.push(divider('=', cols))
  lines.push(center('SELA KITCHEN ORDER SLIP', cols))
  lines.push(divider('=', cols))

  return lines.join('\n')
}

/**
 * Sanitasi string untuk mencegah injeksi HTML dan Stored XSS (CWE-79).
 */
export function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return ''
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * Menghasilkan berkas HTML mandiri (self-contained) yang siap dicetak via browser dialog
 */
export function generatePrintableHtml(options: {
  type: ReceiptDocumentType
  paper: ThermalPaperWidth
  order: ReceiptOrderData
  isReprint?: boolean
  reprintCount?: number
  cashierName?: string | null
}): string {
  const { type, paper, order, isReprint, reprintCount, cashierName } = options
  const isKitchen = type === 'kitchen'
  const rawTextContent = isKitchen
    ? formatKitchenTicket(order, { paper, isReprint, reprintCount })
    : formatThermalReceipt(order, { paper, isReprint, reprintCount, cashierName })

  const safeTextContent = escapeHtml(rawTextContent)
  const safeOrderNumber = escapeHtml(order.orderNumber)

  const paperWidthMm = paper === '80mm' ? '80mm' : '58mm'
  const printMaxWidthMm = paper === '80mm' ? '72mm' : '48mm'

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
  <title>${isKitchen ? 'Tiket Dapur' : 'Struk Transaksi'} - ${safeOrderNumber}</title>
  <style>
    @page {
      size: ${paperWidthMm} auto;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: #f4f4f4;
      color: #000;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Courier New", monospace;
      font-size: ${paper === '80mm' ? '12px' : '11px'};
      line-height: 1.25;
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .thermal-container {
      background: #fff;
      width: ${paperWidthMm};
      max-width: ${printMaxWidthMm};
      padding: 10px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      white-space: pre-wrap;
      word-break: break-word;
    }
    .toolbar {
      margin-bottom: 16px;
      display: flex;
      gap: 10px;
    }
    .btn {
      padding: 8px 16px;
      background: #924805;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-secondary {
      background: #333;
    }
    @media print {
      body {
        background: #fff !important;
        padding: 0 !important;
      }
      .toolbar {
        display: none !important;
      }
      .thermal-container {
        box-shadow: none !important;
        padding: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.print()">🖨️ Cetak Dokumen</button>
    <button class="btn btn-secondary" onclick="window.close()">Tutup</button>
  </div>
  <div class="thermal-container">${safeTextContent}</div>
</body>
</html>`
}
