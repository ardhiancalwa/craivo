import 'server-only'
import QRCode from 'qrcode'
import JSZip from 'jszip'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import prisma from './db'

export interface ResolvedTargetUrl {
  targetUrl: string
  baseUrl: string
  isProduction: boolean
  isBlocked: boolean
  status: 'READY' | 'BLOCKED'
  reason?: string
}

/**
 * Menentukan target basis URL dan URL publik resmi meja kafe berdasarkan lingkungan yang dipilih.
 *
 * Kebijakan Integritas & Proteksi Domain (DEC-016):
 * - Lingkungan Staging: Menggunakan NEXT_PUBLIC_APP_URL tervalidasi.
 * - Lingkungan Produksi: Memeriksa ketersediaan domain produksi permanen (productionDomain).
 *   Jika domain produksi belum dikonfigurasi / belum valid HTTPS, ekspor master produksi
 *   DIBLOKIR (isBlocked: true) guna mencegah pemborosan biaya cetak akrilik pada URL sementara.
 */
export async function resolveTableTargetUrl(
  tableNumber: string,
  env: 'staging' | 'production' = 'staging'
): Promise<ResolvedTargetUrl> {
  const cleanTableNumber = tableNumber.trim()
  const config = await prisma.cravioConfig.findUnique({ where: { id: 'cravio-main-config' } })

  const stagingBaseUrl = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/+$/, '')

  if (env === 'staging') {
    return {
      targetUrl: `${stagingBaseUrl}/order?table=${encodeURIComponent(cleanTableNumber)}`,
      baseUrl: stagingBaseUrl,
      isProduction: false,
      isBlocked: false,
      status: 'READY',
    }
  }

  // Validasi domain produksi
  const prodDomain = config?.productionDomain?.trim() || process.env.PRODUCTION_DOMAIN?.trim()
  const isValidProdDomain = Boolean(
    prodDomain &&
      /^https?:\/\//i.test(prodDomain) &&
      !prodDomain.includes('localhost') &&
      !prodDomain.includes('127.0.0.1')
  )

  if (!isValidProdDomain) {
    return {
      targetUrl: '',
      baseUrl: '',
      isProduction: true,
      isBlocked: true,
      status: 'BLOCKED',
      reason:
        'Domain produksi permanen belum dikonfigurasi. Untuk mencegah kerugian biaya cetak fisik akrilik/stiker permanen, master cetak produksi diblokir sampai domain final tervalidasi di pengaturan kafe. Silakan gunakan QR Staging untuk keperluan pengujian operasional.',
    }
  }

  const cleanProdBaseUrl = prodDomain!.replace(/\/+$/, '')
  return {
    targetUrl: `${cleanProdBaseUrl}/order?table=${encodeURIComponent(cleanTableNumber)}`,
    baseUrl: cleanProdBaseUrl,
    isProduction: true,
    isBlocked: false,
    status: 'READY',
  }
}

/**
 * Menghasilkan buffer gambar PNG kode QR meja resolusi tinggi (minimal 600px, default 1024x1024 px pada 300 DPI)
 * dengan kontras warna tinggi dan batas aman (quiet zone 4 modul ISO).
 */
export async function generateTableQrPng(
  tableNumber: string,
  options?: { size?: number; env?: 'staging' | 'production' }
): Promise<Buffer> {
  const resolved = await resolveTableTargetUrl(tableNumber, options?.env || 'staging')
  if (resolved.isBlocked) {
    throw new Error(resolved.reason || 'Ekspor QR produksi diblokir.')
  }

  const size = Math.max(600, options?.size || 1024)

  return QRCode.toBuffer(resolved.targetUrl, {
    type: 'png',
    width: size,
    margin: 4, // 4 modules quiet zone
    errorCorrectionLevel: 'Q', // 25% redundancy
    color: {
      dark: '#1A1412', // Dark coffee brand color
      light: '#FFFFFF',
    },
  })
}

/**
 * Menghasilkan string XML vektor SVG kode QR murni untuk studio grafis percetakan akrilik.
 */
export async function generateTableQrSvg(
  tableNumber: string,
  options?: { env?: 'staging' | 'production' }
): Promise<string> {
  const resolved = await resolveTableTargetUrl(tableNumber, options?.env || 'staging')
  if (resolved.isBlocked) {
    throw new Error(resolved.reason || 'Ekspor QR produksi diblokir.')
  }

  return QRCode.toString(resolved.targetUrl, {
    type: 'svg',
    margin: 4,
    errorCorrectionLevel: 'Q',
    color: {
      dark: '#1A1412',
      light: '#FFFFFF',
    },
  })
}

/**
 * Menghasilkan paket arsip berkas ZIP terkompresi berisi seluruh QR meja aktif (PNG + SVG)
 * beserta panduan teks spesifikasi cetak akrilik (README-CETAK-MEJA.txt).
 */
export async function generateTablesZip(
  env: 'staging' | 'production' = 'staging'
): Promise<Buffer> {
  const tables = await prisma.table.findMany({
    where: { isActive: true },
    orderBy: { tableNumber: 'asc' },
  })

  if (tables.length === 0) {
    throw new Error('Tidak ada meja aktif yang dapat diekspor.')
  }

  const sampleTable = tables[0]!
  const resolvedSample = await resolveTableTargetUrl(sampleTable.tableNumber, env)
  if (resolvedSample.isBlocked) {
    throw new Error(resolvedSample.reason || 'Ekspor QR produksi massal diblokir.')
  }

  const zip = new JSZip()

  const readmeContent = [
    '========================================================================',
    `CRAVIO — SELA ARTISANAL COFFEE & BAKE (${env.toUpperCase()} MASTER QR CODES)`,
    '========================================================================',
    `Tanggal Generate : ${new Date().toISOString()}`,
    `Lingkungan Target: ${env.toUpperCase()}`,
    `Basis URL        : ${resolvedSample.baseUrl}`,
    `Total Meja Aktif : ${tables.length}`,
    '',
    'PETUNJUK CETAK STAND AKRILIK / STIKER MEJA:',
    '1. Berkas PNG (1024x1024 px pada 300 DPI) siap dicetak pada stiker meja atau kartu akrilik ukuran 7x10 cm atau 10x15 cm.',
    '2. Berkas SVG adalah format vektor murni tanpa batas resolusi, ideal untuk diserahkan kepada percetakan profesional.',
    '3. Pastikan quiet zone (area putih di sekeliling kode QR) tidak terpotong saat proses pemotongan kartu.',
    '4. PENTING: Lakukan pemindaian sampel cetak fisik pertama menggunakan smartphone sebelum mencetak massal seluruh meja.',
    '',
    'DAFTAR MEJA DAN URL:',
    ...tables.map(
      (t) =>
        `- Meja ${t.tableNumber}: ${t.label || 'Meja ' + t.tableNumber} -> ${resolvedSample.baseUrl}/order?table=${t.tableNumber}`
    ),
    '========================================================================',
  ].join('\r\n')

  zip.file('README-CETAK-MEJA.txt', readmeContent)

  const pngFolder = zip.folder('png')
  const svgFolder = zip.folder('svg')

  for (const table of tables) {
    const pngBuffer = await generateTableQrPng(table.tableNumber, { size: 1024, env })
    const svgString = await generateTableQrSvg(table.tableNumber, { env })

    pngFolder?.file(`sela-meja-${table.tableNumber}.png`, pngBuffer)
    svgFolder?.file(`sela-meja-${table.tableNumber}.svg`, svgString)
  }

  const nodeBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  return nodeBuffer
}

/**
 * Menghasilkan dokumen PDF A4 (210 x 297 mm) siap cetak dan siap potong.
 * Tata letak grid kartu meja (4 kartu per lembar A4, ukuran kartu ~90 x 132 mm).
 * Elemen kartu mencakup logo SELA, nomor meja tebal >= 28px, QR PNG tajam,
 * instruksi scan, URL teks cadangan, garis batas potong (crop marks), dan watermark status.
 */
export async function generatePrintReadyA4Pdf(
  env: 'staging' | 'production' = 'staging'
): Promise<Buffer> {
  const tables = await prisma.table.findMany({
    where: { isActive: true },
    orderBy: { tableNumber: 'asc' },
  })

  if (tables.length === 0) {
    throw new Error('Tidak ada meja aktif untuk dicetak.')
  }

  const sampleTable = tables[0]!
  const resolvedSample = await resolveTableTargetUrl(sampleTable.tableNumber, env)
  if (resolvedSample.isBlocked) {
    throw new Error(resolvedSample.reason || 'Cetak master PDF produksi diblokir.')
  }

  // Buat PDFDocument A4: 595.28 pt x 841.89 pt
  const pdfDoc = await PDFDocument.create()
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

  // Pengaturan grid: 2 kolom x 2 baris (4 kartu per lembar A4)
  const PAGE_WIDTH = 595.28
  const PAGE_HEIGHT = 841.89
  const MARGIN_X = 36 // ~12.7 mm
  const MARGIN_Y = 36
  const GAP_X = 20
  const GAP_Y = 20

  const CARD_WIDTH = (PAGE_WIDTH - 2 * MARGIN_X - GAP_X) / 2 // ~251.6 pt (~88.7 mm)
  const CARD_HEIGHT = (PAGE_HEIGHT - 2 * MARGIN_Y - GAP_Y) / 2 // ~374.9 pt (~132.2 mm)

  const CARDS_PER_PAGE = 4
  const totalPages = Math.ceil(tables.length / CARDS_PER_PAGE)

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    const pageTables = tables.slice(pageIdx * CARDS_PER_PAGE, (pageIdx + 1) * CARDS_PER_PAGE)

    for (let cardIdx = 0; cardIdx < pageTables.length; cardIdx++) {
      const table = pageTables[cardIdx]!
      const col = cardIdx % 2 // 0 (kiri), 1 (kanan)
      const row = Math.floor(cardIdx / 2) // 0 (atas), 1 (bawah)

      const cardX = MARGIN_X + col * (CARD_WIDTH + GAP_X)
      // Koordinat Y di PDF dihitung dari bawah ke atas
      const cardY = PAGE_HEIGHT - MARGIN_Y - (row + 1) * CARD_HEIGHT - row * GAP_Y

      // 1. Gambar kotak kartu dan garis potong halus (crop guidelines)
      page.drawRectangle({
        x: cardX,
        y: cardY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderColor: rgb(0.85, 0.85, 0.85),
        borderWidth: 1,
        color: rgb(1, 1, 1),
      })

      // Garis batas potong pojok (corner crop marks)
      const markLength = 8
      // Pojok kiri atas
      page.drawLine({
        start: { x: cardX - markLength, y: cardY + CARD_HEIGHT },
        end: { x: cardX, y: cardY + CARD_HEIGHT },
        color: rgb(0.6, 0.6, 0.6),
        thickness: 0.5,
      })
      page.drawLine({
        start: { x: cardX, y: cardY + CARD_HEIGHT },
        end: { x: cardX, y: cardY + CARD_HEIGHT + markLength },
        color: rgb(0.6, 0.6, 0.6),
        thickness: 0.5,
      })

      // 2. Header Kartu: Logo / Nama Brand SELA
      const titleText = 'SELA'
      const titleWidth = fontBold.widthOfTextAtSize(titleText, 18)
      page.drawText(titleText, {
        x: cardX + (CARD_WIDTH - titleWidth) / 2,
        y: cardY + CARD_HEIGHT - 32,
        size: 18,
        font: fontBold,
        color: rgb(0.1, 0.08, 0.07), // #1A1412
      })

      const subText = 'Artisanal Coffee & Bake'
      const subWidth = fontItalic.widthOfTextAtSize(subText, 9)
      page.drawText(subText, {
        x: cardX + (CARD_WIDTH - subWidth) / 2,
        y: cardY + CARD_HEIGHT - 46,
        size: 9,
        font: fontItalic,
        color: rgb(0.4, 0.35, 0.3),
      })

      // Garis pembatas tipis elegan
      page.drawLine({
        start: { x: cardX + 30, y: cardY + CARD_HEIGHT - 54 },
        end: { x: cardX + CARD_WIDTH - 30, y: cardY + CARD_HEIGHT - 54 },
        color: rgb(0.9, 0.88, 0.85),
        thickness: 1,
      })

      // 3. Nomor / Label Meja (Sangat Mencolok >= 28px)
      const tableText = `MEJA ${table.tableNumber}`
      const tableTextWidth = fontBold.widthOfTextAtSize(tableText, 28)
      page.drawText(tableText, {
        x: cardX + (CARD_WIDTH - tableTextWidth) / 2,
        y: cardY + CARD_HEIGHT - 90,
        size: 28,
        font: fontBold,
        color: rgb(0.1, 0.08, 0.07),
      })

      if (table.label && table.label !== `Meja ${table.tableNumber}`) {
        const labelText = table.label
        const labelWidth = fontRegular.widthOfTextAtSize(labelText, 10)
        page.drawText(labelText, {
          x: cardX + (CARD_WIDTH - labelWidth) / 2,
          y: cardY + CARD_HEIGHT - 105,
          size: 10,
          font: fontRegular,
          color: rgb(0.45, 0.4, 0.35),
        })
      }

      // 4. Generate dan Embed Gambar QR PNG
      const qrPngBuffer = await generateTableQrPng(table.tableNumber, { size: 600, env })
      const qrImage = await pdfDoc.embedPng('data:image/png;base64,' + qrPngBuffer.toString('base64'))
      const qrSize = 145 // 145 pt (~51 mm di kertas)
      const qrX = cardX + (CARD_WIDTH - qrSize) / 2
      const qrY = cardY + 70

      page.drawImage(qrImage, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      })

      // 5. Instruksi Pemindaian
      const instructTitle = 'PINDAI UNTUK MEMESAN'
      const instructTitleWidth = fontBold.widthOfTextAtSize(instructTitle, 10)
      page.drawText(instructTitle, {
        x: cardX + (CARD_WIDTH - instructTitleWidth) / 2,
        y: cardY + 52,
        size: 10,
        font: fontBold,
        color: rgb(0.15, 0.12, 0.1),
      })

      const instructSub = 'Arahkan kamera ponsel Anda ke kode QR'
      const instructSubWidth = fontRegular.widthOfTextAtSize(instructSub, 8)
      page.drawText(instructSub, {
        x: cardX + (CARD_WIDTH - instructSubWidth) / 2,
        y: cardY + 40,
        size: 8,
        font: fontRegular,
        color: rgb(0.4, 0.4, 0.4),
      })

      // 6. URL Teks Cadangan
      const fallbackUrl = `${resolvedSample.baseUrl}/order?table=${table.tableNumber}`
      const fallbackWidth = fontRegular.widthOfTextAtSize(fallbackUrl, 7)
      page.drawText(fallbackUrl, {
        x: cardX + (CARD_WIDTH - fallbackWidth) / 2,
        y: cardY + 24,
        size: 7,
        font: fontRegular,
        color: rgb(0.55, 0.55, 0.55),
      })

      // 7. Watermark Staging jika dalam mode Staging
      if (env === 'staging') {
        const watermarkText = 'STAGING / PREVIEW'
        const wmWidth = fontBold.widthOfTextAtSize(watermarkText, 9)
        page.drawText(watermarkText, {
          x: cardX + (CARD_WIDTH - wmWidth) / 2,
          y: cardY + 10,
          size: 9,
          font: fontBold,
          color: rgb(0.85, 0.45, 0.1), // Oranye kemerahan
        })
      }
    }
  }

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}
