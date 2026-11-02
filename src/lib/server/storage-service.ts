import 'server-only'
import crypto from 'node:crypto'
import prisma from './db'
import type { ImageValidationResult } from './image-validator'

export interface SaveImageResult {
  url: string
  filename: string
  width: number
  height: number
  size: number
  mimeType: string
}

/**
 * Menyimpan data gambar ke PostgreSQL database (tabel menu_images)
 * secara aman dan persisten lintas instance serverless (Vercel) tanpa filesystem sementara (/tmp)
 * dan tanpa mengekspos service role key ke peramban.
 */
export async function saveMenuImage(
  buffer: Buffer,
  validation: ImageValidationResult
): Promise<SaveImageResult> {
  if (!validation.isValid || !validation.mimeType || !validation.extension) {
    throw new Error('Validasi gambar gagal. Tidak dapat menyimpan berkas.')
  }

  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  const uniqueId = crypto.randomUUID()
  const filename = `menu-${uniqueId}.${validation.extension}`

  const width = validation.width || 400
  const height = validation.height || 400
  const size = validation.size

  await prisma.menuImage.create({
    data: {
      filename,
      mimeType: validation.mimeType,
      data: new Uint8Array(buffer),
      size,
      width,
      height,
      hash,
    },
  })

  const url = `/api/images/${filename}`

  return {
    url,
    filename,
    width,
    height,
    size,
    mimeType: validation.mimeType,
  }
}

/**
 * Aturan pembersihan foto lama yang aman:
 * 1. Hanya membersihkan berkas yang dikelola aplikasi (/api/images/menu-...).
 * 2. Tidak pernah menghapus foto aset starter seed (/images/starter/...).
 * 3. Memastikan tidak ada MenuItem lain yang masih menggunakan URL foto ini sebelum menghapus.
 */
export async function cleanupOldImage(oldImageUrl: string | null | undefined): Promise<boolean> {
  if (!oldImageUrl) return false

  // Hanya periksa URL yang mengarah ke api/images/
  if (!oldImageUrl.startsWith('/api/images/')) {
    return false
  }

  const filename = oldImageUrl.replace('/api/images/', '').trim()
  if (!filename) return false

  // Periksa apakah masih ada menu lain yang menggunakan gambar ini
  const activeUsageCount = await prisma.menuItem.count({
    where: {
      image: oldImageUrl,
    },
  })

  // Jika masih digunakan oleh menu lain, jangan dihapus
  if (activeUsageCount > 0) {
    return false
  }

  // Hapus dari database jika sudah tidak ada yang menggunakan
  try {
    await prisma.menuImage.deleteMany({
      where: { filename },
    })
    return true
  } catch (err) {
    console.error(`Gagal membersihkan foto lama ${filename}:`, err)
    return false
  }
}

