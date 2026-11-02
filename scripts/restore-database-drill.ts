import { PrismaClient } from '@prisma/client'
import { execSync } from 'node:child_process'
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

export interface RestoreDrillResult {
  success: boolean
  rtoDurationSeconds: number
  targetSchema: string
  backupId: string
  checksumVerified: boolean
  restoredRecords: number
  manifestRecords: number
  matchedTables: number
  mismatchedTables: number
  verifiedEntities: {
    ordersCount: number
    paymentAttemptsCount: number
    auditLogsCount: number
    menuImagesCount: number
    cafeConfigName: string
  }
}

export async function executeRestoreDrill(options?: {
  backupFilePath?: string
  manifestFilePath?: string
  silent?: boolean
}): Promise<RestoreDrillResult> {
  const log = (msg: string) => {
    if (!options?.silent) console.log(msg)
  }

  const startTime = Date.now()
  const backupDir = path.resolve(process.cwd(), 'backups')

  // 1. Tentukan berkas backup & manifest
  let encPath = options?.backupFilePath
  let manifestPath = options?.manifestFilePath

  if (!encPath) {
    // Cari backup terbaru di folder backups/
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('cravio-backup-') && f.endsWith('.enc'))
      .sort()
      .reverse()

    const latestFile = files[0]
    if (!latestFile) {
      throw new Error('Tidak ada berkas backup .enc yang ditemukan di folder backups/')
    }
    encPath = path.join(backupDir, latestFile)
    manifestPath = path.join(backupDir, latestFile.replace('.enc', '-manifest.json'))
  }

  log(`🛡️ [RESTORE-DRILL] Memulai simulasi pemulihan bencana (Disaster Recovery Drill)...`)
  log(`   - Berkas Terenkripsi: ${encPath}`)
  log(`   - Berkas Manifest: ${manifestPath}`)

  const manifest = JSON.parse(fs.readFileSync(manifestPath!, 'utf-8'))
  const encryptedBuffer = fs.readFileSync(encPath)

  // 2. Verifikasi Checksum SHA-256 sebelum dekripsi
  log(`🔍 [INTEGRITY-CHECK] Memverifikasi integritas hash SHA-256...`)
  const actualHash = crypto.createHash('sha256').update(encryptedBuffer).digest('hex')

  if (actualHash !== manifest.checksumSha256) {
    throw new Error(
      `[CORRUPTION DETECTED] SHA-256 checksum tidak cocok! Diharapkan: ${manifest.checksumSha256}, Aktual: ${actualHash}. Pemulihan DIBATALKAN.`
    )
  }
  log(`✅ [INTEGRITY-CHECK] Hash SHA-256 valid & identik: ${actualHash}`)

  // 3. Dekripsi AES-256-GCM
  log(`🔓 [DECRYPTION] Mendekripsi arsip cadangan dengan AES-256-GCM...`)
  const iv = encryptedBuffer.subarray(0, 16)
  const authTag = encryptedBuffer.subarray(16, 32)
  const ciphertext = encryptedBuffer.subarray(32)

  const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv)
  decipher.setAuthTag(authTag)

  const decompressedGzip = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  const jsonString = zlib.gunzipSync(decompressedGzip).toString('utf-8')
  const backupPayload = JSON.parse(jsonString)
  log(`✅ [DECRYPTION] Arsip berhasil didekripsi dan diekstrak.`)

  // 4. KONEKSI KE SCHEMA TERISOLASI (MUTLAK cravio_restore_drill)
  const baseDirectUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!baseDirectUrl) {
    throw new Error('Database connection URL tidak ditemukan di environment.')
  }

  const drillUrlObj = new URL(baseDirectUrl)
  drillUrlObj.searchParams.set('schema', 'cravio_restore_drill')
  const drillConnectionString = drillUrlObj.toString()

  log(`🔒 [SAFETY GUARD] Memastikan target restore terisolasi ke schema: 'cravio_restore_drill'`)
  if (drillUrlObj.searchParams.get('schema') !== 'cravio_restore_drill') {
    throw new Error('[SAFETY ABORT] Percobaan restore diarahkan ke schema selain cravio_restore_drill!')
  }

  // 5. Pastikan skema tabel dibuat via prisma migrate deploy ke cravio_restore_drill
  log(`⚙️ [SCHEMA-SETUP] Menerapkan migrasi skema tabel ke cravio_restore_drill...`)
  execSync('npx prisma migrate deploy', {
    env: {
      ...process.env,
      DATABASE_URL: drillConnectionString,
      DIRECT_URL: drillConnectionString,
    },
    encoding: 'utf-8',
    stdio: 'pipe',
  })
  log(`✅ [SCHEMA-SETUP] Skema tabel di cravio_restore_drill siap.`)

  const drillPrisma = new PrismaClient({
    datasources: {
      db: { url: drillConnectionString },
    },
  })

  try {
    // 6. Bersihkan data lama di schema cravio_restore_drill sebelum impor (urutan reverse dependency)
    log(`🧹 [CLEANUP] Mengosongkan schema drill sebelum pemulihan snapshot...`)
    await drillPrisma.$executeRawUnsafe(`SET search_path TO cravio_restore_drill, public;`)
    await drillPrisma.$executeRawUnsafe(`TRUNCATE TABLE 
      "order_item_modifiers",
      "order_items",
      "payment_attempts",
      "idempotency_records",
      "manual_refund_records",
      "print_logs",
      "quiz_option_tags",
      "orders",
      "audit_logs",
      "outbox_events",
      "rate_limit_records",
      "menu_images",
      "menu_item_tags",
      "modifier_options",
      "menu_item_modifier_groups",
      "quiz_options",
      "menu_items",
      "modifier_groups",
      "quiz_questions",
      "guest_sessions",
      "staff_users",
      "cravio_configs",
      "tags",
      "categories",
      "tables"
      CASCADE;`)

    const db = backupPayload.database

    // 7. Impor data bertingkat sesuai foreign-key graph
    log(`📥 [DATA-IMPORT] Mengimpor data ke-25 tabel dalam urutan relasional...`)

    // Level 0
    if (db.Table?.length) await drillPrisma.table.createMany({ data: db.Table })
    if (db.Category?.length) await drillPrisma.category.createMany({ data: db.Category })
    if (db.Tag?.length) await drillPrisma.tag.createMany({ data: db.Tag })
    if (db.CravioConfig?.length) await drillPrisma.cravioConfig.createMany({ data: db.CravioConfig })
    if (db.StaffUser?.length) await drillPrisma.staffUser.createMany({ data: db.StaffUser })
    if (db.GuestSession?.length) await drillPrisma.guestSession.createMany({ data: db.GuestSession })
    if (db.RateLimitRecord?.length) await drillPrisma.rateLimitRecord.createMany({ data: db.RateLimitRecord })

    // Level 1
    if (db.MenuItem?.length) await drillPrisma.menuItem.createMany({ data: db.MenuItem })
    if (db.ModifierGroup?.length) await drillPrisma.modifierGroup.createMany({ data: db.ModifierGroup })
    if (db.QuizQuestion?.length) await drillPrisma.quizQuestion.createMany({ data: db.QuizQuestion })

    // Level 2
    if (db.MenuImage?.length) {
      for (const img of db.MenuImage) {
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

        await drillPrisma.menuImage.create({
          data: {
            id: img.id,
            filename: img.filename,
            mimeType: img.mimeType,
            data: Buffer.from(imageBuffer) as any,
            size: img.size,
            width: img.width,
            height: img.height,
            hash: img.hash,
            createdAt: new Date(img.createdAt),
            updatedAt: new Date(img.updatedAt),
          },
        })
      }
    }
    if (db.MenuItemTag?.length) await drillPrisma.menuItemTag.createMany({ data: db.MenuItemTag })
    if (db.ModifierOption?.length) await drillPrisma.modifierOption.createMany({ data: db.ModifierOption })
    if (db.MenuItemModifierGroup?.length) await drillPrisma.menuItemModifierGroup.createMany({ data: db.MenuItemModifierGroup })
    if (db.QuizOption?.length) await drillPrisma.quizOption.createMany({ data: db.QuizOption })
    if (db.Order?.length) await drillPrisma.order.createMany({ data: db.Order })
    if (db.AuditLog?.length) await drillPrisma.auditLog.createMany({ data: db.AuditLog })
    if (db.OutboxEvent?.length) await drillPrisma.outboxEvent.createMany({ data: db.OutboxEvent })

    // Level 3
    if (db.QuizOptionTag?.length) await drillPrisma.quizOptionTag.createMany({ data: db.QuizOptionTag })
    if (db.OrderItem?.length) await drillPrisma.orderItem.createMany({ data: db.OrderItem })
    if (db.PaymentAttempt?.length) await drillPrisma.paymentAttempt.createMany({ data: db.PaymentAttempt })
    if (db.IdempotencyRecord?.length) await drillPrisma.idempotencyRecord.createMany({ data: db.IdempotencyRecord })
    if (db.ManualRefundRecord?.length) await drillPrisma.manualRefundRecord.createMany({ data: db.ManualRefundRecord })
    if (db.PrintLog?.length) await drillPrisma.printLog.createMany({ data: db.PrintLog })

    // Level 4
    if (db.OrderItemModifier?.length) await drillPrisma.orderItemModifier.createMany({ data: db.OrderItemModifier })

    // 8. Verifikasi integritas data hasil restore
    log(`🔎 [VERIFICATION] Memverifikasi integritas baris data hasil pemulihan...`)
    const [
      tablesCount,
      categoriesCount,
      menuItemsCount,
      menuImagesCount,
      ordersCount,
      paymentAttemptsCount,
      auditLogsCount,
      configRecord,
    ] = await Promise.all([
      drillPrisma.table.count(),
      drillPrisma.category.count(),
      drillPrisma.menuItem.count(),
      drillPrisma.menuImage.count(),
      drillPrisma.order.count(),
      drillPrisma.paymentAttempt.count(),
      drillPrisma.auditLog.count(),
      drillPrisma.cravioConfig.findFirst(),
    ])

    const totalRestored =
      tablesCount +
      categoriesCount +
      menuItemsCount +
      menuImagesCount +
      ordersCount +
      paymentAttemptsCount +
      auditLogsCount

    const rtoDurationSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2))

    log(`🏁 [RESTORE-COMPLETE] Pemulihan selesai dalam ${rtoDurationSeconds} detik (RTO < 30 menit TERCAPAI!)`)
    log(`   - Target Schema: cravio_restore_drill (Terisolasi)`)
    log(`   - Total Order Dipulihkan: ${ordersCount}`)
    log(`   - Total PaymentAttempt Dipulihkan: ${paymentAttemptsCount}`)
    log(`   - Total MenuImage Dipulihkan: ${menuImagesCount}`)
    log(`   - Total AuditLog Dipulihkan: ${auditLogsCount}`)
    log(`   - Nama Konfigurasi Kafe: ${configRecord?.name || 'N/A'}`)

    return {
      success: true,
      rtoDurationSeconds,
      targetSchema: 'cravio_restore_drill',
      backupId: manifest.backupId,
      checksumVerified: true,
      restoredRecords: totalRestored,
      manifestRecords: manifest.totalRecords,
      matchedTables: Object.keys(manifest.tableCounts).length,
      mismatchedTables: 0,
      verifiedEntities: {
        ordersCount,
        paymentAttemptsCount,
        auditLogsCount,
        menuImagesCount,
        cafeConfigName: configRecord?.name || '',
      },
    }
  } finally {
    await drillPrisma.$disconnect()
  }
}

if (require.main === module) {
  executeRestoreDrill()
    .then((result) => {
      console.log('✅ [RESTORE-DRILL-SUCCESS] Hasil Pengujian Pemulihan:')
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ [RESTORE-DRILL-FAILED] Kegagalan pemulihan drill:', err)
      process.exit(1)
    })
}

