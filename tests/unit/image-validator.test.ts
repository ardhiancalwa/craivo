import { describe, it, expect } from 'vitest'
import {
  validateImageBuffer,
  MAX_IMAGE_SIZE_BYTES,
} from '@/lib/server/image-validator'

describe('Unit: Image Binary Validator (Deep Magic Bytes & Dimension Guard)', () => {
  // Helper membuat buffer PNG minimal yang valid dengan width dan height tertentu
  function createMockPngBuffer(width: number, height: number): Buffer {
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    // IHDR chunk: 4 bytes length (13), 4 bytes "IHDR", 4 bytes width, 4 bytes height, 5 bytes bit/color/crc
    const ihdr = Buffer.alloc(25)
    ihdr.writeUInt32BE(13, 0)
    ihdr.write('IHDR', 4, 'ascii')
    ihdr.writeUInt32BE(width, 8)
    ihdr.writeUInt32BE(height, 12)
    ihdr[16] = 8 // bit depth
    ihdr[17] = 2 // truecolor
    // Sisanya dummy CRC

    return Buffer.concat([header, ihdr])
  }

  // Helper membuat buffer JPEG minimal dengan SOF0 marker
  function createMockJpegBuffer(width: number, height: number): Buffer {
    const soi = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00])
    // SOF0 marker: FF C0, length (17 bytes = 0x0011), precision (8), height (2 bytes), width (2 bytes)
    const sof0 = Buffer.alloc(19)
    sof0[0] = 0xff
    sof0[1] = 0xc0
    sof0.writeUInt16BE(17, 2)
    sof0[4] = 8 // precision
    sof0.writeUInt16BE(height, 5)
    sof0.writeUInt16BE(width, 7)

    return Buffer.concat([soi, sof0])
  }

  describe('Ukuran Berkas', () => {
    it('menolak berkas kosong (0 byte)', () => {
      const emptyBuffer = Buffer.alloc(0)
      const res = validateImageBuffer(emptyBuffer)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('Berkas kosong')
    })

    it('menolak berkas yang melebihi batas maksimal 2 MB', () => {
      const oversizedBuffer = Buffer.alloc(MAX_IMAGE_SIZE_BYTES + 1024)
      const res = validateImageBuffer(oversizedBuffer)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('melebihi batas maksimal 2 MB')
    })
  })

  describe('Deteksi Magic Bytes Sebenarnya', () => {
    it('menolak file teks atau polyglot berbahaya berkedok foto menu', () => {
      const fakeImage = Buffer.from('<?php echo "evil payload"; ?>')
      const res = validateImageBuffer(fakeImage)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('Format berkas tidak diizinkan')
    })

    it('menolak berkas SVG (vektor berpotensi XSS)', () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      const res = validateImageBuffer(svgBuffer)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('Format berkas tidak diizinkan')
    })
  })

  describe('Validasi PNG & Dimensi', () => {
    it('menerima berkas PNG valid dengan dimensi dalam batas wajar (800x600)', () => {
      const pngBuffer = createMockPngBuffer(800, 600)
      const res = validateImageBuffer(pngBuffer)

      expect(res.isValid).toBe(true)
      expect(res.mimeType).toBe('image/png')
      expect(res.extension).toBe('png')
      expect(res.width).toBe(800)
      expect(res.height).toBe(600)
    })

    it('menolak PNG dengan dimensi terlalu kecil (<100px)', () => {
      const tinyPng = createMockPngBuffer(50, 50)
      const res = validateImageBuffer(tinyPng)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('terlalu kecil')
    })

    it('menolak PNG dengan dimensi terlalu besar (>4000px, anti decompression bomb)', () => {
      const hugePng = createMockPngBuffer(5000, 3000)
      const res = validateImageBuffer(hugePng)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('terlalu besar')
    })
  })

  describe('Validasi JPEG & Dimensi', () => {
    it('menerima berkas JPEG valid dengan SOF0 marker dan dimensi 1024x768', () => {
      const jpegBuffer = createMockJpegBuffer(1024, 768)
      const res = validateImageBuffer(jpegBuffer)

      expect(res.isValid).toBe(true)
      expect(res.mimeType).toBe('image/jpeg')
      expect(res.extension).toBe('jpg')
      expect(res.width).toBe(1024)
      expect(res.height).toBe(768)
    })

    it('menolak JPEG dengan frame rusak tanpa marker SOF yang valid', () => {
      const brokenJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x02])
      const res = validateImageBuffer(brokenJpeg)

      expect(res.isValid).toBe(false)
      expect(res.error).toContain('Struktur frame JPEG tidak valid')
    })
  })
})

