import 'server-only'

export const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB safety headroom
export const MIN_IMAGE_DIMENSION = 100 // 100 px
export const MAX_IMAGE_DIMENSION = 4000 // 4000 px

export interface ImageValidationResult {
  isValid: boolean
  mimeType?: 'image/jpeg' | 'image/png' | 'image/webp'
  extension?: 'jpg' | 'png' | 'webp'
  width?: number
  height?: number
  size: number
  error?: string
}

/**
 * Validasi biner mendalam untuk berkas foto menu:
 * 1. Batas ukuran maksimal 2 MB.
 * 2. Magic bytes biner sebenarnya (JPG, PNG, WebP) — bukan sekadar MIME header / ekstensi nama.
 * 3. Ekstraksi dimensi gambar dan batas pemrosesan (100x100 s/d 4000x4000 px) untuk mencegah decompression bomb.
 */
export function validateImageBuffer(buffer: Buffer): ImageValidationResult {
  const size = buffer.length

  if (size === 0) {
    return { isValid: false, size: 0, error: 'Berkas kosong (0 byte).' }
  }

  if (size > MAX_IMAGE_SIZE_BYTES) {
    return {
      isValid: false,
      size,
      error: `Ukuran berkas (${(size / (1024 * 1024)).toFixed(2)} MB) melebihi batas maksimal 2 MB.`,
    }
  }

  // 1. Deteksi PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    // IHDR chunk: width at byte 16 (4 bytes BE), height at byte 20 (4 bytes BE)
    const width = buffer.readUInt32BE(16)
    const height = buffer.readUInt32BE(20)

    return checkDimensions(width, height, size, 'image/png', 'png')
  }

  // 2. Deteksi JPEG: FF D8 FF
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    const dimensions = parseJpegDimensions(buffer)
    if (!dimensions) {
      return {
        isValid: false,
        size,
        error: 'Struktur frame JPEG tidak valid atau rusak.',
      }
    }
    return checkDimensions(dimensions.width, dimensions.height, size, 'image/jpeg', 'jpg')
  }

  // 3. Deteksi WebP: RIFF (offset 0..3) ... WEBP (offset 8..11)
  if (
    buffer.length >= 30 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    const dimensions = parseWebpDimensions(buffer)
    if (!dimensions) {
      return {
        isValid: false,
        size,
        error: 'Struktur header WebP tidak valid atau rusak.',
      }
    }
    return checkDimensions(dimensions.width, dimensions.height, size, 'image/webp', 'webp')
  }

  // Format tidak dikenal atau berbahaya (SVG, HTML polyglot, PHP, script, executable)
  return {
    isValid: false,
    size,
    error: 'Format berkas tidak diizinkan. Hanya menerima format JPG, PNG, atau WebP murni.',
  }
}

function checkDimensions(
  width: number,
  height: number,
  size: number,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
  extension: 'jpg' | 'png' | 'webp'
): ImageValidationResult {
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return {
      isValid: false,
      size,
      width,
      height,
      error: `Dimensi gambar terlalu kecil (${width}x${height} px). Minimal ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION} px.`,
    }
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return {
      isValid: false,
      size,
      width,
      height,
      error: `Dimensi gambar terlalu besar (${width}x${height} px). Maksimal ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION} px.`,
    }
  }

  return {
    isValid: true,
    size,
    width,
    height,
    mimeType,
    extension,
  }
}

function parseJpegDimensions(buffer: Buffer): { width: number; height: number } | null {
  let offset = 2
  while (offset < buffer.length - 8) {
    if (buffer[offset] !== 0xff) {
      offset++
      continue
    }

    const marker = buffer[offset + 1]
    if (marker === undefined) break

    // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      const height = buffer.readUInt16BE(offset + 5)
      const width = buffer.readUInt16BE(offset + 7)
      return { width, height }
    }

    // Skip variable-length marker segment
    if (marker !== 0xd8 && marker !== 0xd9 && marker !== 0x00) {
      const length = buffer.readUInt16BE(offset + 2)
      offset += 2 + length
    } else {
      offset += 2
    }
  }
  return null
}

function parseWebpDimensions(buffer: Buffer): { width: number; height: number } | null {
  const formatChunk = buffer.subarray(12, 16).toString('ascii')

  // VP8 (Lossy)
  if (formatChunk === 'VP8 ' && buffer.length >= 30) {
    const rawWidth = buffer.readUInt16LE(26) & 0x3fff
    const rawHeight = buffer.readUInt16LE(28) & 0x3fff
    return { width: rawWidth, height: rawHeight }
  }

  // VP8L (Lossless)
  if (formatChunk === 'VP8L' && buffer.length >= 25) {
    if (buffer[20] === 0x2f) {
      const b1 = buffer[21] ?? 0
      const b2 = buffer[22] ?? 0
      const b3 = buffer[23] ?? 0
      const b4 = buffer[24] ?? 0
      const width = 1 + (((b2 & 0x3f) << 8) | b1)
      const height = 1 + (((b4 & 0xf) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      return { width, height }
    }
  }

  // VP8X (Extended)
  if (formatChunk === 'VP8X' && buffer.length >= 30) {
    const width = 1 + buffer.readUIntLE(24, 3)
    const height = 1 + buffer.readUIntLE(27, 3)
    return { width, height }
  }

  return null
}

