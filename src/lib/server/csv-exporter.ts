import 'server-only'

export interface TransactionCsvRow {
  orderNumber: string
  createdAtJakarta: string
  tableNumber: string
  paymentMethod: string
  paymentStatus: string
  orderStatus: string
  subtotal: number
  service: number
  tax: number
  totalGross: number
  refundAmount: number
  totalNet: number
  itemSummary: string
  customerNotes?: string | null
  refundReason?: string | null
}

/**
 * Sanitasi sebuah nilai sel CSV untuk mencegah serangan CSV Formula Injection (CWE-1236).
 * Jika string diawali dengan karakter formula spreadsheet: '=', '+', '-', '@', '\t', '\r', '%'
 * maka string akan diberi awalan tanda petik tunggal (') sehingga aplikasi spreadsheet
 * (Excel, Google Sheets, LibreOffice) memperlakukannya murni sebagai teks literal.
 */
export function sanitizeCsvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '""'
  }

  let str = String(value)

  // Periksa apakah string berpotensi dieksekusi sebagai formula spreadsheet
  if (/^[=+\-@\t\r%]/.test(str)) {
    str = "'" + str
  }

  // Escape tanda kutip ganda standar RFC 4180 (" -> "")
  const escaped = str.replace(/"/g, '""')
  return `"${escaped}"`
}

/**
 * Menghasilkan konten string CSV terstandar RFC 4180 lengkap dengan UTF-8 BOM
 * untuk kompatibilitas tampilan karakter dan aksen di Microsoft Excel & Google Sheets.
 */
export function generateTransactionsCsv(rows: TransactionCsvRow[]): string {
  const headers = [
    'Nomor Order',
    'Waktu Transaksi (WIB)',
    'Nomor Meja',
    'Metode Bayar',
    'Status Pembayaran',
    'Status Dapur',
    'Subtotal (IDR)',
    'Biaya Layanan (IDR)',
    'Pajak PB1 (IDR)',
    'Total Kotor (IDR)',
    'Total Refund (IDR)',
    'Total Bersih (IDR)',
    'Rincian Menu',
    'Catatan Pelanggan',
    'Alasan Refund / Void',
  ]

  const headerLine = headers.map((h) => sanitizeCsvCell(h)).join(',')

  const dataLines = rows.map((r) => {
    return [
      sanitizeCsvCell(r.orderNumber),
      sanitizeCsvCell(r.createdAtJakarta),
      sanitizeCsvCell(r.tableNumber),
      sanitizeCsvCell(r.paymentMethod),
      sanitizeCsvCell(r.paymentStatus),
      sanitizeCsvCell(r.orderStatus),
      sanitizeCsvCell(r.subtotal),
      sanitizeCsvCell(r.service),
      sanitizeCsvCell(r.tax),
      sanitizeCsvCell(r.totalGross),
      sanitizeCsvCell(r.refundAmount),
      sanitizeCsvCell(r.totalNet),
      sanitizeCsvCell(r.itemSummary),
      sanitizeCsvCell(r.customerNotes || '-'),
      sanitizeCsvCell(r.refundReason || '-'),
    ].join(',')
  })

  // UTF-8 Byte Order Mark (\uFEFF)
  return '\uFEFF' + [headerLine, ...dataLines].join('\r\n')
}

