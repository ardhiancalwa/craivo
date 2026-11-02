import { PrismaClient } from '@prisma/client'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

// Load .env
const envFiles = ['.env.local', '.env']
for (const file of envFiles) {
  const filePath = path.resolve(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIdx = trimmed.indexOf('=')
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim()
          let val = trimmed.slice(equalIdx + 1).trim()
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1)
          }
          if (process.env[key] === undefined) {
            process.env[key] = val
          }
        }
      }
    }
  }
}

const encryptionKeyRaw =
  process.env.BACKUP_ENCRYPTION_KEY || 'cravio-production-aes-256-backup-secret-key-2026'
const aesKey = crypto.createHash('sha256').update(encryptionKeyRaw).digest()

const backupDir = path.resolve(process.cwd(), 'backups')
const encPath = path.join(backupDir, 'cravio-backup-20261102-075447.enc')

console.log(`📦 [RESTORE-IMAGES] Membaca arsip backup terenkripsi: ${encPath}`)
const encryptedBuffer = fs.readFileSync(encPath)
const iv = encryptedBuffer.subarray(0, 16)
const authTag = encryptedBuffer.subarray(16, 32)
const ciphertext = encryptedBuffer.subarray(32)

const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv)
decipher.setAuthTag(authTag)

const decompressedGzip = Buffer.concat([decipher.update(ciphertext), decipher.final()])
const jsonString = zlib.gunzipSync(decompressedGzip).toString('utf-8')
const backupPayload = JSON.parse(jsonString)

const images = backupPayload.database?.MenuImage || []
console.log(`📸 Ditemukan ${images.length} data foto MenuImage dalam backup.`)

const prisma = new PrismaClient()

async function restore() {
  let restored = 0
  for (const img of images) {
    let imageBuffer: Buffer
    if (Buffer.isBuffer(img.data)) {
      imageBuffer = img.data
    } else if (typeof img.data === 'string') {
      imageBuffer = Buffer.from(img.data, 'base64')
    } else if (img.data?.data && Array.isArray(img.data.data)) {
      imageBuffer = Buffer.from(img.data.data)
    } else if (typeof img.data === 'object' && img.data !== null) {
      imageBuffer = Buffer.from(Object.values(img.data) as number[])
    } else {
      imageBuffer = Buffer.alloc(0)
    }

    if (imageBuffer.length === 0) {
      console.warn(`⚠️ Warning: buffer kosong untuk ${img.filename}`)
      continue
    }

    const uint8Data = new Uint8Array(imageBuffer)
    await prisma.menuImage.upsert({
      where: { filename: img.filename },
      update: {
        mimeType: img.mimeType,
        data: uint8Data,
        size: img.size,
        width: img.width,
        height: img.height,
        hash: img.hash,
        updatedAt: new Date(),
      },
      create: {
        id: img.id,
        filename: img.filename,
        mimeType: img.mimeType,
        data: uint8Data,
        size: img.size,
        width: img.width,
        height: img.height,
        hash: img.hash,
        createdAt: new Date(img.createdAt),
        updatedAt: new Date(img.updatedAt),
      },
    })
    console.log(`✅ Foto dipulihkan ke database: ${img.filename} (${img.size} bytes)`)
    restored++
  }

  const finalCount = await prisma.menuImage.count()
  console.log(`\n🎉 SELESAI: ${restored} foto berhasil dipulihkan. Total MenuImage di database saat ini: ${finalCount}`)
  await prisma.$disconnect()
}

restore().catch((err) => {
  console.error('❌ Error restore:', err)
  process.exit(1)
})
