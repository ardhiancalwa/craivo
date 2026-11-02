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

// Derive 32-byte AES-256 key
const aesKey = crypto.createHash('sha256').update(encryptionKeyRaw).digest()

export interface BackupManifest {
  backupId: string
  timestamp: string
  rpoFreshness: string
  environment: string
  sourceHost: string
  totalRecords: number
  tableCounts: Record<string, number>
  mediaFileCount: number
  checksumSha256: string
  fileSizeEncryptedBytes: number
  encryptionAlgorithm: string
}

export async function executeBackup(options?: {
  outputDir?: string
  connectionString?: string
  silent?: boolean
}): Promise<{ backupFilePath: string; manifestFilePath: string; manifest: BackupManifest }> {
  const log = (msg: string) => {
    if (!options?.silent) console.log(msg)
  }

  const outputDir = options?.outputDir || path.resolve(process.cwd(), 'backups')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const targetDbUrl = options?.connectionString || process.env.DATABASE_URL
  if (!targetDbUrl) {
    throw new Error('DATABASE_URL tidak tersedia untuk melakukan backup.')
  }

  const prisma = new PrismaClient({
    datasources: {
      db: { url: targetDbUrl },
    },
  })

  try {
    const startTime = Date.now()
    const nowIso = new Date().toISOString()
    const dateStamp = nowIso.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
    const backupId = `cravio-backup-${dateStamp}`

    log(`📦 [BACKUP-START] Memulai pencadangan data Cravio (ID: ${backupId})...`)

    // 1. Ekspor data dari ke-25 tabel Prisma
    const [
      tables,
      categories,
      tags,
      menuItems,
      menuImages,
      menuItemTags,
      modifierGroups,
      modifierOptions,
      menuItemModifierGroups,
      quizQuestions,
      quizOptions,
      quizOptionTags,
      cravioConfigs,
      staffUsers,
      guestSessions,
      orders,
      orderItems,
      orderItemModifiers,
      paymentAttempts,
      idempotencyRecords,
      auditLogs,
      manualRefundRecords,
      printLogs,
      outboxEvents,
      rateLimitRecords,
    ] = await Promise.all([
      prisma.table.findMany(),
      prisma.category.findMany(),
      prisma.tag.findMany(),
      prisma.menuItem.findMany(),
      prisma.menuImage.findMany(),
      prisma.menuItemTag.findMany(),
      prisma.modifierGroup.findMany(),
      prisma.modifierOption.findMany(),
      prisma.menuItemModifierGroup.findMany(),
      prisma.quizQuestion.findMany(),
      prisma.quizOption.findMany(),
      prisma.quizOptionTag.findMany(),
      prisma.cravioConfig.findMany(),
      prisma.staffUser.findMany(),
      prisma.guestSession.findMany(),
      prisma.order.findMany(),
      prisma.orderItem.findMany(),
      prisma.orderItemModifier.findMany(),
      prisma.paymentAttempt.findMany(),
      prisma.idempotencyRecord.findMany(),
      prisma.auditLog.findMany(),
      prisma.manualRefundRecord.findMany(),
      prisma.printLog.findMany(),
      prisma.outboxEvent.findMany(),
      prisma.rateLimitRecord.findMany(),
    ])

    const tableCounts: Record<string, number> = {
      Table: tables.length,
      Category: categories.length,
      Tag: tags.length,
      MenuItem: menuItems.length,
      MenuImage: menuImages.length,
      MenuItemTag: menuItemTags.length,
      ModifierGroup: modifierGroups.length,
      ModifierOption: modifierOptions.length,
      MenuItemModifierGroup: menuItemModifierGroups.length,
      QuizQuestion: quizQuestions.length,
      QuizOption: quizOptions.length,
      QuizOptionTag: quizOptionTags.length,
      CravioConfig: cravioConfigs.length,
      StaffUser: staffUsers.length,
      GuestSession: guestSessions.length,
      Order: orders.length,
      OrderItem: orderItems.length,
      OrderItemModifier: orderItemModifiers.length,
      PaymentAttempt: paymentAttempts.length,
      IdempotencyRecord: idempotencyRecords.length,
      AuditLog: auditLogs.length,
      ManualRefundRecord: manualRefundRecords.length,
      PrintLog: printLogs.length,
      OutboxEvent: outboxEvents.length,
      RateLimitRecord: rateLimitRecords.length,
    }

    const totalRecords = Object.values(tableCounts).reduce((a, b) => a + b, 0)
    log(`📊 [BACKUP-TABLES] Total ${totalRecords} baris diekspor dari 25 tabel.`)

    // 2. Cadangkan foto/media statis dari public/images jika ada
    const staticImagesDir = path.resolve(process.cwd(), 'public', 'images')
    const mediaFiles: Record<string, string> = {}
    if (fs.existsSync(staticImagesDir)) {
      const files = fs.readdirSync(staticImagesDir)
      for (const file of files) {
        const fullPath = path.join(staticImagesDir, file)
        if (fs.statSync(fullPath).isFile()) {
          mediaFiles[file] = fs.readFileSync(fullPath).toString('base64')
        }
      }
    }
    log(`🖼️ [BACKUP-MEDIA] Total ${Object.keys(mediaFiles).length} berkas media statis dicadangkan.`)

    // 3. Serialize & Gzip compress
    const backupPayload = {
      manifest: {
        backupId,
        createdAt: nowIso,
        schemaVersion: '1.0.0',
      },
      database: {
        Table: tables,
        Category: categories,
        Tag: tags,
        MenuItem: menuItems,
        MenuImage: menuImages,
        MenuItemTag: menuItemTags,
        ModifierGroup: modifierGroups,
        ModifierOption: modifierOptions,
        MenuItemModifierGroup: menuItemModifierGroups,
        QuizQuestion: quizQuestions,
        QuizOption: quizOptions,
        QuizOptionTag: quizOptionTags,
        CravioConfig: cravioConfigs,
        StaffUser: staffUsers,
        GuestSession: guestSessions,
        Order: orders,
        OrderItem: orderItems,
        OrderItemModifier: orderItemModifiers,
        PaymentAttempt: paymentAttempts,
        IdempotencyRecord: idempotencyRecords,
        AuditLog: auditLogs,
        ManualRefundRecord: manualRefundRecords,
        PrintLog: printLogs,
        OutboxEvent: outboxEvents,
        RateLimitRecord: rateLimitRecords,
      },
      media: mediaFiles,
    }

    const jsonString = JSON.stringify(backupPayload)
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'))

    // 4. Enkripsi dengan AES-256-GCM
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv)
    const encryptedData = Buffer.concat([cipher.update(compressedBuffer), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Format binary file terenkripsi:
    // [16 bytes IV] + [16 bytes AuthTag] + [Ciphertext]
    const finalEncryptedFileBuffer = Buffer.concat([iv, authTag, encryptedData])

    const checksumSha256 = crypto
      .createHash('sha256')
      .update(finalEncryptedFileBuffer)
      .digest('hex')

    const backupFilePath = path.join(outputDir, `${backupId}.enc`)
    fs.writeFileSync(backupFilePath, finalEncryptedFileBuffer)

    let sourceHost = 'unknown'
    try {
      sourceHost = new URL(targetDbUrl).host
    } catch {
      // Ignored
    }

    const manifest: BackupManifest = {
      backupId,
      timestamp: nowIso,
      rpoFreshness: 'RPO < 24 jam tercapai',
      environment: process.env.APP_ENV || 'production',
      sourceHost,
      totalRecords,
      tableCounts,
      mediaFileCount: Object.keys(mediaFiles).length,
      checksumSha256,
      fileSizeEncryptedBytes: finalEncryptedFileBuffer.length,
      encryptionAlgorithm: 'AES-256-GCM',
    }

    const manifestFilePath = path.join(outputDir, `${backupId}-manifest.json`)
    fs.writeFileSync(manifestFilePath, JSON.stringify(manifest, null, 2))

    // 5. Retensi otomatis: hapus backup lebih lama dari 7 hari
    const retentionDays = 7
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000
    const backupFiles = fs.readdirSync(outputDir)
    let prunedCount = 0

    for (const f of backupFiles) {
      if (f.startsWith('cravio-backup-') && (f.endsWith('.enc') || f.endsWith('-manifest.json'))) {
        const full = path.join(outputDir, f)
        const stats = fs.statSync(full)
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(full)
          prunedCount++
        }
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2)
    log(`🔒 [BACKUP-SUCCESS] Enkripsi AES-256-GCM selesai dalam ${durationSec} detik.`)
    log(`   - Berkas: ${backupFilePath} (${(finalEncryptedFileBuffer.length / 1024).toFixed(1)} KB)`)
    log(`   - SHA-256: ${checksumSha256}`)
    log(`   - Manifest: ${manifestFilePath}`)
    if (prunedCount > 0) {
      log(`   - Retensi: ${prunedCount} berkas lama (> 7 hari) dibersihkan.`)
    }

    return {
      backupFilePath,
      manifestFilePath,
      manifest,
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  executeBackup()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ [BACKUP-ERROR] Gagal melakukan pencadangan:', err)
      process.exit(1)
    })
}

